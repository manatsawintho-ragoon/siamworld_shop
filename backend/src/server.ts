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

// Trust the Next.js proxy so rate-limiters use the real client IP
// (without this, all traffic appears to come from the Next.js container IP)
app.set('trust proxy', 1);

// Allowed origins — reads from CORS_ORIGIN env var (comma-separated)
const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

// Socket.IO
const io = new SocketIO(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ── Rate Limiting ────────────────────────────────────────────────────────────

// Global limiter: 300 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// Strict limiter for auth & setup endpoints: 10 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again in 15 minutes.' },
});

// Payment limiter: 30 req / 15 min per IP
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many payment requests, please slow down.' },
});

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // Next.js inline scripts
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req, _res, next) => {
  if (req.path !== '/api/health') {
    logger.debug('Request', { method: req.method, path: req.path });
  }
  next();
});

// Apply global rate limiter to all API routes
app.use('/api/', globalLimiter);

// Routes — auth & setup get strict rate limit, payment gets medium limit
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/setup', authLimiter, setupRoutes);
app.use('/api/payment', paymentLimiter, paymentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

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
    playerTracker.getOnlinePlayers().then((players) => {
      socket.emit('players:update', players);
    });
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
