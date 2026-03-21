/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
