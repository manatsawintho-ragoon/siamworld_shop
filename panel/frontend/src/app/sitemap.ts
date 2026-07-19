import { MetadataRoute } from 'next';
import { LANDING_PAGES } from '@/lib/seo/keywords';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://panel.siamsite.shop';

  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    // Only canonical, indexable URLs belong here. Fragment links (#promo,
    // #pricing) and ?kind= variants are the same documents as / and /order,
    // so listing them just splits signals across duplicates.
    { url: baseUrl,                  lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/solutions`,   lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${baseUrl}/order`,       lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/privacy`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/shop-owner-agreement`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/payment-policy`,       lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/prohibited-content`,   lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/contact`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  // Programmatic keyword landing pages (white-hat). Each is a unique, useful page.
  const landings: MetadataRoute.Sitemap = LANDING_PAGES.map((p) => ({
    url: `${baseUrl}/lp/${encodeURIComponent(p.slug)}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...core, ...landings];
}
