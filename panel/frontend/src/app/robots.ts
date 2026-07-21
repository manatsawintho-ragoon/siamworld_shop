import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /dashboard is an authenticated surface. It was crawlable before:
      // Googlebot cannot log in, so it indexes the login redirect instead,
      // producing near-duplicate thin pages that compete with the real
      // marketing pages. /delete-account is a destructive action page that has
      // no business appearing in an index at all.
      disallow: ['/api/', '/admin/', '/dashboard/', '/delete-account'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
