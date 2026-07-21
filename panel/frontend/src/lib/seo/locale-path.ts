/**
 * Maps a path to its counterpart in the other language, for the navbar
 * language switcher.
 *
 * Deliberately a hand-written table of slug strings rather than an import of
 * keywords.ts / keywords.en.ts. The switcher lives in the client-side Navbar,
 * and importing those datasets would ship ~60KB of landing-page prose into
 * every page's JS bundle to answer a question that only needs slug pairs.
 *
 * IMPORTANT - these pairs are a UX convenience, not translations. The Thai and
 * English landing pages target different queries and are not equivalent
 * documents, which is why only the two homepages carry reciprocal hreflang
 * (see lib/seo/site.ts). Do not turn this table into hreflang annotations:
 * declaring non-equivalent pages as translations makes Google discard the
 * whole annotation.
 *
 * When adding a landing page to either dataset, add its counterpart here too,
 * or the switcher will silently fall back to the hub.
 */

/** Thai landing slug -> nearest English landing slug (same topic cluster). */
const TH_TO_EN_LANDING: Record<string, string> = {
  'เช่าเว็บร้านค้ามายคราฟ': 'minecraft-webshop',
  'ระบบร้านค้ามายคราฟ': 'minecraft-webshop',
  'เว็บร้านค้ามายคราฟใช้โดเมนตัวเอง': 'minecraft-webshop',
  'เติมเงิน-promptpay-มายคราฟ': 'minecraft-payment-gateway-thailand',
  'รับ-truemoney-angpao-เซิร์ฟ': 'minecraft-payment-gateway-thailand',
  'ตรวจสลิปอัตโนมัติ-easyslip': 'minecraft-payment-gateway-thailand',
  'ส่งไอเทมอัตโนมัติ-rcon': 'minecraft-rcon-item-delivery',
  'bridge-plugin-เชื่อมเซิร์ฟ': 'minecraft-rcon-item-delivery',
  'กล่องสุ่ม-gacha-minecraft': 'minecraft-lootbox',
  'ระบบยศ-vip-minecraft': 'minecraft-rank-shop',
  'เว็บร้านค้าเซิร์ฟ-survival': 'minecraft-webshop-paper-purpur-velocity',
  'เว็บร้านค้าเซิร์ฟ-skyblock': 'minecraft-webshop-paper-purpur-velocity',
  'เว็บร้านค้าเซิร์ฟ-network': 'minecraft-webshop-paper-purpur-velocity',
  'ทางเลือกแทน-tebex': 'tebex-alternative',
  'วิธีเปิดร้านค้าในเซิร์ฟมายคราฟ': 'how-to-monetize-minecraft-server',
  'วิธีทําเงินจากเซิร์ฟมายคราฟ': 'how-to-monetize-minecraft-server',
};

/**
 * English -> Thai. Built by inverting the table above; several Thai pages map
 * to one English page, so the first Thai slug wins as the canonical way back.
 */
const EN_TO_TH_LANDING: Record<string, string> = Object.entries(TH_TO_EN_LANDING).reduce(
  (acc, [th, en]) => {
    if (!acc[en]) acc[en] = th;
    return acc;
  },
  {} as Record<string, string>,
);

export type Locale = 'th' | 'en';

/** Which language a path currently renders in. */
export function localeOf(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'th';
}

/**
 * Best destination for `pathname` in `target` language.
 *
 * Pages with no counterpart (dashboard, order, legal) resolve to that
 * language's home rather than 404ing or dead-ending the switcher.
 */
export function localePath(pathname: string, target: Locale): string {
  const current = localeOf(pathname);
  if (current === target) return pathname;

  // Strip any query/hash a caller passed in; the switcher navigates to the
  // document, and a Thai #pricing anchor does not exist on the English page.
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  if (target === 'en') {
    if (path === '/') return '/en';
    if (path === '/solutions') return '/en/solutions';
    if (path.startsWith('/lp/')) {
      const slug = decodeURIComponent(path.slice('/lp/'.length));
      const twin = TH_TO_EN_LANDING[slug];
      return twin ? `/en/lp/${twin}` : '/en/solutions';
    }
    return '/en';
  }

  if (path === '/en') return '/';
  if (path === '/en/solutions') return '/solutions';
  if (path.startsWith('/en/lp/')) {
    const slug = path.slice('/en/lp/'.length);
    const twin = EN_TO_TH_LANDING[slug];
    return twin ? `/lp/${encodeURIComponent(twin)}` : '/solutions';
  }
  return '/';
}

/**
 * True when the switch lands on a genuinely equivalent page. The switcher uses
 * this to avoid promising a translation it cannot deliver: for untranslated
 * areas it still navigates, but the UI says where it is going.
 */
export function hasDirectCounterpart(pathname: string, target: Locale): boolean {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (target === 'en') {
    if (path === '/' || path === '/solutions') return true;
    if (path.startsWith('/lp/')) return Boolean(TH_TO_EN_LANDING[decodeURIComponent(path.slice(4))]);
    return false;
  }
  if (path === '/en' || path === '/en/solutions') return true;
  if (path.startsWith('/en/lp/')) return Boolean(EN_TO_TH_LANDING[path.slice(7)]);
  return false;
}
