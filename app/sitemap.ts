import { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: 'https://novapress.ai', lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: 'https://novapress.ai/brief', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://novapress.ai/live', lastModified: new Date(), changeFrequency: 'always', priority: 0.8 },
    { url: 'https://novapress.ai/cortex', lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: 'https://novapress.ai/landing', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  ];

  let synthesesRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/syntheses?limit=50`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      synthesesRoutes = (data.data || []).map((s: { id: string; createdAt?: string }) => ({
        url: `https://novapress.ai/synthesis/${s.id}`,
        lastModified: s.createdAt ? new Date(s.createdAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }
  } catch {
    // Silently fail - static routes are still returned
  }

  return [...staticRoutes, ...synthesesRoutes];
}
