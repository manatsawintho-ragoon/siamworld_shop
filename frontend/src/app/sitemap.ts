import { MetadataRoute } from 'next';
import { getRequestOrigin } from '@/lib/serverSeo';

// Per-tenant sitemap: absolute URLs built from the request host so each shop's
// sitemap is valid on its own domain (no build-time base URL needed).
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getRequestOrigin();
  const now = new Date();
  return [
    { url: `${baseUrl}/`,         lastModified: now, changeFrequency: 'daily',   priority: 1 },
    { url: `${baseUrl}/shop`,     lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${baseUrl}/lootbox`,  lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/topup`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/download`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
