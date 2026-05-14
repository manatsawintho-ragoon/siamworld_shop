import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/profile/', '/inventory/'],
    },
    // Note: We don't have a hardcoded domain here as it's a multi-tenant shop template.
    // The individual shop owners will have their own domains.
  };
}
