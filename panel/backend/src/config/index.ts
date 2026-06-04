import dotenv from 'dotenv';
dotenv.config();

function required(key: string, minLength = 0): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  if (minLength > 0 && val.length < minLength) {
    throw new Error(`${key} must be at least ${minLength} characters`);
  }
  return val;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

export const config = {
  nodeEnv:      optional('NODE_ENV', 'development'),
  port:         parseInt(optional('PANEL_BACKEND_PORT', '5000')),

  mysql: {
    host:     optional('PANEL_MYSQL_HOST', 'localhost'),
    port:     parseInt(optional('PANEL_MYSQL_PORT', '3306')),
    user:     optional('PANEL_MYSQL_USER', 'panel'),
    password: optional('PANEL_MYSQL_PASSWORD', ''),
    database: optional('PANEL_MYSQL_DATABASE', 'siamworld_panel'),
  },

  redis: {
    host: optional('PANEL_REDIS_HOST', 'localhost'),
    port: parseInt(optional('PANEL_REDIS_PORT', '6380')),
  },

  // Require min 32 chars to prevent weak secrets in production
  jwtSecret:     required('PANEL_JWT_SECRET', 32),
  jwtExpiresIn:  optional('PANEL_JWT_EXPIRES_IN', '24h'),

  // Comma-separated allowed origins, e.g. "https://panel.siamsite.shop,http://localhost:3000"
  corsOrigin:    optional('PANEL_CORS_ORIGIN', 'http://localhost:3000'),

  google: {
    clientId:     optional('GOOGLE_CLIENT_ID', ''),
    clientSecret: optional('GOOGLE_CLIENT_SECRET', ''),
    // Callback routes through the Next.js proxy (FRONTEND_URL/api/...) so it never hits
    // the api-panel subdomain directly — avoids Cloudflare SSL 525 on that subdomain.
    callbackUrl:  optional('GOOGLE_CALLBACK_URL', `${optional('FRONTEND_URL', 'https://panel.siamsite.shop')}/api/auth/google/callback`),
  },

  facebook: {
    appId:        optional('FACEBOOK_CLIENT_ID', ''),
    appSecret:    optional('FACEBOOK_CLIENT_SECRET', ''),
    callbackUrl:  optional('FACEBOOK_CALLBACK_URL', `${optional('FRONTEND_URL', 'https://panel.siamsite.shop')}/api/auth/facebook/callback`),
  },

  urls: {
    frontend:     optional('FRONTEND_URL', 'https://panel.siamsite.shop'),
    backend:      optional('BACKEND_URL', 'https://api-panel.siamsite.shop'),
  },

  // Path to the deploy directory on host
  deployDir:     optional('DEPLOY_DIR', '/app/deploy'),
  sourceRoot:    optional('SOURCE_ROOT', '/app'),

  // DNS-only subdomain for MySQL (AuthMe plugin access, bypasses Cloudflare proxy)
  mysqlHostname: optional('MYSQL_HOSTNAME', ''),
};
