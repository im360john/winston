/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.WINSTON_API_URL || 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
