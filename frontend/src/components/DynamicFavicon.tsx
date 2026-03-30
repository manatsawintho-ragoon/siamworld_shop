'use client';
import { useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';

export default function DynamicFavicon() {
  const { settings } = useSettings();

  useEffect(() => {
    const faviconUrl = (settings.favicon_url !== undefined && settings.favicon_url !== '')
      ? settings.favicon_url
      : settings.logo_url;
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

  useEffect(() => {
    if (settings.shop_name) {
      document.title = `${settings.shop_name} | Minecraft Store`;
    }
  }, [settings.shop_name]);

  return null;
}
