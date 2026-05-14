import http from 'http';
import dns from 'dns';
import express from 'express';

// Container has no IPv6 connectivity but DNS returns AAAA records for many APIs
// (e.g. api.cloudflare.com). Node's happy-eyeballs races both families and the
// IPv6 path silently hangs — force IPv4 lookups to keep outbound HTTPS reliable.
dns.setDefaultResultOrder('ipv4first');
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { startCronJobs } from './services/cron.service';
import { bridgeService } from './services/bridge.service';

import authRoutes         from './routes/auth.routes';
import walletRoutes       from './routes/wallet.routes';
import subscriptionRoutes from './routes/subscription.routes';
import adminRoutes        from './routes/admin.routes';
import ticketRoutes       from './routes/ticket.routes';
import voucherRoutes      from './routes/voucher.routes';
import bridgeRoutes       from './routes/bridge.routes';
import { pool } from './database/connection';
import { redis } from './database/redis';

const app = express();

app.set('trust proxy', 1);

// Configure security
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow OAuth redirects easily
}));

// Parse comma-separated PANEL_CORS_ORIGIN — e.g. "https://panel.siamsite.shop,http://localhost:3000"
const allowedPanelOrigins = config.corsOrigin === '*'
  ? true
  : config.corsOrigin.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: allowedPanelOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Initialize Passport
app.use(passport.initialize());

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Relaxed slightly for social logins
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again in 15 minutes.' },
});

// Routes
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/wallet',        walletRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api/vouchers',      voucherRoutes);
app.use('/api/bridge',        bridgeRoutes);

// Health check — includes DB and Redis liveness
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, boolean> = { db: false, redis: false };
  try { await pool.execute('SELECT 1'); checks.db = true; } catch {}
  try { await redis.ping(); checks.redis = true; } catch {}
  const ok = checks.db && checks.redis;
  res.status(ok ? 200 : 503).json({ ok, checks, ts: new Date().toISOString() });
});

app.use(errorHandler);

const httpServer = http.createServer(app);
bridgeService.attach(httpServer);

httpServer.listen(config.port, () => {
  process.stdout.write(`[Panel] Backend running on port ${config.port}\n`);
  startCronJobs();
});

export default app;
