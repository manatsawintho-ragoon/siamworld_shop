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
    // Inlines the rules the first paint actually needs and defers the rest of
    // the stylesheet. The full sheet was the entire critical path: the document
    // finished at 669ms and First Contentful Paint waited until the 23KB CSS
    // landed at 2.47s, with Lighthouse measuring 19KB of it unused above the
    // fold. Needs the `critters` dependency.
    optimizeCss: true,
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
    // Shop owners paste artwork URLs from wherever they host them, but this list
    // may NOT go back to `hostname: '**'`.
    //
    // `**` over http+https made /_next/image an open, UNAUTHENTICATED proxy: any
    // visitor could hand the shop an arbitrary URL and have the Next container
    // fetch it from inside our network — `http://backend:4000/...`,
    // `http://169.254.169.254/...`, any RFC1918 host — and infer from the
    // success/error/timing difference what is listening. It also let anyone use
    // the shop as a free image-laundering hop for someone else's bandwidth.
    //
    // The entries below cover every host in use across the live shops (audited
    // against products/loot_boxes/loot_box_items/slides/settings), plus the
    // mainstream image hosts owners reach for. https only: an owner URL is
    // effectively always https, while the interesting internal targets are http.
    //
    // WHEN AN OWNER REPORTS A BROKEN IMAGE, add their host here rather than
    // widening the pattern back to '**'.
    remotePatterns: [
      // In use on live shops today.
      { protocol: 'https', hostname: '**.postimg.cc' },
      { protocol: 'https', hostname: 'postimg.cc' },
      { protocol: 'https', hostname: '**.pic.in.th' },
      { protocol: 'https', hostname: 'pic.in.th' },
      { protocol: 'https', hostname: '**.canva.com' },
      { protocol: 'https', hostname: 'minecraft-max.net' },
      { protocol: 'https', hostname: '**.gifcen.com' },
      { protocol: 'https', hostname: 'www.gifcen.com' },
      // Mainstream hosts owners commonly paste.
      { protocol: 'https', hostname: '**.imgur.com' },
      { protocol: 'https', hostname: 'imgur.com' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: '**.discordapp.com' },
      { protocol: 'https', hostname: '**.discordapp.net' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.imgbb.com' },
      { protocol: 'https', hostname: '**.siamsite.shop' },
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
    // Default imageSizes stop at 384 and deviceSizes start at 640, so a request
    // for ~450px was rounded up to 640 - measured at 26KB of AVIF where 384
    // needed 12.6KB. 512 fills the gap for the card artwork.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
  },
};

module.exports = nextConfig;
