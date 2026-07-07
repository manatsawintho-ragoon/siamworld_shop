import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIO } from 'socket.io';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { isWsOriginAllowed } from './utils/wsOrigin';
import { pool } from './database/connection';
import { redis } from './database/redis';
import { RconManager } from './services/rcon-manager';
import { PlayerTracker } from './services/player-tracker';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import walletRoutes from './routes/wallet.routes';
import paymentRoutes from './routes/payment.routes';
import shopRoutes from './routes/shop.routes';
import adminRoutes from './routes/admin.routes';
import publicRoutes from './routes/public.routes';
import setupRoutes from './routes/setup.routes';

const app = express();
const server = http.createServer(app);

// Trust all private/local network proxies (loopback + RFC1918 ranges).
// This covers the full Docker proxy chain: Browser → NPM → Next.js → Backend.
// Without this, Express reads the NPM container IP (172.x.x.x) as the client,
// causing all users to share one rate-limit bucket.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Allowed origins — reads from CORS_ORIGIN env var (comma-separated)
const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

// Socket.IO
// cors.origin: true reflects the request origin so the browser never sees a CORS
// error; allowRequest is the real gate (same-origin custom domains + configured
// origins). The players namespace only broadcasts public online counts.
const io = new SocketIO(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  allowRequest: (req, cb) => {
    const ok = isWsOriginAllowed(req.headers.origin, req.headers.host, allowedOrigins);
    cb(ok ? null : 'origin_not_allowed', ok);
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ── Rate Limiting ────────────────────────────────────────────────────────────

// Safe read-only paths — exempt from ALL rate limiting.
// These are called on every page load; blocking them = shop looks broken.
// NOTE: use req.originalUrl (full path) not req.path — when middleware is
// mounted at /api/, Express strips the prefix from req.path.
const isSkipped = (req: import('express').Request) => {
  if (req.method !== 'GET') return false;
  const url = req.originalUrl.split('?')[0]; // strip query string
  return (
    url.startsWith('/api/public/') ||
    url.startsWith('/api/shop/products') ||
    url === '/api/health'
  );
};

// Global limiter: configurable via env (default 2000 req / 15 min per real IP).
// Now that trust proxy is fixed, each user gets their own bucket.
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isSkipped,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// Auth limiter: 20 login/register attempts per 15 min per real IP.
// Protects against brute-force while not blocking shared networks.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isSkipped,
  message: { success: false, error: 'Too many attempts, please try again in 15 minutes.' },
});


// ── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // This CSP is served on backend (API) responses only, which return JSON —
      // no inline scripts are ever needed here. The Next.js frontend sets its own
      // policy. Keeping scriptSrc strict costs nothing and hardens direct hits.
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...(allowedOrigins === '*' ? ['*'] : allowedOrigins)],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  if (req.path !== '/api/health') {
    logger.debug('Request', { method: req.method, path: req.path });
  }
  next();
});

// Default every API response to no-store so authenticated data (profile, wallet,
// admin) is never cached by the browser or an intermediary. Public read routes
// opt back into caching by overriding Cache-Control in their handlers.
app.use('/api/', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Apply global rate limiter to all API routes
app.use('/api/', globalLimiter);

// Routes — auth & setup get strict rate limit, payment gets medium limit
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/setup', authLimiter, setupRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Health check — includes DB and Redis liveness
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, boolean> = { db: false, redis: false };
  try { await pool.execute('SELECT 1'); checks.db = true; } catch {}
  try { await redis.ping(); checks.redis = true; } catch {}
  const ok = checks.db && checks.redis;
  res.status(ok ? 200 : 503).json({ success: ok, checks, timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Global unhandled error handlers — MUST exist to prevent Node.js crash
// on async RCON socket errors or unhandled promise rejections.
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection at Promise', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception thrown', {
    error: err.message,
    stack: err.stack,
  });
  // RCON socket errors are noisy but recoverable — the RconManager handles its
  // own reconnection, so don't take the whole process down for those. Any other
  // uncaught exception may have left state corrupt (half-open DB tx, leaked
  // locks); exit and let Docker's `restart: unless-stopped` bring up a clean
  // process rather than serving requests from a poisoned one.
  if (!err.message.includes('RCON')) {
    logger.error('Fatal uncaught exception — exiting for a clean restart');
    process.exit(1);
  }
});

// Initialize services
const rconManager = RconManager.getInstance();
const playerTracker = new PlayerTracker(rconManager, io, redis);

// Make services available to routes
app.set('io', io);
app.set('rconManager', rconManager);
app.set('playerTracker', playerTracker);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.debug('WebSocket client connected', { id: socket.id });

  socket.on('subscribe:players', () => {
    socket.join('players');
    // Send current online players immediately
    playerTracker.getOnlinePlayers()
      .then((players) => { socket.emit('players:update', players); })
      .catch((err) => { logger.warn('Socket: failed to fetch online players', { err: err?.message }); });
  });

  socket.on('disconnect', () => {
    logger.debug('WebSocket client disconnected', { id: socket.id });
  });
});

// Start server
async function start() {
  try {
    // Test DB connection
    await pool.execute('SELECT 1');
    logger.info('Database connected');

    // Test Redis
    await redis.ping();
    logger.info('Redis connected');

    // Initialize RCON connections for all enabled servers
    await rconManager.initializeFromDB();

    // Start player tracking (polls every 10s)
    playerTracker.start(10000);

    // Cleanup REDEEMED inventory items older than 7 days (runs every 6 hours)
    const cleanupInventory = async () => {
      try {
        const [result] = await pool.execute(
          "DELETE FROM web_inventory WHERE status = 'REDEEMED' AND redeemed_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        const deleted = (result as any).affectedRows;
        if (deleted > 0) logger.info(`Inventory cleanup: removed ${deleted} redeemed items older than 7 days`);
      } catch (err) { logger.error('Inventory cleanup error', { error: err }); }
    };
    cleanupInventory();
    setInterval(cleanupInventory, 6 * 60 * 60 * 1000);

    // Auto-deactivate loot boxes & products where sale_end + 5 min grace has passed (runs every minute)
    const deactivateExpiredSales = async () => {
      try {
        const [r1] = await pool.execute(
          "UPDATE loot_boxes SET active = 0 WHERE active = 1 AND is_paused = 0 AND sale_end IS NOT NULL AND sale_end < DATE_SUB(NOW(), INTERVAL 5 MINUTE)"
        );
        const [r2] = await pool.execute(
          "UPDATE products SET active = 0 WHERE active = 1 AND is_paused = 0 AND sale_end IS NOT NULL AND sale_end < DATE_SUB(NOW(), INTERVAL 5 MINUTE)"
        );
        const rows = (r1 as any).affectedRows + (r2 as any).affectedRows;
        if (rows > 0) logger.info(`Auto-deactivated ${rows} expired sale item(s)`);
      } catch (err) { logger.error('Deactivate expired sales error', { error: err }); }
    };
    deactivateExpiredSales();
    setInterval(deactivateExpiredSales, 60 * 1000);

    server.listen(config.port, () => {
      logger.info('Server started', {
        port: config.port,
        env: config.nodeEnv,
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

start();

// Graceful shutdown — close persistent RCON connections
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  playerTracker.stop();
  await rconManager.shutdown();
  server.close();
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  playerTracker.stop();
  await rconManager.shutdown();
  server.close();
});

export { app, io, rconManager, playerTracker };
