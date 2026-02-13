/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  // NOTE: Do not rewrite `/api/*` to Winston API.
  // This app implements its own Next route handlers under `/api/*` (proxying selectively),
  // and a blanket rewrite breaks those handlers in production.
};

module.exports = nextConfig;
