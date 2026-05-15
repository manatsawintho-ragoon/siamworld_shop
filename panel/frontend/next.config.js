/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
