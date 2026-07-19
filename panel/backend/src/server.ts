import { logger } from './utils/logger';
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
import { deployService } from './services/deploy.service';

import authRoutes         from './routes/auth.routes';
import walletRoutes       from './routes/wallet.routes';
import subscriptionRoutes from './routes/subscription.routes';
import adminRoutes        from './routes/admin.routes';
import ticketRoutes       from './routes/ticket.routes';
import voucherRoutes      from './routes/voucher.routes';
import bridgeRoutes       from './routes/bridge.routes';
import internalBridgeRoutes from './routes/internal-bridge.routes';
import { publicInstallRouter, authedInstallRouter } from './routes/install.routes';
import announcementRoutes from './routes/announcement.routes';
import showcaseRoutes     from './routes/showcase.routes';
import activityRoutes     from './routes/activity.routes';
import { pool } from './database/connection';
import { redis } from './database/redis';

const app = express();

app.set('trust proxy', 1);

// Configure security — CSP enabled with a narrow policy. OAuth redirects work at the
// network layer (browser-initiated 302) and are not affected by CSP, so the previous
// "disable CSP for OAuth" comment was wrong. We allow framing only from same origin and
// permit Next.js inline JSON-LD via 'unsafe-inline' on script-src.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // Cloudflare Turnstile loads its widget script + iframe from challenges.cloudflare.com.
      'script-src':  ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
      'style-src':   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':    ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src':     ["'self'", 'data:', 'https:', 'blob:'],
      'connect-src': ["'self'", 'https:', 'wss:'],
      'frame-src':   ["'self'", 'https://challenges.cloudflare.com'],
      'frame-ancestors': ["'none'"],
      'object-src':  ["'none'"],
      'base-uri':    ["'self'"],
      'form-action': ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allows third-party assets like avatars
}));

// Parse comma-separated PANEL_CORS_ORIGIN — e.g. "https://panel.siamsite.shop,http://localhost:3000"
// CORS spec forbids '*' together with credentials:true (browser rejects), so guard explicitly.
if (config.corsOrigin === '*') {
  throw new Error('PANEL_CORS_ORIGIN="*" is incompatible with credentials:true. Set explicit origins.');
}
const allowedPanelOrigins = config.corsOrigin
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: allowedPanelOrigins,
  credentials: true,
}));

// Per-route body limits — auth/profile/ticket payloads are tiny; only slip upload + bridge
// payloads legitimately need the 10MB allowance. Setting a smaller global default + a
// dedicated heavy parser on wallet routes prevents register/login from accepting megabytes.
const smallJson = express.json({ limit: '64kb' });
const mediumJson = express.json({ limit: '256kb' });
const largeJson = express.json({ limit: '10mb' });
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// CRITICAL: Initialize Passport
app.use(passport.initialize());

// Generous global rate limit — covers normal admin browsing (each page issues several API
// calls). Brute-force-attractive endpoints get their own tighter per-route limiter inside
// auth.routes.ts, so 1000/15min here is safe.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Health check is polled externally; never count it against the limit.
  skip: (req) => req.path === '/api/health',
}));

// Routes — pick a body-size class per surface (slip uploads are the only legit large input).
app.use('/api/auth',          smallJson,  authRoutes);
app.use('/api/wallet',        largeJson,  walletRoutes);           // slip upload
app.use('/api/subscriptions', mediumJson, subscriptionRoutes);
app.use('/api/admin',         mediumJson, adminRoutes);
app.use('/api/tickets',       mediumJson, ticketRoutes);
app.use('/api/vouchers',      smallJson,  voucherRoutes);
app.use('/api/bridge',        mediumJson, bridgeRoutes, authedInstallRouter);
// Server-to-server bridge proxy for deployed customer shops (per-sub bearer key, not JWT)
app.use('/api/internal/bridge', smallJson, internalBridgeRoutes);
// Public installer endpoints (key-authed via query string, not JWT)
app.use('/install',           smallJson,  publicInstallRouter);
// Open read polled by customer shops for the announcements popup (published only)
app.use('/api/announcements', smallJson,  announcementRoutes);
// Landing-page feature showcase: public read + admin CRUD (largeJson — base64 images)
app.use('/api/showcase',      largeJson,  showcaseRoutes);
// Behavioural telemetry ingest (page views + tagged feature clicks) via sendBeacon
app.use('/api/activity',      smallJson,  activityRoutes);

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
  // Auto-complete any customer deploy that a previous panel restart/rebuild
  // interrupted (cert issued but not attached, status stuck deploying/pending).
  deployService.reconcileInterruptedDeploys().catch((err) =>
    logger.error('[Reconcile] startup reconcile failed:', (err as Error).message));
});

export default app;
