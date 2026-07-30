import { MetadataRoute } from 'next';
import { fetchShopSeo } from '@/lib/serverSeo';
import { THEMES, DEFAULT_THEME_ID } from '@/lib/themeCss';

/**
 * Per-tenant web app manifest.
 *
 * Without one, a player who adds the shop to their phone's home screen gets the
 * page URL as the label and a screenshot as the icon. With it they get the
 * shop's own name and favicon, and the browser chrome picks up the theme colour
 * the owner chose - which is the difference between something that looks like a
 * bookmark and something that looks like the shop's app.
 *
 * Resolved from the request host like the rest of the metadata, so each shop
 * gets its own without anything being baked in at build time.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const seo = await fetchShopSeo();
  const theme = THEMES.find(t => t.id === (seo.settings.theme_name || DEFAULT_THEME_ID)) ?? THEMES[0];
  const icon = seo.faviconUrl || seo.logoUrl;

  // Read the theme's real background rather than guessing light/dark, so the
  // splash screen matches the page the shop actually paints. `vars` stores
  // channels ("15 23 42") for use inside rgb(), which the manifest will not
  // accept, so it has to be spelled out.
  const rgb = (key: string, fallback: string) => {
    const channels = (theme.vars[key] ?? fallback).trim().split(/\s+/).map(Number);
    if (channels.length !== 3 || channels.some(n => !Number.isFinite(n))) return `rgb(${fallback})`;
    return `rgb(${channels.join(', ')})`;
  };
  const background = rgb('--color-background', theme.isDark ? '11 15 20' : '255 255 255');

  // Home-screen labels get about 12 characters before the launcher truncates.
  // Cut on a word boundary rather than mid-word: "MChanom Store" should become
  // "MChanom", not "MChanom Stor".
  const shortName = seo.shopName.length <= 12
    ? seo.shopName
    : (seo.shopName.slice(0, 12).replace(/\s+\S*$/, '') || seo.shopName.slice(0, 12));

  return {
    name: seo.shopName,
    short_name: shortName,
    description: seo.description,
    start_url: '/',
    display: 'standalone',
    background_color: background,
    theme_color: background,
    lang: 'th',
    icons: icon
      ? [
          // Same PNG-producing route the favicon uses. Android insists on a
          // raster icon here, which is the other reason the SVG fallback alone
          // was not enough.
          { src: '/site-icon?size=192', sizes: '192x192', type: 'image/png' },
          { src: '/site-icon?size=512', sizes: '512x512', type: 'image/png' },
        ]
      : [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
