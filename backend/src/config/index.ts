import { z } from 'zod';

const envSchema = z.object({
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.string().default('3306'),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_DATABASE: z.string().min(1),
  MYSQL_EXPOSED_PORT: z.string().optional(),
  MYSQL_HOSTNAME: z.string().optional(),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.string().default('6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  BACKEND_PORT: z.string().default('4000'),
  NODE_ENV: z.string().default('production'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('2000'),
  LOG_LEVEL: z.string().default('info'),
  EASYSLIP_API_KEY: z.string().optional(),
  // Panel base URL for the operator-announcements popup. All shops run on the
  // same host as the panel, so this defaults to the host gateway (works without
  // the optional bridge being configured).
  PANEL_ANNOUNCE_URL: z.string().optional(),
  // Bridge: when BRIDGE_ENABLED=true the shop authenticates web logins against
  // the customer's MC AuthMe DB (via the panel WS bridge) instead of the shop's
  // own authme table. Falls back to local authme when the bridge says
  // "unknown_user" or is unreachable, so legacy/pre-bridge web accounts keep working.
  BRIDGE_ENABLED:         z.string().optional(),
  BRIDGE_SUBSCRIPTION_ID: z.string().optional(),
  PANEL_BRIDGE_URL:       z.string().optional(),
  PANEL_BRIDGE_KEY:       z.string().optional(),
}).refine(
  (e) => {
    if (e.BRIDGE_ENABLED !== 'true') return true;
    return !!(e.BRIDGE_SUBSCRIPTION_ID && e.PANEL_BRIDGE_URL && e.PANEL_BRIDGE_KEY);
  },
  { message: 'BRIDGE_ENABLED=true requires BRIDGE_SUBSCRIPTION_ID, PANEL_BRIDGE_URL, PANEL_BRIDGE_KEY' }
);

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}
const env = parsed.data;

export const config = {
  port: parseInt(env.BACKEND_PORT, 10),
  nodeEnv: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN,
  logLevel: env.LOG_LEVEL,
  db: {
    host: env.MYSQL_HOST,
    port: parseInt(env.MYSQL_PORT, 10),
    exposedPort: env.MYSQL_EXPOSED_PORT ? parseInt(env.MYSQL_EXPOSED_PORT, 10) : null,
    hostname: env.MYSQL_HOSTNAME || null,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  },
  redis: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(env.RATE_LIMIT_MAX, 10),
  },
  easyslipApiKey: env.EASYSLIP_API_KEY || '',
  panelAnnounceUrl: env.PANEL_ANNOUNCE_URL || 'http://host.docker.internal:5000',
  bridge: {
    enabled: env.BRIDGE_ENABLED === 'true',
    subscriptionId: env.BRIDGE_SUBSCRIPTION_ID ? parseInt(env.BRIDGE_SUBSCRIPTION_ID, 10) : null,
    url: env.PANEL_BRIDGE_URL || null,
    key: env.PANEL_BRIDGE_KEY || null,
  },
};
