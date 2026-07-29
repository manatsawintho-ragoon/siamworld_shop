import { MetadataRoute } from 'next';
import { getRequestOrigin } from '@/lib/serverSeo';

// Per-tenant sitemap: absolute URLs built from the request host so each shop's
// sitemap is valid on its own domain (no build-time base URL needed).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getRequestOrigin();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,         lastModified: now, changeFrequency: 'daily',   priority: 1 },
    { url: `${baseUrl}/shop`,     lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${baseUrl}/lootbox`,  lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/topup`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/rewards`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${baseUrl}/news`,     lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${baseUrl}/download`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Published articles, best-effort. A failed fetch just omits them - the
  // sitemap must never break the render.
  const newsRoutes: MetadataRoute.Sitemap = [];
  try {
    const internal = process.env.BACKEND_INTERNAL_URL;
    const path = '/api/public/news?limit=100';
    const url = internal ? `${internal}${path}` : `${baseUrl}${path}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      for (const n of (data?.news || []) as { slug: string; publishedAt?: string }[]) {
        if (!n.slug) continue;
        newsRoutes.push({
          url: `${baseUrl}/news/${n.slug}`,
          lastModified: n.publishedAt ? new Date(n.publishedAt) : now,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch { /* omit news from sitemap on failure */ }

  return [...staticRoutes, ...newsRoutes];
}
