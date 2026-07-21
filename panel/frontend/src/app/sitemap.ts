import { MetadataRoute } from 'next';
import { LANDING_PAGES } from '@/lib/seo/keywords';
import { EN_LANDING_PAGES } from '@/lib/seo/keywords.en';
import { SITE_URL } from '@/lib/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const now = new Date();

  // The two homepages are translations of each other, so each declares the
  // pair. Deeper pages are not 1:1 translations (the Thai and English keyword
  // sets target different queries), so they are listed without alternates
  // rather than with a non-reciprocal pair, which Google discards anyway.
  const homeAlternates = {
    languages: {
      'th-TH': `${baseUrl}/`,
      en: `${baseUrl}/en`,
      'x-default': `${baseUrl}/`,
    },
  };

  const core: MetadataRoute.Sitemap = [
    // Only canonical, indexable URLs belong here. Fragment links (#promo,
    // #pricing) and ?kind= variants are the same documents as / and /order,
    // so listing them just splits signals across duplicates.
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1.0, alternates: homeAlternates },
    { url: `${baseUrl}/solutions`,   lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${baseUrl}/order`,       lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/privacy`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/shop-owner-agreement`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/payment-policy`,       lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/prohibited-content`,   lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/contact`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const english: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/en`, lastModified: now, changeFrequency: 'weekly', priority: 0.95, alternates: homeAlternates },
    { url: `${baseUrl}/en/solutions`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
  ];

  // Programmatic keyword landing pages (white-hat). Each is a unique, useful page.
  const thaiLandings: MetadataRoute.Sitemap = LANDING_PAGES.map((p) => ({
    url: `${baseUrl}/lp/${encodeURIComponent(p.slug)}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const englishLandings: MetadataRoute.Sitemap = EN_LANDING_PAGES.map((p) => ({
    url: `${baseUrl}/en/lp/${p.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...core, ...english, ...thaiLandings, ...englishLandings];
}
