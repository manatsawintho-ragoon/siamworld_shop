import { MetadataRoute } from 'next';
import { fetchShopSeo, getRequestOrigin, isFeatureEnabled } from '@/lib/serverSeo';

// Per-tenant sitemap: absolute URLs built from the request host so each shop's
// sitemap is valid on its own domain (no build-time base URL needed).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getRequestOrigin();
  const now = new Date();
  const { settings } = await fetchShopSeo();

  // Only routes the shop actually has switched on. A sitemap that lists a
  // disabled feature is submitting a redirect to Search Console, and until the
  // toggles were enforced on the routes themselves it was worse than that: it
  // was inviting crawlers into a section the owner had deliberately hidden.
  const newsEnabled = isFeatureEnabled(settings, 'show_news_nav');
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,      lastModified: now, changeFrequency: 'daily',  priority: 1 },
    { url: `${baseUrl}/shop`,  lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
    { url: `${baseUrl}/topup`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...(isFeatureEnabled(settings, 'show_lootbox_nav')
      ? [{ url: `${baseUrl}/lootbox`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 }] : []),
    ...(isFeatureEnabled(settings, 'show_rewards_nav')
      ? [{ url: `${baseUrl}/rewards`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 }] : []),
    ...(newsEnabled
      ? [{ url: `${baseUrl}/news`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 }] : []),
    ...(isFeatureEnabled(settings, 'show_download_nav')
      ? [{ url: `${baseUrl}/download`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 }] : []),
  ];

  // Published articles, best-effort. A failed fetch just omits them - the
  // sitemap must never break the render.
  const newsRoutes: MetadataRoute.Sitemap = [];
  if (newsEnabled) {
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
  }

  return [...staticRoutes, ...newsRoutes];
}
