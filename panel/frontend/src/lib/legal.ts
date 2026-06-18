// ── Shared legal / policy metadata ──────────────────────────────────────────
// Single source of truth for every legal page, the registration consent
// checkbox, and the footer links. Bump LEGAL_VERSION whenever the substance of
// any policy changes — the backend records this string against each signup so
// we can prove which version a user agreed to (PDPA / e-transaction evidence).

export const LEGAL_VERSION = '2026-06-18';

/** Human-readable last-updated date (Buddhist Era, Thai). */
export const LEGAL_UPDATED_TH = '18 มิถุนายน 2569';

/** The operator. SIAMSITE STORE currently operates as an individual (บุคคลธรรมดา). */
export const OPERATOR = {
  name: 'SIAMSITE STORE',
  nameTh: 'สยามไซต์สโตร์ (SIAMSITE STORE)',
  status: 'ผู้ให้บริการในนามบุคคลธรรมดา',
  service: 'Siamsite Panel',
  domain: 'panel.siamsite.shop',
} as const;

/** Published contact channels for legal, privacy (PDPA) and support requests. */
export const CONTACT = {
  email: 'support@siamsite.shop',
  altEmail: 'gameculling@gmail.com',
  facebook: 'https://www.facebook.com/siamsitestore',
  facebookLabel: 'facebook.com/siamsitestore',
  discord: 'https://discord.gg/HysqVHra5n',
  discordLabel: 'discord.gg/HysqVHra5n',
} as const;

export interface LegalDoc {
  slug: string;
  href: string;
  title: string;
  short: string;
}

/** The five policies a user must acknowledge at registration. */
export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'terms',
    href: '/terms',
    title: 'ข้อกำหนดการใช้บริการ',
    short: 'เงื่อนไขการใช้แพลตฟอร์ม Siamsite Panel',
  },
  {
    slug: 'privacy',
    href: '/privacy',
    title: 'นโยบายความเป็นส่วนตัว',
    short: 'การเก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคลตาม PDPA',
  },
  {
    slug: 'shop-owner-agreement',
    href: '/shop-owner-agreement',
    title: 'ข้อตกลงเจ้าของร้าน',
    short: 'สิทธิ หน้าที่ และความรับผิดชอบของผู้เปิดร้าน',
  },
  {
    slug: 'payment-policy',
    href: '/payment-policy',
    title: 'นโยบายการชำระเงินและการจ่ายเงิน',
    short: 'การชำระค่าบริการ การรับเงินจากลูกค้า และการคืนเงิน',
  },
  {
    slug: 'prohibited-content',
    href: '/prohibited-content',
    title: 'นโยบายสินค้าและเนื้อหาต้องห้าม',
    short: 'รายการสินค้า บริการ และเนื้อหาที่ห้ามจำหน่าย',
  },
];
