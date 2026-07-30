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
      // Everything behind a session, plus the two password routes (an indexed
      // reset form is a phishing target) and the icon/cache endpoints, which
      // are infrastructure rather than pages.
      disallow: [
        '/api/', '/admin/', '/profile/', '/inventory/', '/redeem/',
        '/forgot-password', '/reset-password', '/site-icon', '/revalidate',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
