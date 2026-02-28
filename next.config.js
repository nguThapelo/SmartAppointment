/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Proxy only specific external API paths
      {
        source: '/api/external/:path*', // External API requests
        destination: 'http://185.220.204.117:2606/Flexify/api/:path*', // Backend server
      },
      // Internal API paths remain handled by Next.js
    ];
  },
};

module.exports = nextConfig;