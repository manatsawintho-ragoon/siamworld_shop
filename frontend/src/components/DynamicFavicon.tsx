'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';

/**
 * Route a shop's own favicon through our image optimizer instead of hot-linking
 * it. Owners paste these URLs from whatever host they used, and the raw files
 * are usually full-size artwork: one live shop points at a 549KB Canva PNG, and
 * fetching it cross-origin also pulled that host's cookies onto the page (which
 * Lighthouse counts under third-party cookies). Same-origin and re-encoded at
 * 64px, it costs about 2KB and sets nothing.
 *
 * Data URIs and same-origin paths are passed through untouched: there is nothing
 * to optimize and /_next/image rejects them.
 */
function proxied(url: string): string {
  if (url.startsWith('data:') || url.startsWith('/')) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=64&q=75`;
}

export default function DynamicFavicon() {
  const { settings } = useSettings();
  const pathname = usePathname();

  useEffect(() => {
    const raw = (settings.favicon_url !== undefined && settings.favicon_url !== '')
      ? settings.favicon_url
      : settings.logo_url;
    const faviconUrl = raw ? proxied(raw) : raw;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!faviconUrl) {
      if (link) link.href = 'data:,';
      return;
    }

    if (link) {
      link.href = faviconUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl;
      document.head.appendChild(newLink);
    }
  }, [settings.favicon_url, settings.logo_url]);

  // Re-apply title on every navigation so Next.js router doesn't override it
  useEffect(() => {
    if (settings.shop_name) {
      document.title = `${settings.shop_name} | Minecraft Store`;
    }
  }, [settings.shop_name, pathname]);

  return null;
}
