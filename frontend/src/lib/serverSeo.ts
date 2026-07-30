import { headers, cookies } from 'next/headers';

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

/** Everything the home page paints above and just below the fold. */
export interface HomeData {
  slides: PublicSlide[];
  servers: unknown[];
  lootboxes: unknown[];
  recentBuy: unknown[];
  recentBox: unknown[];
  popularItems: unknown[];
  newArrivals: unknown[];
}

export interface RankEntry { username: string; total_topup: number; }
export interface DailyEntry { username: string; total_topup: number; last_topup: string; }
export interface PublicRankings { ranking: RankEntry[]; daily: DailyEntry[]; }

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

/** Cache tag for the shop's public settings. Invalidated by POST /revalidate. */
export const SETTINGS_TAG = 'shop-settings';

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
      // Tagged so an admin save can drop this entry on the spot. Without the
      // tag the 300s window meant a visibility toggle looked broken: the admin
      // flipped it, reloaded the shop, and saw no change for five minutes,
      // because every page is server-rendered from this cached copy and
      // SettingsProvider does not re-fetch once it has been seeded.
      const res = await fetch(url, { next: { revalidate: 300, tags: [SETTINGS_TAG] } });
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
 * Whether an admin visibility toggle is on, using the same rule as the client
 * (`(settings[key] ?? '1') === '1'`): unset means visible, so a shop that has
 * never opened the settings page keeps every feature it had before the toggle
 * existed. Note the `??` is deliberate rather than `||` - the admin panel writes
 * an empty string for some keys, and an empty string means off, not unset.
 */
export function isFeatureEnabled(settings: Record<string, string>, key: string): boolean {
  return (settings[key] ?? '1') === '1';
}

/**
 * One list endpoint, tried on the internal backend first and the public host
 * second, returning [] rather than throwing. Shared by every seeding helper
 * below; `revalidate` is per-caller because the data ages at different rates.
 */
async function fetchList<T>(path: string, key: string, revalidate: number): Promise<T[]> {
  const internal = process.env.BACKEND_INTERNAL_URL;
  for (const base of [internal, getRequestOrigin()].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`${base}/api/${path}`, { next: { revalidate } });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.[key])) return data[key] as T[];
    } catch {
      /* try next endpoint */
    }
  }
  return [];
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
  return fetchList<PublicSlide>('public/slides', 'slides', 60);
}

/**
 * Fetch every list the home page renders, server-side.
 *
 * The page used to discover all seven from the browser after hydration. Two
 * things followed from that: the skeletons and the real content are different
 * heights, so the footer under them moved twice as the responses landed (0.079
 * CLS on desktop, which alone capped both Performance and Agentic Browsing), and
 * the product grids were absent from the HTML a crawler sees.
 *
 * All seven run concurrently and each is independently cached, so a warm cache
 * adds nothing to the response and a cold one costs a single round trip to a
 * backend on the same Docker network. A failed fetch yields an empty list, which
 * renders exactly as the page did before its data arrived.
 */
export async function fetchHomeData(): Promise<HomeData> {
  const [slides, servers, lootboxes, recentBuy, recentBox, popularItems, newArrivals] =
    await Promise.all([
      fetchList<PublicSlide>('public/slides', 'slides', 60),
      fetchList('public/servers', 'servers', 30),
      fetchList('shop/lootboxes', 'boxes', 60),
      // Activity feeds: short cache, they are the one thing on the page that is
      // meant to look live.
      fetchList('public/recent-purchases', 'purchases', 15),
      fetchList('public/recent-lootbox', 'openings', 15),
      fetchList('public/products/popular', 'products', 60),
      fetchList('public/products/new-arrivals', 'products', 60),
    ]);
  return { slides, servers, lootboxes, recentBuy, recentBox, popularItems, newArrivals };
}

/** The /shop page's three lists. */
export interface ShopPageData {
  products: unknown[];
  categories: unknown[];
  servers: unknown[];
}

/**
 * Fetch the catalogue for /shop, server-side.
 *
 * Same reason as fetchHomeData: the page rendered a skeleton on the server and
 * swapped it for the real grid after hydration, which changed the column height
 * by ~700px and moved the footer with it. Measured at 0.34 CLS, easily the worst
 * shift left on the site once the home page was seeded.
 */
export async function fetchShopPageData(): Promise<ShopPageData> {
  const [products, categories, servers] = await Promise.all([
    fetchList('public/products', 'products', 60),
    fetchList('public/categories', 'categories', 300),
    fetchList('public/servers', 'servers', 30),
  ]);
  return { products, categories, servers };
}

/** Loot boxes for /lootbox, server-side, for the same reason. */
export async function fetchLootBoxes(): Promise<unknown[]> {
  return fetchList('shop/lootboxes', 'boxes', 60);
}

/**
 * Resolve the signed-in user server-side, or null.
 *
 * The session is an httpOnly cookie, which means this is answerable before the
 * response is sent - the client did not have to be the one to ask. It was: the
 * member card rendered neither its logged-in contents nor its login form while
 * `loading` was true, so the card grew when /auth/session came back and pushed
 * the ranking widgets beneath it down the page. That was the last layout shift
 * left on desktop.
 *
 * Never cached (`no-store`): the response is per-user, and a shared cache entry
 * here would hand one visitor another's profile. Returns null on any failure, so
 * a backend hiccup renders the page as logged out rather than not at all - the
 * client refetch that follows will correct it.
 */
export async function fetchSessionUser(): Promise<unknown | null> {
  const cookie = cookies().toString();
  if (!cookie.includes('auth_token=')) return null; // anonymous: skip the round trip

  const internal = process.env.BACKEND_INTERNAL_URL;
  for (const base of [internal, getRequestOrigin()].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`${base}/api/auth/session`, {
        headers: { cookie },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const data = await res.json();
      return data?.user ?? null;
    } catch {
      /* try next endpoint */
    }
  }
  return null;
}

/**
 * Fetch the sidebar top-up rankings server-side.
 *
 * The TOPUP RANK card is hidden until its list has at least one entry, so on a
 * client-only fetch it appeared after hydration and pushed the DAILY TOPUP card
 * beneath it down the page. Lighthouse scored that single shift at 0.079 CLS on
 * desktop, which cost both Performance and Agentic Browsing. Seeding from the
 * root layout means the card is in the first paint at its final height.
 *
 * Both lists are small (10 rows each) and change slowly, so a 60s cache keeps
 * this off the per-request path for every page.
 */
export async function fetchPublicRankings(): Promise<PublicRankings> {
  const [ranking, daily] = await Promise.all([
    fetchList<RankEntry>('public/topup-ranking', 'ranking', 60),
    fetchList<DailyEntry>('public/daily-topup', 'daily', 60),
  ]);
  return { ranking, daily };
}
