'use client';

/* ── Coded product mockups ─────────────────────────────────────────────
   These replace the screenshots the landing page used to ship. A screenshot
   of a dashboard is a picture of a product; these are the product's own
   markup, so they inherit the real tokens, follow light and dark mode, stay
   sharp at any density, and above all they respond to the pointer. Hovering a
   stat tile or an order row does something, which is the closest a landing
   page gets to letting someone try the thing.

   Everything here is decorative in the accessibility sense: the surrounding
   section supplies the real heading and description, so each mock is marked
   aria-hidden and holds no focusable elements. The numbers are illustrative
   and deliberately unremarkable, not claims about any real shop.

   Fidelity to the shipped UI is the point. When the dashboard or shop
   changes shape, these should follow. */

import { Icon, type IconName } from '@/components/ui/icon';
import { getTier, type TierKey } from '@/lib/rarity';

/* ── Shared chrome ──────────────────────────────────────────────────── */

/** Browser frame. Signals "this is the real web app" without a screenshot,
 *  and gives every mock the same outer silhouette. */
function Frame({ url, children, className = '' }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mock-frame rounded-2xl border border-border bg-card overflow-hidden shadow-lg ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/60">
        <span className="flex gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/25" />
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/25" />
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/25" />
        </span>
        <span className="flex-1 min-w-0 mx-auto max-w-[70%] rounded-md bg-background border border-border px-2.5 py-1 text-[11px] text-muted-foreground text-center truncate">
          {url}
        </span>
        <span className="w-10 shrink-0" />
      </div>
      {children}
    </div>
  );
}

/** Status pill. Same three states the real order list uses. */
function Chip({ tone, children }: { tone: 'ok' | 'wait' | 'info'; children: React.ReactNode }) {
  const tones = {
    ok: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    wait: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
    info: 'bg-primary/12 text-primary',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ── Hero: the seller's dashboard ────────────────────────────────────
   The most characteristic screen in the product, and the one a prospective
   shop owner is actually buying. Tiles lift and take the accent border on
   hover; order rows highlight and slide their chevron. */

const HERO_STATS: { label: string; value: string; delta: string }[] = [
  { label: 'ยอดขายวันนี้', value: '฿3,280', delta: '+12%' },
  { label: 'ผู้เล่นออนไลน์', value: '42', delta: 'สด' },
  { label: 'คำสั่งซื้อ', value: '18', delta: 'ส่งครบ' },
];

const HERO_ORDERS: { player: string; item: string; price: string }[] = [
  { player: 'Kiritoz', item: 'ยศ VIP 30 วัน', price: '฿149' },
  { player: 'MinnieCraft', item: 'กล่องสุ่มระดับ EPIC', price: '฿79' },
  { player: 'BankZaa', item: 'เพชร x64', price: '฿35' },
];

export function DashboardMock() {
  return (
    <Frame url="yourshop.siamsite.shop/dashboard">
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate">แดชบอร์ดร้านค้า</p>
            <p className="text-[12px] text-muted-foreground">อัปเดตล่าสุดเมื่อสักครู่</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px] font-medium text-foreground shrink-0">
            <span className="mock-live w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ออนไลน์
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {HERO_STATS.map(s => (
            <div key={s.label} className="mock-tile rounded-xl border border-border bg-background p-2.5 sm:p-3">
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              <p className="mock-tile-value text-base sm:text-xl font-semibold text-foreground tabular-nums mt-0.5">{s.value}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{s.delta}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50">
            <p className="text-[12px] font-medium text-foreground">คำสั่งซื้อล่าสุด</p>
            <span className="text-[11px] text-muted-foreground">ส่งเข้าเกมอัตโนมัติ</span>
          </div>
          <ul className="divide-y divide-border">
            {HERO_ORDERS.map(o => (
              <li key={o.player} className="mock-row flex items-center gap-3 px-3 py-2.5">
                <span className="w-7 h-7 rounded-md bg-secondary text-secondary-foreground grid place-items-center text-[12px] font-semibold shrink-0">
                  {o.player.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground truncate">{o.player}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">{o.item}</span>
                </span>
                <span className="text-[13px] font-medium text-foreground tabular-nums shrink-0">{o.price}</span>
                <Chip tone="ok">ส่งแล้ว</Chip>
                <Icon name="chevron-right" className="mock-row-arrow text-[11px] text-muted-foreground shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

/* ── Showcase mocks ──────────────────────────────────────────────────
   One per feature the shop actually ships. Kept to the same frame and
   spacing so the carousel does not jump between slides. */

export function StorefrontMock() {
  const items = [
    { name: 'ยศ VIP', price: '฿149', tone: 'info' as const },
    { name: 'เพชร x64', price: '฿35', tone: 'ok' as const },
    { name: 'ดาบเวทย์', price: '฿89', tone: 'info' as const },
  ];
  return (
    <Frame url="yourshop.siamsite.shop">
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="rounded-xl bg-primary/10 border border-primary/25 p-3.5">
          <p className="text-[13px] font-semibold text-foreground">ยินดีต้อนรับสู่เซิร์ฟเวอร์</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">เติมเงินและรับของเข้าเกมได้ตลอด 24 ชม.</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['ทั้งหมด', 'ยศ', 'ไอเท็ม', 'กล่องสุ่ม'].map((c, i) => (
            <span
              key={c}
              className={`mock-chip rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                i === 0 ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {items.map(it => (
            <div key={it.name} className="mock-tile rounded-xl border border-border bg-background overflow-hidden">
              <div className="h-12 sm:h-14 bg-secondary grid place-items-center">
                <Icon name="cube" className="text-lg text-muted-foreground/50" />
              </div>
              <div className="p-2">
                <p className="text-[12px] font-medium text-foreground truncate">{it.name}</p>
                <p className="text-[12px] text-primary font-semibold tabular-nums">{it.price}</p>
                <span className="mock-buy mt-1.5 block rounded-md bg-primary text-primary-foreground text-center text-[11px] font-medium py-1">
                  ซื้อ
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function LootboxMock() {
  /* Rarity colours come from the shared map, never redefined here, so the
     mock and the real loot box always agree on what EPIC looks like. */
  const reel: TierKey[] = ['common', 'rare', 'epic', 'legendary', 'uncommon', 'rare'];
  return (
    <Frame url="yourshop.siamsite.shop/lootbox">
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-foreground">กล่องสุ่มประจำเดือน</p>
          <Chip tone="wait">เปิดได้ 3 ครั้ง</Chip>
        </div>

        <div className="relative rounded-xl border border-border bg-background overflow-hidden">
          <div className="flex gap-2 p-3 overflow-hidden">
            {reel.map((t, i) => {
              const tier = getTier(t);
              return (
                <div
                  key={i}
                  className="mock-reel-item w-14 sm:w-16 shrink-0 rounded-lg border-2 grid place-items-center py-3"
                  style={{ borderColor: tier.color, backgroundColor: `${tier.color}14` }}
                >
                  <Icon name={tier.icon} className="text-base" style={{ color: tier.color }} />
                  <span className="text-[9px] font-semibold mt-1" style={{ color: tier.color }}>{tier.label}</span>
                </div>
              );
            })}
          </div>
          {/* Centre marker: the reel stops here, exactly like the real spinner. */}
          <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary" />
        </div>

        <span className="mock-buy block rounded-lg bg-primary text-primary-foreground text-center text-[13px] font-semibold py-2">
          เปิดกล่อง
        </span>
      </div>
    </Frame>
  );
}

export function InventoryMock() {
  const slots: { tier: TierKey; name: string; claimed: boolean }[] = [
    { tier: 'legendary', name: 'ดาบมังกร', claimed: false },
    { tier: 'epic', name: 'เกราะเพชร', claimed: false },
    { tier: 'rare', name: 'คทาน้ำแข็ง', claimed: true },
    { tier: 'uncommon', name: 'โล่เหล็ก', claimed: true },
  ];
  return (
    <Frame url="yourshop.siamsite.shop/inventory">
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-foreground">คลังเว็บของคุณ</p>
          <span className="text-[12px] text-muted-foreground">4 ชิ้น</span>
        </div>
        <ul className="space-y-2">
          {slots.map(s => {
            const tier = getTier(s.tier);
            return (
              <li key={s.name} className="mock-row flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span
                  className="w-8 h-8 rounded-md grid place-items-center shrink-0"
                  style={{ backgroundColor: `${tier.color}1a`, color: tier.color }}
                >
                  <Icon name={tier.icon} className="text-[13px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground truncate">{s.name}</span>
                  <span className="block text-[11px]" style={{ color: tier.color }}>{tier.label}</span>
                </span>
                {s.claimed
                  ? <Chip tone="ok">รับแล้ว</Chip>
                  : <span className="mock-buy rounded-md bg-primary text-primary-foreground text-[11px] font-medium px-2.5 py-1">รับเข้าเกม</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </Frame>
  );
}

export function TopupMock() {
  return (
    <Frame url="yourshop.siamsite.shop/topup">
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <p className="text-[13px] font-medium text-foreground">เลือกจำนวนเงิน</p>
          {['฿50', '฿100', '฿300'].map((a, i) => (
            <div
              key={a}
              className={`mock-tile rounded-lg border px-3 py-2 text-[13px] font-medium tabular-nums ${
                i === 1 ? 'border-primary bg-primary/8 text-primary' : 'border-border text-foreground'
              }`}
            >
              {a}
            </div>
          ))}
          <div className="flex gap-1.5 pt-0.5">
            <Chip tone="info">PromptPay</Chip>
            <Chip tone="ok">อั่งเปา</Chip>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-3 flex flex-col items-center justify-center gap-2">
          {/* A QR stand-in, not a scannable code: a real one on a marketing
              page would be a payment target nobody controls. */}
          <span className="w-20 h-20 rounded-md bg-foreground/90 grid place-items-center">
            <Icon name="qrcode" className="text-3xl text-background" />
          </span>
          <p className="text-[11px] text-muted-foreground text-center">สแกนแล้วระบบตรวจสลิปให้เอง</p>
          <Chip tone="ok">เงินเข้าใน 5 วินาที</Chip>
        </div>
      </div>
    </Frame>
  );
}

export function ThemeMock() {
  const themes = [
    { name: 'Amber', color: '#f59e0b' },
    { name: 'Emerald', color: '#10b981' },
    { name: 'Violet', color: '#8b5cf6' },
    { name: 'Rose', color: '#f43f5e' },
  ];
  return (
    <Frame url="yourshop.siamsite.shop/admin/appearance">
      <div className="p-4 sm:p-5 space-y-3.5">
        <p className="text-[15px] font-semibold text-foreground">ปรับธีมร้านค้า</p>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t, i) => (
            <div
              key={t.name}
              className={`mock-tile rounded-lg border p-2 text-center ${i === 0 ? 'border-primary' : 'border-border'}`}
            >
              <span className="block w-full h-7 rounded-md" style={{ backgroundColor: t.color }} />
              <span className="block text-[11px] text-muted-foreground mt-1.5 truncate">{t.name}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-background p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">ตัวอย่าง</p>
          <div className="h-2 rounded-full bg-primary w-3/4" />
          <div className="h-2 rounded-full bg-secondary w-1/2" />
          <span className="mock-buy inline-block rounded-md bg-primary text-primary-foreground text-[11px] font-medium px-3 py-1">
            ปุ่มหลัก
          </span>
        </div>
      </div>
    </Frame>
  );
}

export function RconMock() {
  const lines = [
    { t: 'ok', text: 'เชื่อมต่อเซิร์ฟเวอร์สำเร็จ' },
    { t: 'run', text: 'lp user Kiritoz parent add vip' },
    { t: 'ok', text: 'ส่ง ยศ VIP ให้ Kiritoz แล้ว' },
    { t: 'run', text: 'give MinnieCraft diamond 64' },
    { t: 'ok', text: 'ส่ง เพชร x64 แล้ว' },
  ];
  return (
    <Frame url="yourshop.siamsite.shop/admin/servers">
      <div className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-foreground">ส่งของผ่าน RCON</p>
          <Chip tone="ok">
            <span className="mock-live w-1.5 h-1.5 rounded-full bg-emerald-500" />
            เชื่อมต่ออยู่
          </Chip>
        </div>
        <ul className="rounded-xl border border-border bg-background divide-y divide-border font-mono">
          {lines.map((l, i) => (
            <li key={i} className="mock-row flex items-start gap-2 px-3 py-1.5">
              <Icon
                name={l.t === 'ok' ? 'circle-check' : 'chevron-right'}
                className={`text-[11px] mt-0.5 shrink-0 ${l.t === 'ok' ? 'text-emerald-500' : 'text-muted-foreground'}`}
              />
              <span className={`text-[11px] break-all ${l.t === 'ok' ? 'text-foreground' : 'text-muted-foreground'}`}>
                {l.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/* ── Showcase slide set ───────────────────────────────────────────────
   Used when the operator has not uploaded their own screenshots in
   /admin/showcase. Uploaded slides always win: this is the fallback, not a
   replacement for that feature. */

export interface MockSlide {
  key: string;
  title: string;
  desc: string;
  icon: IconName;
  Mock: () => React.ReactElement;
}

export const MOCK_SLIDES: MockSlide[] = [
  {
    key: 'storefront',
    title: 'หน้าร้านที่ผู้เล่นเห็น',
    desc: 'จัดหมวดหมู่ ตั้งราคา และเปิดขายได้เองทั้งหมด ผู้เล่นกดซื้อแล้วของเข้าเกมทันที',
    icon: 'store',
    Mock: StorefrontMock,
  },
  {
    key: 'dashboard',
    title: 'แดชบอร์ดสำหรับเจ้าของร้าน',
    desc: 'ดูยอดขาย คำสั่งซื้อ และผู้เล่นออนไลน์ได้จากที่เดียว ไม่ต้องเปิดคอนโซลเซิร์ฟเวอร์',
    icon: 'gauge-high',
    Mock: DashboardMock,
  },
  {
    key: 'lootbox',
    title: 'กล่องสุ่มพร้อมแอนิเมชั่น',
    desc: 'ระบบสุ่มแบบ CS:GO พร้อมระดับความหายาก ตั้งอัตราการออกได้เอง',
    icon: 'box-open',
    Mock: LootboxMock,
  },
  {
    key: 'inventory',
    title: 'คลังเว็บ เก็บของไว้รับทีหลัง',
    desc: 'ผู้เล่นสุ่มได้ตอนไม่ได้ออนไลน์ก็ไม่หาย เก็บไว้ในคลังแล้วกดรับเข้าเกมเมื่อไหร่ก็ได้',
    icon: 'archive',
    Mock: InventoryMock,
  },
  {
    key: 'topup',
    title: 'เติมเงินและตรวจสลิปอัตโนมัติ',
    desc: 'รองรับ PromptPay และ TrueMoney อั่งเปา ระบบตรวจสลิปให้เอง ไม่ต้องนั่งเฝ้า',
    icon: 'qrcode',
    Mock: TopupMock,
  },
  {
    key: 'rcon',
    title: 'ส่งของเข้าเกมผ่าน RCON',
    desc: 'เชื่อมเซิร์ฟเวอร์ด้วยปลั๊กอิน ไม่ต้องเปิดพอร์ต ส่งของแล้วมี log ให้ตรวจย้อนหลัง',
    icon: 'terminal',
    Mock: RconMock,
  },
  {
    key: 'theme',
    title: 'ปรับธีมให้เข้ากับเซิร์ฟเวอร์',
    desc: 'เปลี่ยนสีหลักและรูปแบบร้านได้เอง รองรับทั้งโหมดสว่างและโหมดมืด',
    icon: 'wand-magic-sparkles',
    Mock: ThemeMock,
  },
];
