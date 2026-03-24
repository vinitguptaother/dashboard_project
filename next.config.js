/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Compiler optimizations
  compiler: {
    // Remove console statements in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Reduce noise from development warnings
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

module.exports = nextConfig;
