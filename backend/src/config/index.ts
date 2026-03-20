import { z } from 'zod';

const envSchema = z.object({
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.string().default('3306'),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_DATABASE: z.string().min(1),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.string().default('6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  BACKEND_PORT: z.string().default('4000'),
  NODE_ENV: z.string().default('production'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX: z.string().default('100'),
  LOG_LEVEL: z.string().default('info'),
});

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
};
