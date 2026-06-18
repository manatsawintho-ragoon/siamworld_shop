import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://panel.siamsite.shop';

  const now = new Date();
  return [
    { url: baseUrl,                  lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/#promo`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.95 },
    { url: `${baseUrl}/#pricing`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${baseUrl}/order`,       lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/order?kind=trial`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/order?kind=intro`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/privacy`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/shop-owner-agreement`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/payment-policy`,       lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/prohibited-content`,   lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/contact`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
