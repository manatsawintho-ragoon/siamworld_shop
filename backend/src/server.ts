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

// ── Rate limiters ────────────────────────────────────────────────────────────

/** General API — 300 req / 15 min per IP */
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/api/health',
});

/** Auth — 10 attempts / 15 min per IP (brute-force protection) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please wait 15 minutes.' },
});

/** Payment / redeem code — 20 attempts / 10 min per IP */
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many payment requests. Please slow down.' },
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
app.use(globalLimiter);

// Request logging
app.use((req, _res, next) => {
  if (req.path !== '/api/health') {
    logger.debug('Request', { method: req.method, path: req.path });
  }
  next();
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payment', paymentLimiter, paymentRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/setup', setupRoutes);

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
