import { MetadataRoute } from 'next';
import { getRequestOrigin } from '@/lib/serverSeo';

// Per-tenant robots: resolve the shop's own origin at request time so the sitemap
// reference and host are correct for both subdomains and custom domains.
export default function robots(): MetadataRoute.Robots {
  const origin = getRequestOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/profile/', '/inventory/'],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
