/** @type {import('next').NextConfig} */
// Security headers applied to every response. CSP keeps 'unsafe-inline' because
// Next's App Router injects inline bootstrap scripts without a nonce; the high-value
// lockdowns here are frame-ancestors (clickjacking), object-src, base-uri and
// form-action. Resource allowlists cover Google Fonts + Font Awesome CDN + the
// same-origin API and per-tenant WebSocket.
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
      // fonts.gstatic.com is gone from font-src: Inter and Prompt are now
      // self-hosted by next/font. cdnjs stays for the Font Awesome webfonts,
      // which still load inside the admin shell.
      "font-src 'self' data: https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      // static.cloudflareinsights.com is the Web Analytics beacon Cloudflare
      // injects into the response. Without it here the browser blocks the
      // script and logs a CSP violation on every page load, which Lighthouse
      // counts against both errors-in-console and inspector-issues. The panel
      // already allows it; this keeps the two apps consistent.
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "connect-src 'self' https: wss:",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    // Rewrites `import { X } from 'lucide-react'` to a direct per-icon import so
    // a page pulls in only the icons it renders. Without it the barrel file puts
    // the whole set in the module graph and the bundler has to prove each icon
    // unused, which it does not always manage.
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Proxy /api/* to backend so browsers never call localhost:4000 directly
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      (process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
        : 'http://localhost:4000');
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  images: {
    // Shop owners paste artwork URLs from wherever they host them, so the
    // allowlist has to stay open.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    // AVIF first, WebP second. Owner-uploaded slide art is routinely a
    // multi-megabyte PNG; re-encoding it accounted for ~1.1MB of the image
    // savings Lighthouse reported on the home page.
    formats: ['image/avif', 'image/webp'],
    // Serving remote art through our own origin also drops the third-party
    // cookies those hosts set, which Lighthouse counts under Best Practices.
    // 24h is long enough to matter without pinning stale artwork after an
    // owner swaps a slide.
    minimumCacheTTL: 86400,
  },
};

module.exports = nextConfig;
