/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Image optimization
  images: {
    // Remote patterns for external images (new API, replaces domains)
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'source.unsplash.com', pathname: '/**' },
      // Le Monde
      { protocol: 'https', hostname: 'img.lemde.fr', pathname: '/**' },
      // CNN
      { protocol: 'https', hostname: 'media.cnn.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.cnn.com', pathname: '/**' },
      // BBC
      { protocol: 'https', hostname: 'ichef.bbci.co.uk', pathname: '/**' },
      // Reuters
      { protocol: 'https', hostname: 'www.reuters.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cloudfront-us-east-2.images.arcpublishing.com', pathname: '/**' },
      // The Guardian
      { protocol: 'https', hostname: 'i.guim.co.uk', pathname: '/**' },
      // NYT
      { protocol: 'https', hostname: 'static01.nyt.com', pathname: '/**' },
      // Washington Post
      { protocol: 'https', hostname: 'www.washingtonpost.com', pathname: '/**' },
      // Le Figaro
      { protocol: 'https', hostname: 'i.f1g.fr', pathname: '/**' },
      // Libération
      { protocol: 'https', hostname: 'www.liberation.fr', pathname: '/**' },
      // Fallback removed for security - explicitly add domains as needed
      // { protocol: 'https', hostname: '**', pathname: '/**' },
    ],
    // Image formats to support
    formats: ['image/webp', 'image/avif'],
    // Image sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Performance optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Split chunks for better caching
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Vendor chunks
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
          // Common chunks
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },

  // Headers for better caching and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          // HSTS - enforce HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:5000 ws://localhost:5000;"
          }
        ],
      },
      {
        // Cache static assets
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
      {
        // Service Worker
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ],
      }
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '2.0.0',
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },

  // Performance budgets
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;