'use client';

/* ── Coded product mockups ─────────────────────────────────────────────
   These replace the screenshots the landing page used to ship.

   The markup is transcribed from the running apps, not approximated:
   `DashboardMock` follows `panel/frontend/src/app/dashboard/page.tsx`, and the
   shop mockups follow `frontend/src/components/ProductCard.tsx` and the shop
   pages around it. Class names, radii, weights, badge shapes and Thai copy are
   the ones those screens actually use.

   Two details make them read as screenshots rather than as an impression of
   one:

   1. They are laid out at the real screen width and scaled down as a whole
      (see ScaledMock), so no size is ever re-guessed at a smaller scale.
   2. The shop mockups render inside `.shop-skin`, which carries the deployed
      shop's own green palette read from a live shop's stylesheet. The seller's
      panel is amber and the player's shop is green; showing both in amber
      would be showing a product that does not exist.

   Sample content is shaped like the real data (price, original_price,
   sold_count, category) at realistic price points, but the item names are
   generic. Putting a real customer's catalogue on our marketing page is not
   ours to do.

   Everything here is decorative: the surrounding section supplies the real
   heading and description, so the mocks are aria-hidden with nothing
   focusable inside. */

import { Icon, type IconName } from '@/components/ui/icon';
import { getTier, type TierKey } from '@/lib/rarity';
import ScaledMock from './ScaledMock';

/* ── Browser chrome ─────────────────────────────────────────────────── */

function Frame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="mock-frame h-full flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-lg">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/60 shrink-0">
        <span className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-muted-foreground/25" />
          <span className="w-3 h-3 rounded-full bg-muted-foreground/25" />
          <span className="w-3 h-3 rounded-full bg-muted-foreground/25" />
        </span>
        <span className="flex-1 min-w-0 mx-auto max-w-[60%] rounded-md bg-background border border-border px-3 py-1 text-[13px] text-muted-foreground text-center truncate">
          {url}
        </span>
        <span className="w-14 shrink-0" />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HERO: the seller's panel dashboard
   Transcribed from app/dashboard/page.tsx: the StatCard shape (14x14 rounded-2xl
   icon tile, 13px label, 3xl value, 12px sub), the shop table with its
   rounded-2xl cube tile and emerald price pill, and the wallet cluster.
   ══════════════════════════════════════════════════════════════════════ */

const DASH_STATS: { label: string; value: string; sub: string; icon: IconName; color: string }[] = [
  { label: 'ยอดเงินคงเหลือ', value: '฿1,240', sub: 'พร้อมใช้งานสำหรับแพ็กเกจ', icon: 'wallet', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { label: 'ร้านที่ออนไลน์', value: '2', sub: 'เซิร์ฟเวอร์เปิดใช้งานปกติ', icon: 'signal', color: 'bg-primary/10 text-primary border-primary/20' },
  { label: 'จำนวนร้านทั้งหมด', value: '2', sub: 'รวมแพ็กเกจที่หมดอายุ', icon: 'cubes', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { label: 'ศูนย์ซัพพอร์ต', value: 'ติดต่อ', sub: 'ทีมงานดูแลตลอด 24 ชม.', icon: 'headset', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
];

const DASH_SHOPS = [
  { name: 'mycraft', domain: 'mycraft.siamsite.shop', months: 3, price: '599', left: 'เหลือ 62 วัน' },
  { name: 'skyblock', domain: 'skyblock.siamsite.shop', months: 6, price: '1,099', left: 'เหลือ 148 วัน' },
];

export function DashboardMock() {
  return (
    <ScaledMock designWidth={1180} designHeight={760}>
      <Frame url="panel.siamsite.shop/dashboard">
        <div className="p-8 space-y-8 bg-background h-full">
          {/* Header row, as in the real dashboard: title + wallet cluster */}
          <div className="flex items-center justify-between gap-8">
            <div className="space-y-1">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <Icon name="sparkles" className="text-amber-500 text-xs" />
                ยินดีต้อนรับกลับมา, คุณ Manatsawin
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card border border-border shadow-sm">
              <span className="h-12 px-6 rounded-xl font-medium flex items-center gap-2 text-foreground">
                <Icon name="plus-circle" className="text-primary" /> เติมเงิน
              </span>
              <span className="h-6 w-px bg-border mx-1" />
              <span className="px-5 py-2 block">
                <span className="block text-[12px] font-medium text-muted-foreground">คงเหลือ</span>
                <span className="block text-lg font-semibold text-foreground">฿1,240</span>
              </span>
            </div>
          </div>

          {/* StatCards: same 14x14 tile, 3xl value, 12px sub as the real one */}
          <div className="grid grid-cols-4 gap-6">
            {DASH_STATS.map(s => (
              <div key={s.label} className="mock-tile bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 flex items-center gap-5">
                  <span className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl border shadow-sm ${s.color}`}>
                    <Icon name={s.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-muted-foreground mb-1">{s.label}</span>
                    <span className="mock-tile-value block text-3xl font-semibold text-foreground tracking-tight leading-none">{s.value}</span>
                    <span className="block text-[12px] font-medium text-muted-foreground/80 mt-1.5">{s.sub}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Shop table */}
          <div>
            <div className="flex items-end justify-between gap-6 mb-6">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground tracking-tight">การจัดการร้านค้า</h3>
                <div className="flex bg-card p-1.5 rounded-[1.25rem] border border-border shadow-sm">
                  {['ทั้งหมด', 'ใช้งานอยู่', 'หมดอายุ'].map((t, i) => (
                    <span
                      key={t}
                      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                        i === 0 ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground'
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <span className="relative w-80 block">
                <span className="absolute inset-y-0 left-4 flex items-center">
                  <Icon name="search" className="text-muted-foreground/60 text-sm" />
                </span>
                <span className="block w-full pl-11 pr-4 h-12 bg-card border border-border rounded-2xl text-sm font-medium text-muted-foreground/60 shadow-sm leading-[3rem]">
                  ค้นหาชื่อร้านหรือโดเมน...
                </span>
              </span>
            </div>

            <div className="bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-8 py-6 text-[13px] font-semibold text-muted-foreground">ข้อมูลร้านค้า</th>
                    <th className="px-6 py-6 text-[13px] font-semibold text-muted-foreground text-center">สถานะปัจจุบัน</th>
                    <th className="px-6 py-6 text-[13px] font-semibold text-muted-foreground">รายละเอียดแพ็กเกจ</th>
                    <th className="px-6 py-6 text-[13px] font-semibold text-muted-foreground">อายุการใช้งาน</th>
                    <th className="px-8 py-6 text-[13px] font-semibold text-muted-foreground text-right">แอคชั่น</th>
                  </tr>
                </thead>
                <tbody>
                  {DASH_SHOPS.map(s => (
                    <tr key={s.name} className="mock-row border-b border-border last:border-0">
                      <td className="px-8 py-6">
                        <span className="flex items-center gap-5">
                          <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 bg-secondary border-transparent text-muted-foreground">
                            <Icon name="cube" className="text-lg" />
                          </span>
                          <span>
                            <span className="block font-semibold text-foreground text-base tracking-tight leading-tight">{s.name}</span>
                            <span className="block text-[13px] font-medium text-muted-foreground mt-1 opacity-80">{s.domain}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          เปิดใช้งาน
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <span className="block text-sm font-semibold text-foreground">{s.months} เดือน</span>
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10 mt-1">
                          ฿{s.price}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <span className="p-3 bg-secondary/50 rounded-2xl border border-border/50 inline-block min-w-[140px] text-center text-[13px] font-medium text-foreground">
                          {s.left}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="flex justify-end items-center gap-3">
                          <span className="h-10 px-5 rounded-xl font-medium border border-border shadow-sm flex items-center text-sm text-foreground">โดเมน</span>
                          <span className="h-10 px-5 rounded-xl font-medium border border-border shadow-sm flex items-center text-sm text-foreground">จัดการ</span>
                          <span className="mock-buy h-10 px-5 rounded-xl font-semibold bg-foreground text-background flex items-center gap-2 text-sm">
                            <Icon name="bolt" className="text-[10px]" /> ต่ออายุ
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SHOP MOCKS
   Rendered inside `.shop-skin`, which carries the deployed shop's green
   palette. Class names follow frontend/src/components/ProductCard.tsx.
   ══════════════════════════════════════════════════════════════════════ */

/** The shop's navbar, as the deployed site renders it. */
function ShopNav({ active }: { active: string }) {
  const links = [
    { label: 'Home', sub: 'หน้าแรก', icon: 'house-signal' as IconName },
    { label: 'Itemshop', sub: 'ร้านค้าไอเท็ม', icon: 'shopping-cart' as IconName },
    { label: 'Gacha', sub: 'กล่องสุ่ม', icon: 'box-open' as IconName },
    { label: 'Topup', sub: 'เติมเงิน', icon: 'coins' as IconName },
  ];
  return (
    <div className="s-surface border-b s-border px-6 py-3 flex items-center gap-6">
      <span className="flex items-center gap-2 shrink-0">
        <span className="w-9 h-9 rounded-lg s-bg-primary grid place-items-center text-white">
          <Icon name="cube" />
        </span>
        <span className="s-fg font-bold text-[15px]">ระบบร้านค้ามายคราฟ</span>
      </span>
      <span className="flex items-center gap-1 ml-4">
        {links.map(l => (
          <span
            key={l.label}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${active === l.label ? 's-bg-primary text-white' : 's-fg-muted'}`}
          >
            <Icon name={l.icon} className="text-sm" />
            <span className="leading-none">
              <span className="block text-[13px] font-bold">{l.label}</span>
              <span className="block text-[10px] opacity-80">{l.sub}</span>
            </span>
          </span>
        ))}
      </span>
      <span className="ml-auto px-4 py-2 rounded-lg border s-border s-fg-muted text-[13px] font-bold">ล็อกอิน</span>
    </div>
  );
}

/** One product card, transcribed from ProductCard.tsx. */
function ProductCardMock({ name, price, original, sold, category }: {
  name: string; price: number; original?: number; sold: number; category: string;
}) {
  const discount = original ? Math.round((1 - price / original) * 100) : 0;
  return (
    <article className="mock-tile group relative flex flex-col s-surface border s-border rounded-xl overflow-hidden">
      <div className="relative aspect-[3/4] s-surface-hover overflow-hidden">
        <span className="absolute top-2 left-2 z-10 flex items-center gap-1 s-surface s-fg-muted text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border s-border">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'rgb(var(--color-shop-primary))' }} />
          {category}
        </span>
        {discount > 0 && (
          <span
            className="absolute top-2 right-2 z-10 flex items-center gap-1 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-lg"
            style={{ background: 'rgb(var(--color-error))' }}
          >
            <Icon name="tag" className="text-[9px]" /> -{discount}%
          </span>
        )}
        <span className="w-full h-full flex items-center justify-center">
          <Icon name="cube" className="text-5xl s-fg-subtle opacity-40" />
        </span>
        <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 py-6 flex items-end justify-between gap-2">
          {discount > 0 && original
            ? <span className="text-white/80 text-xs font-medium line-through tabular-nums leading-none">{original.toLocaleString()} ฿</span>
            : <span />}
          <span className="s-price-badge text-sm font-semibold px-3 py-2 rounded-lg tabular-nums leading-none shrink-0">
            {price.toLocaleString()} ฿
          </span>
        </span>
      </div>
      <div className="p-3 flex flex-col flex-1 s-surface relative z-10">
        <p className="s-fg font-bold text-sm leading-tight truncate">{name}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 w-fit">
          <Icon name="fire" className="text-[10px] text-orange-500" />
          <span className="text-[11px] font-bold text-orange-600">
            ขายแล้ว <span className="tabular-nums font-semibold">{sold.toLocaleString()}</span> ชิ้น
          </span>
        </span>
        <span className="inline-flex items-center gap-1 mt-1.5 mb-1 text-[10px] font-bold s-primary">
          <Icon name="circle-info" className="text-[9px]" /> ดูคำอธิบายสินค้า
        </span>
        <span className="s-btn-buy w-full mt-auto pt-3 pb-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 min-h-[40px]">
          <Icon name="shopping-cart" className="text-[11px]" /> ซื้อเลย!
        </span>
      </div>
    </article>
  );
}

const SHOP_ITEMS = [
  { name: '100 Crystal', price: 10, original: 15, sold: 119, category: 'Crystals' },
  { name: '490 Crystal', price: 49, sold: 27, category: 'Crystals' },
  { name: 'ยศ VIP 30 วัน', price: 149, original: 199, sold: 23, category: 'Ranks' },
  { name: 'Furniture Set', price: 25, original: 30, sold: 6, category: 'Furniture' },
  { name: 'ดาบเวทมนตร์', price: 89, sold: 41, category: 'Items' },
];

export function StorefrontMock() {
  return (
    <ScaledMock designWidth={1180} designHeight={760}>
      <Frame url="yourshop.siamsite.shop/shop">
        <div className="shop-skin h-full flex flex-col">
          <ShopNav active="Itemshop" />
          <div className="p-6 flex-1">
            <h1 className="text-xl font-bold s-fg flex items-center gap-2 mb-4">
              <Icon name="store" className="s-primary" /> ร้านค้าไอเท็ม
            </h1>
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {['ทั้งหมด', 'Crystals', 'Ranks', 'Furniture', 'Items'].map((c, i) => (
                <span
                  key={c}
                  className={`mock-chip px-3 py-1.5 rounded-lg text-[13px] font-bold border ${
                    i === 0 ? 's-bg-primary text-white border-transparent' : 's-surface s-fg-muted s-border'
                  }`}
                >
                  {c}
                </span>
              ))}
              <span className="ml-auto relative">
                <span className="block w-56 s-surface border s-border rounded-lg pl-8 pr-3 py-1.5 text-[13px] s-fg-subtle">
                  ค้นหาสินค้า...
                </span>
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs s-fg-subtle" />
              </span>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {SHOP_ITEMS.map(it => <ProductCardMock key={it.name} {...it} />)}
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

export function LootboxMock() {
  const reel: TierKey[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'rare', 'common', 'epic'];
  return (
    <ScaledMock designWidth={1180} designHeight={760}>
      <Frame url="yourshop.siamsite.shop/lootbox">
        <div className="shop-skin h-full flex flex-col">
          <ShopNav active="Gacha" />
          <div className="p-6 flex-1 flex flex-col">
            <h1 className="text-xl font-bold s-fg flex items-center gap-2 mb-4">
              <Icon name="box-open" className="s-primary" /> กล่องสุ่ม
            </h1>

            <div className="relative s-surface border s-border rounded-xl overflow-hidden mb-5">
              <div className="flex gap-3 p-5">
                {reel.map((t, i) => {
                  const tier = getTier(t);
                  return (
                    <div
                      key={i}
                      className="mock-reel-item w-[120px] shrink-0 rounded-xl border-2 flex flex-col items-center justify-center py-6 gap-2"
                      style={{ borderColor: tier.color, backgroundColor: `${tier.color}14` }}
                    >
                      <Icon name={tier.icon} className="text-2xl" style={{ color: tier.color }} />
                      <span className="text-[11px] font-bold" style={{ color: tier.color }}>{tier.label}</span>
                    </div>
                  );
                })}
              </div>
              <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2" style={{ background: 'rgb(var(--color-shop-primary))' }} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { name: 'กล่องธรรมดา', price: 29 },
                { name: 'กล่องพรีเมียม', price: 99 },
                { name: 'กล่องตำนาน', price: 249 },
              ].map(b => (
                <div key={b.name} className="mock-tile s-surface border s-border rounded-xl p-4 flex flex-col items-center gap-3">
                  <span className="w-16 h-16 rounded-xl s-surface-hover grid place-items-center">
                    <Icon name="gift" className="text-2xl s-primary" />
                  </span>
                  <span className="s-fg font-bold text-sm">{b.name}</span>
                  <span className="s-btn-buy w-full py-2.5 text-xs font-bold rounded-lg text-center">
                    เปิดกล่อง {b.price} ฿
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

export function InventoryMock() {
  const slots: { tier: TierKey; name: string; claimed: boolean }[] = [
    { tier: 'legendary', name: 'ดาบมังกร', claimed: false },
    { tier: 'epic', name: 'เกราะเพชร', claimed: false },
    { tier: 'rare', name: 'คทาน้ำแข็ง', claimed: true },
    { tier: 'uncommon', name: 'โล่เหล็ก', claimed: true },
    { tier: 'common', name: 'คบเพลิง x16', claimed: true },
    { tier: 'epic', name: 'ปีกนางฟ้า', claimed: false },
  ];
  return (
    <ScaledMock designWidth={1180} designHeight={760}>
      <Frame url="yourshop.siamsite.shop/inventory">
        <div className="shop-skin h-full flex flex-col">
          <ShopNav active="Home" />
          <div className="p-6 flex-1">
            <h1 className="text-xl font-bold s-fg flex items-center gap-2 mb-4">
              <Icon name="archive" className="s-primary" /> คลังเว็บของคุณ
            </h1>
            <div className="grid grid-cols-3 gap-4">
              {slots.map(s => {
                const tier = getTier(s.tier);
                return (
                  <div key={s.name} className="mock-tile s-surface border s-border rounded-xl p-4 flex items-center gap-4">
                    <span
                      className="w-14 h-14 rounded-xl grid place-items-center shrink-0 border-2"
                      style={{ backgroundColor: `${tier.color}14`, borderColor: tier.color, color: tier.color }}
                    >
                      <Icon name={tier.icon} className="text-xl" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block s-fg font-bold text-sm truncate">{s.name}</span>
                      <span className="block text-[11px] font-bold mt-0.5" style={{ color: tier.color }}>{tier.label}</span>
                    </span>
                    {s.claimed ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-500/12 text-emerald-600 shrink-0">รับแล้ว</span>
                    ) : (
                      <span className="s-btn-buy text-[11px] font-bold px-3 py-2 rounded-lg shrink-0">รับเข้าเกม</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

export function TopupMock() {
  return (
    <ScaledMock designWidth={1180} designHeight={760}>
      <Frame url="yourshop.siamsite.shop/topup">
        <div className="shop-skin h-full flex flex-col">
          <ShopNav active="Topup" />
          <div className="p-6 flex-1">
            <h1 className="text-xl font-bold s-fg flex items-center gap-2 mb-4">
              <Icon name="coins" className="s-primary" /> เติมเงินเข้ากระเป๋า
            </h1>
            <div className="grid grid-cols-2 gap-6">
              <div className="s-surface border s-border rounded-xl p-5 space-y-4">
                <div className="flex gap-2">
                  <span className="flex-1 py-2.5 rounded-lg text-center text-[13px] font-bold s-bg-primary text-white">PromptPay</span>
                  <span className="flex-1 py-2.5 rounded-lg text-center text-[13px] font-bold border s-border s-fg-muted">TrueMoney อั่งเปา</span>
                </div>
                <span className="block text-[13px] font-bold s-fg-muted">เลือกจำนวนเงิน</span>
                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 300, 500, 1000, 2000].map((a, i) => (
                    <span
                      key={a}
                      className={`mock-tile py-2.5 rounded-lg text-center text-[13px] font-bold border tabular-nums ${
                        i === 1 ? 's-bg-primary text-white border-transparent' : 's-surface s-fg s-border'
                      }`}
                    >
                      {a.toLocaleString()} ฿
                    </span>
                  ))}
                </div>
                <span className="s-btn-buy block w-full py-3 rounded-lg text-center text-sm font-bold">
                  สร้าง QR ชำระเงิน
                </span>
              </div>
              <div className="s-surface border s-border rounded-xl p-5 flex flex-col items-center justify-center gap-4">
                {/* A QR stand-in, not a scannable code: a real one on a marketing
                    page would be a payment target nobody controls. */}
                <span className="w-40 h-40 rounded-xl grid place-items-center" style={{ background: 'rgb(var(--color-fg))' }}>
                  <Icon name="qrcode" className="text-6xl" style={{ color: 'rgb(var(--color-surface))' }} />
                </span>
                <span className="block text-sm font-bold s-fg">สแกนแล้วอัปโหลดสลิป</span>
                <span className="block text-[13px] s-fg-muted text-center">ระบบตรวจสลิปอัตโนมัติ เงินเข้าภายในไม่กี่วินาที</span>
                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-500/12 text-emerald-600">ตรวจสอบอัตโนมัติ 24 ชม.</span>
              </div>
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

export function ShopAdminMock() {
  const rows = [
    { player: 'Kiritoz', item: 'ยศ VIP 30 วัน', price: '฿149' },
    { player: 'MinnieCraft', item: '490 Crystal', price: '฿49' },
    { player: 'BankZaa', item: 'Furniture Set', price: '฿25' },
    { player: 'NongMint', item: 'ดาบเวทมนตร์', price: '฿89' },
  ];
  return (
    <ScaledMock designWidth={1180} designHeight={760}>
      <Frame url="yourshop.siamsite.shop/admin">
        <div className="shop-skin h-full flex">
          <div className="w-56 shrink-0 s-surface border-r s-border p-4 space-y-1">
            <span className="block s-fg font-bold text-sm px-3 py-2">จัดการร้านค้า</span>
            {['ภาพรวม', 'สินค้า', 'กล่องสุ่ม', 'คำสั่งซื้อ', 'ผู้ใช้งาน', 'ตั้งค่า'].map((m, i) => (
              <span
                key={m}
                className={`block px-3 py-2 rounded-lg text-[13px] font-bold ${i === 3 ? 's-bg-primary text-white' : 's-fg-muted'}`}
              >
                {m}
              </span>
            ))}
          </div>
          <div className="flex-1 p-6 space-y-5 min-w-0">
            <div className="grid grid-cols-3 gap-4">
              {[
                { l: 'ยอดขายวันนี้', v: '฿3,280' },
                { l: 'คำสั่งซื้อ', v: '18' },
                { l: 'ผู้เล่นออนไลน์', v: '42' },
              ].map(s => (
                <div key={s.l} className="mock-tile s-surface border s-border rounded-xl p-4">
                  <span className="block text-[13px] font-bold s-fg-muted">{s.l}</span>
                  <span className="mock-tile-value block text-2xl font-bold s-fg tabular-nums mt-1">{s.v}</span>
                </div>
              ))}
            </div>
            <div className="s-surface border s-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b s-border flex items-center justify-between">
                <span className="text-sm font-bold s-fg">คำสั่งซื้อล่าสุด</span>
                <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-500/12 text-emerald-600">ส่งเข้าเกมอัตโนมัติ</span>
              </div>
              {rows.map(r => (
                <div key={r.player} className="mock-row flex items-center gap-4 px-4 py-3 border-b s-border last:border-0">
                  <span className="w-9 h-9 rounded-lg s-surface-hover grid place-items-center text-[13px] font-bold s-fg shrink-0">
                    {r.player.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold s-fg truncate">{r.player}</span>
                    <span className="block text-[11px] s-fg-muted truncate">{r.item}</span>
                  </span>
                  <span className="text-[13px] font-bold s-fg tabular-nums shrink-0">{r.price}</span>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-500/12 text-emerald-600 shrink-0">ส่งแล้ว</span>
                  <Icon name="chevron-right" className="mock-row-arrow text-[11px] s-fg-subtle shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

/* ── Showcase slide set ───────────────────────────────────────────────
   Used when the operator has not uploaded their own screenshots in
   /admin/showcase. Uploaded slides always win. */

export interface MockSlide {
  key: string;
  title: string;
  desc: string;
  Mock: () => React.ReactElement;
}

export const MOCK_SLIDES: MockSlide[] = [
  {
    key: 'storefront',
    title: 'หน้าร้านที่ผู้เล่นเห็น',
    desc: 'จัดหมวดหมู่ ตั้งราคา ตั้งส่วนลด และเปิดขายได้เองทั้งหมด ผู้เล่นกดซื้อแล้วของเข้าเกมทันที',
    Mock: StorefrontMock,
  },
  {
    key: 'shop-admin',
    title: 'หลังร้านสำหรับเจ้าของเซิร์ฟเวอร์',
    desc: 'ดูยอดขาย คำสั่งซื้อ และผู้เล่นออนไลน์ได้จากที่เดียว ทุกคำสั่งซื้อส่งเข้าเกมอัตโนมัติ',
    Mock: ShopAdminMock,
  },
  {
    key: 'lootbox',
    title: 'กล่องสุ่มพร้อมแอนิเมชั่น',
    desc: 'ระบบสุ่มแบบ CS:GO พร้อมระดับความหายาก ตั้งอัตราการออกของแต่ละชิ้นได้เอง',
    Mock: LootboxMock,
  },
  {
    key: 'inventory',
    title: 'คลังเว็บ เก็บของไว้รับทีหลัง',
    desc: 'ผู้เล่นสุ่มได้ตอนไม่ได้ออนไลน์ก็ไม่หาย เก็บไว้ในคลังแล้วกดรับเข้าเกมเมื่อไหร่ก็ได้',
    Mock: InventoryMock,
  },
  {
    key: 'topup',
    title: 'เติมเงินและตรวจสลิปอัตโนมัติ',
    desc: 'รองรับ PromptPay และ TrueMoney อั่งเปา ระบบตรวจสลิปให้เอง ไม่ต้องนั่งเฝ้า',
    Mock: TopupMock,
  },
  {
    key: 'dashboard',
    title: 'แผงควบคุมร้านค้าของคุณ',
    desc: 'จัดการทุกร้านที่คุณเปิด ดูวันหมดอายุ ต่ออายุ และตั้งโดเมนของตัวเองได้จากหน้าเดียว',
    Mock: DashboardMock,
  },
];
