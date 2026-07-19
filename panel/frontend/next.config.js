/** @type {import('next').NextConfig} */
// Security headers for every response. CSP keeps 'unsafe-inline' (Next injects
// inline bootstrap scripts without a nonce); the hard lockdowns are frame-ancestors,
// object-src, base-uri and form-action. Panel uses Google Fonts (Kanit) and inline
// lucide SVG (no icon CDN), talks to the same-origin API, and does OAuth via
// top-level redirects (unaffected by form-action).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https: wss:",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // standalone mode normally requires `sharp` for runtime image optimization. Our assets are
  // pre-sized (logo trimmed to 256px, screenshots already at display res), so we skip the
  // runtime optimizer entirely. Saves ~30MB of node_modules and avoids "sharp missing" errors.
  images: { unoptimized: true },
  // Proxy /api/* server-to-server so the browser never calls the backend directly.
  // PANEL_BACKEND_INTERNAL_URL is injected at container start (Docker environment:).
  // Falls back to localhost:5000 for local dev.
  async rewrites() {
    const backendUrl = process.env.PANEL_BACKEND_INTERNAL_URL || 'http://localhost:5000';
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
};
module.exports = nextConfig;
