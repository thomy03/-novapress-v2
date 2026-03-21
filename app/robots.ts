import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/dev/', '/api/'],
      },
      // Allow AI crawlers explicitly
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      // NovaPressBot: our scraping bot - publishers can block with:
      // User-agent: NovaPressBot
      // Disallow: /
      { userAgent: 'NovaPressBot', allow: '/' },
    ],
    sitemap: 'https://novapressai.com/sitemap.xml',
  };
}
