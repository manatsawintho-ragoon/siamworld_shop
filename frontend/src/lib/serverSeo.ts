import { headers } from 'next/headers';

/**
 * Server-only SEO helpers for the multi-tenant shop. Each shop runs as its own
 * container behind its own domain (subdomain or custom domain). We resolve the
 * shop identity at request time from the `host` header so metadata/sitemap/robots
 * are correct per tenant without baking the domain into the build.
 */

export interface PublicSlide {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
}

export interface ShopSeo {
  shopName: string;
  description: string;
  title?: string;
  keywords?: string;
  logoUrl?: string;
  faviconUrl?: string;
  serverIp?: string;
  googleVerification?: string;
  baseUrl: string;
  /** The raw public settings map, so the client context can start populated. */
  settings: Record<string, string>;
}

const DEFAULT_NAME = 'ร้านค้า Minecraft';

/** Absolute origin for the current request, e.g. https://shop.example.com */
export function getRequestOrigin(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Fetch the shop's public settings server-side. Prefers the internal backend URL
 * (no Cloudflare round-trip), falls back to the public host. Never throws; returns
 * sensible defaults so metadata generation cannot break the page render.
 */
export async function fetchShopSeo(): Promise<ShopSeo> {
  const baseUrl = getRequestOrigin();
  const internal = process.env.BACKEND_INTERNAL_URL;
  const endpoints = [
    internal ? `${internal}/api/public/settings` : null,
    `${baseUrl}/api/public/settings`,
  ].filter(Boolean) as string[];

  let s: Record<string, string> = {};
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { next: { revalidate: 300 } });
      if (!res.ok) continue;
      const data = await res.json();
      s = data?.settings || {};
      if (Object.keys(s).length) break;
    } catch {
      /* try next endpoint */
    }
  }

  const shopName = s.shop_name?.trim() || DEFAULT_NAME;
  const description =
    s.seo_description?.trim() ||
    s.shop_description?.trim() ||
    `${shopName} - ร้านค้า Minecraft เติมเงินอัตโนมัติ รับไอเทมทันที 24 ชั่วโมง รองรับ PromptPay และ TrueMoney ปลอดภัย รวดเร็ว`;

  return {
    shopName,
    description,
    title: s.seo_title?.trim() || undefined,
    keywords: s.seo_keywords?.trim() || undefined,
    logoUrl: s.logo_url?.trim() || s.website_logo_url?.trim() || undefined,
    faviconUrl: s.favicon_url?.trim() || undefined,
    serverIp: s.server_ip?.trim() || undefined,
    googleVerification: s.google_site_verification?.trim() || undefined,
    baseUrl,
    settings: s,
  };
}

/**
 * Fetch the hero slides server-side.
 *
 * The home page used to discover these from the browser, which put the whole
 * client bundle on the critical path before the LCP image was even requested:
 * Lighthouse attributed 44% of a 12.9s LCP to that load delay. Fetching here
 * means the first slide is in the initial HTML, so its preload link ships with
 * the document.
 *
 * Same shape as fetchShopSeo: internal backend first, public host as fallback,
 * never throws. An empty list just means the page renders without a carousel,
 * exactly as it did before the slides resolved.
 */
export async function fetchPublicSlides(): Promise<PublicSlide[]> {
  const internal = process.env.BACKEND_INTERNAL_URL;
  const endpoints = [
    internal ? `${internal}/api/public/slides` : null,
    `${getRequestOrigin()}/api/public/slides`,
  ].filter(Boolean) as string[];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.slides)) return data.slides as PublicSlide[];
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}
