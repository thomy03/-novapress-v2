import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  images: {
    // Allow any external image (for news sources)
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      // Le Monde
      {
        protocol: 'https',
        hostname: 'img.lemde.fr',
        pathname: '/**',
      },
      // CNN
      {
        protocol: 'https',
        hostname: 'media.cnn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cnn.com',
        pathname: '/**',
      },
      // BBC
      {
        protocol: 'https',
        hostname: 'ichef.bbci.co.uk',
        pathname: '/**',
      },
      // Reuters
      {
        protocol: 'https',
        hostname: 'www.reuters.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudfront-us-east-2.images.arcpublishing.com',
        pathname: '/**',
      },
      // The Guardian
      {
        protocol: 'https',
        hostname: 'i.guim.co.uk',
        pathname: '/**',
      },
      // NYT
      {
        protocol: 'https',
        hostname: 'static01.nyt.com',
        pathname: '/**',
      },
      // Washington Post
      {
        protocol: 'https',
        hostname: 'www.washingtonpost.com',
        pathname: '/**',
      },
      // Le Figaro
      {
        protocol: 'https',
        hostname: 'i.f1g.fr',
        pathname: '/**',
      },
      // Libération
      {
        protocol: 'https',
        hostname: 'www.liberation.fr',
        pathname: '/**',
      },
      // Unsplash
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
        pathname: '/**',
      },
      // Fallback - allow any https image
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
