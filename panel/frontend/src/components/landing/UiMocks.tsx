'use client';

/* ── Coded product mockups ─────────────────────────────────────────────
   These replace the screenshots the landing page used to ship.

   The markup is transcribed from the customer website's own source, not
   approximated: `DashboardMock` follows `frontend/src/app/admin/page.tsx` and
   `admin/layout.tsx`, and the shop mockups follow
   `frontend/src/components/ProductCard.tsx` and the shop pages around it.
   Class names, radii, weights, shadow values, badge shapes and Thai copy are
   the ones those screens actually use.

   Two details make them read as screenshots rather than as an impression of
   one:

   1. They are laid out at the real screen width and scaled down as a whole
      (see ScaledMock), so no size is ever re-guessed at a smaller scale.
   2. Each screen gets its own real palette. The player-facing shop renders
      inside `.shop-skin`, carrying the green tokens read off a live shop's
      stylesheet. The shop's admin area has a fixed palette of its own (dark
      #18191c sidebar, #f4f5f7 work area, #f97316 accent) and does not follow
      any theme, so that mock is fixed too. Rendering either in the panel's
      amber would be showing a product that does not exist.

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
   HERO: the shop's own admin dashboard

   Transcribed from `frontend/src/app/admin/page.tsx` and `admin/layout.tsx`,
   which is the screen a server owner actually spends their time in.

   Its palette is fixed and does not follow a theme, so this mock is fixed too:
   a #18191c sidebar with a #22c55e wordmark beside a #f4f5f7 work area, orange
   #f97316 for chart and counts, and the green #168d41 top-up card. The chunky
   `0 4px 0` bottom shadow on every card is that screen's signature, so it is
   reproduced exactly rather than softened into a normal drop shadow.

   The shop app draws with Font Awesome; the panel dropped that CDN for a
   lucide registry, so icons are mapped to their closest lucide equivalent.
   That is the one place these mocks knowingly differ from the original.
   ══════════════════════════════════════════════════════════════════════ */

/** The card shadow used by every panel on the shop's admin dashboard. */
const SHOP_CARD = 'bg-white rounded-2xl border border-gray-200/70 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)]';

const SHOP_SIDEBAR: { label: string; icon: IconName; active?: boolean; cat?: string }[] = [
  { label: 'แดชบอร์ด', icon: 'chart-area', active: true },
  { cat: 'MANAGEMENT', label: 'ระบบจัดการสมาชิก', icon: 'users' },
  { label: 'จัดการโค้ดไอเท็ม', icon: 'ticket' },
  { label: 'ระบบร้านค้า', icon: 'store' },
  { cat: 'PAGE MANAGER', label: 'ตั้งค่าหน้าเว็บไซต์', icon: 'gears' },
  { label: 'Appearance / Theme', icon: 'wand-magic-sparkles' },
  { cat: 'SYSTEM', label: 'จัดการเซิร์ฟเวอร์', icon: 'server' },
  { label: 'ผู้เล่นออนไลน์', icon: 'signal' },
  { label: 'ระบบเติมเงิน', icon: 'wallet' },
];

const TOP_ITEMS = [
  { medal: '🥇', name: '100 Crystal', count: 119, revenue: 1190 },
  { medal: '🥈', name: '490 Crystal', count: 27, revenue: 1323 },
  { medal: '🥉', name: 'ยศ VIP 30 วัน', count: 23, revenue: 3427 },
  { medal: '#4', name: 'Furniture Set', count: 6, revenue: 150 },
];

const TOP_BOXES = [
  { medal: '🥇', name: 'กล่องพรีเมียม', count: 84, revenue: 8316 },
  { medal: '🥈', name: 'กล่องตำนาน', count: 41, revenue: 10209 },
  { medal: '🥉', name: 'กล่องธรรมดา', count: 33, revenue: 957 },
  { medal: '#4', name: 'กล่องเทศกาล', count: 12, revenue: 1188 },
];

/** Reproduces the shop admin's `DeltaBadge`: green delta line + last-month line. */
function DeltaBadge({ delta, pct, last, suffix = '', dark = false }: {
  delta: string; pct: string; last: string; suffix?: string; dark?: boolean;
}) {
  return (
    <div className="mt-3 space-y-0.5">
      <p className={`text-[10px] font-bold flex items-center gap-1 flex-wrap ${dark ? 'text-white/90' : 'text-emerald-600'}`}>
        <Icon name="arrow-up" className="text-[9px]" />
        <span>+{delta}{suffix}</span>
        <span className="opacity-80">(+{pct}%)</span>
        <span className={`font-medium ${dark ? 'text-white/60' : 'text-gray-400'}`}>เทียบเดือนก่อน</span>
      </p>
      <p className={`text-[10px] ${dark ? 'text-white/50' : 'text-gray-400'}`}>
        เดือนที่แล้ว <span className={`font-semibold ${dark ? 'text-white/80' : 'text-gray-600'}`}>{last}{suffix}</span>
      </p>
    </div>
  );
}

function RankColumn({ title, icon, tint, rows, unit }: {
  title: string; icon: IconName; tint: string;
  rows: { medal: string; name: string; count: number; revenue: number }[]; unit: string;
}) {
  return (
    <div className={`${SHOP_CARD} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
          <Icon name={icon} className="text-xs" />
        </span>
        <h3 className="font-bold text-gray-900 text-[13px]">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r, i) => (
          <div key={i} className="mock-row flex items-center gap-2.5 px-4 py-2.5">
            <span className="w-5 shrink-0 flex items-center justify-center text-sm leading-none">
              {r.medal.startsWith('#') ? <span className="text-[10px] font-bold text-gray-500">{r.medal}</span> : r.medal}
            </span>
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
              <Icon name="cube" className="text-[11px]" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-bold text-gray-800 truncate">{r.name}</span>
              <span className="block text-[10px] text-gray-500">หมวดหมู่: ไอเท็ม</span>
            </span>
            <span className="text-right shrink-0">
              <span className="block text-[11px] font-bold text-gray-800">
                {r.count} <span className="text-[10px] font-normal text-gray-500">{unit}</span>
              </span>
              <span className="block text-[10px] text-gray-500">฿{r.revenue.toLocaleString()}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardMock() {
  return (
    <ScaledMock designWidth={1440} designHeight={900}>
      <Frame url="yourshop.siamsite.shop/admin">
        <div className="h-full flex bg-[#f4f5f7] text-gray-800">
          {/* Dark sidebar, as in admin/layout.tsx */}
          <aside className="w-[260px] shrink-0 bg-[#18191c] flex flex-col">
            <div className="h-[72px] flex items-center px-6 border-b border-gray-800 shrink-0">
              <span className="flex flex-col">
                <span className="font-bold text-white text-lg tracking-wide leading-none">SIAMSITE</span>
                <span className="text-[10px] font-bold text-[#22c55e] tracking-[0.2em] mt-1">ADMIN PANEL</span>
              </span>
            </div>
            <nav className="flex-1 py-5 px-3 space-y-1">
              {SHOP_SIDEBAR.map((m, i) => (
                <div key={i}>
                  {m.cat && (
                    <h4 className="px-4 text-[10px] font-bold text-gray-500 mb-2 mt-4 tracking-wider">{m.cat}</h4>
                  )}
                  <span
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
                      m.active ? 'bg-[#16a34a]/15 text-[#22c55e]' : 'text-gray-400'
                    }`}
                  >
                    <Icon name={m.icon} className="w-5 text-center text-[13px]" />
                    {m.label}
                  </span>
                </div>
              ))}
            </nav>
          </aside>

          {/* Work area */}
          <div className="flex-1 min-w-0 p-6 space-y-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Icon name="chart-area" className="text-[#f97316]" /> แดชบอร์ด
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">ภาพรวมระบบทั้งหมด</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-[#f97316] text-[10px] font-bold border border-orange-100">
                  <Icon name="calendar-day" className="text-[9px]" />
                  ข้อมูลเดือน มีนาคม 2569
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                  <span className="mock-live w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  อัปเดตสด
                </span>
                <span className="mock-buy flex items-center gap-1.5 px-3.5 py-2 bg-[#1e2735] text-white rounded-lg text-[11px] font-bold shadow-[0_4px_0_#38404d]">
                  <Icon name="arrows-rotate" className="text-[10px]" /> รีเฟรช
                </span>
              </div>
            </div>

            {/* Row 1: chart + top-up card + two revenue cards */}
            <div className="grid grid-cols-4 gap-4 items-stretch">
              <div className={`col-span-2 ${SHOP_CARD} overflow-hidden flex flex-col`}>
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3 shrink-0">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <Icon name="chart-area" className="text-orange-500 text-xs" />
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm truncate">สถิติระบบ (30 วันล่าสุด)</h3>
                  </span>
                  <span className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                    {['รายวัน', 'รายสัปดาห์', 'รายเดือน'].map((t, i) => (
                      <span
                        key={t}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${i === 0 ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="flex-1 flex flex-col min-h-0 px-4 pt-2 pb-3">
                  <div className="flex-1 min-h-0">
                    <MiniChart />
                  </div>
                  <div className="shrink-0 flex justify-center gap-5 pt-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" /><span className="text-gray-500">สมาชิกใหม่</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-gray-500">ยอดขาย Item (฿)</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /><span className="text-gray-500">ยอดเติมเงิน (฿)</span></span>
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex flex-col gap-4">
                <div className="mock-tile flex-1 bg-[#168d41] rounded-2xl p-5 text-white border border-[#1faa4f]/30 shadow-[0_4px_0_#0f6530,0_2px_24px_rgba(22,141,65,0.45)] relative overflow-hidden">
                  <span className="absolute -right-6 -top-6 w-32 h-32 bg-black/10 rounded-full blur-2xl pointer-events-none" />
                  <span className="absolute right-16 bottom-0 w-20 h-20 bg-white/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white text-[11px] font-bold mb-1 tracking-wide opacity-70">ยอดเติมเดือนนี้</p>
                      <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
                        <span className="mock-count">48,250</span> <span className="text-base font-medium text-white/60">บาท</span>
                      </h2>
                      <p className="text-[10px] text-white/60 mt-1">สะสมทั้งหมด <span className="font-bold text-white/90">612,480 ฿</span></p>
                    </div>
                    <span className="w-11 h-11 bg-black/15 border border-white/20 rounded-xl flex items-center justify-center shrink-0">
                      <Icon name="wallet" className="text-white text-sm" />
                    </span>
                  </div>
                  <DeltaBadge delta="7,900" pct="19.6" last="40,350" suffix=" ฿" dark />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`mock-tile ${SHOP_CARD} p-5`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-gray-500 text-[11px] font-bold mb-2 tracking-wide">รายได้ Item เดือนนี้</p>
                        <h2 className="text-2xl font-bold text-gray-800 leading-tight">
                          21,430 <span className="text-xs font-medium text-gray-400">บาท</span>
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-1">สะสม <span className="font-bold text-gray-600">288,120 ฿</span> · 1,842 ชิ้น</p>
                      </div>
                      <span className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                        <Icon name="shopping-cart" className="text-sm" />
                      </span>
                    </div>
                    <DeltaBadge delta="3,120" pct="17.0" last="18,310" suffix=" ฿" />
                  </div>

                  <div className={`mock-tile ${SHOP_CARD} p-5`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-gray-500 text-[11px] font-bold mb-2 tracking-wide">รายได้ Gacha เดือนนี้</p>
                        <h2 className="text-2xl font-bold text-gray-800 leading-tight">
                          14,880 <span className="text-xs font-medium text-gray-400">บาท</span>
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-1">สะสม <span className="font-bold text-gray-600">176,540 ฿</span> · 970 ครั้ง</p>
                      </div>
                      <span className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center shrink-0">
                        <Icon name="dice" className="text-sm" />
                      </span>
                    </div>
                    <DeltaBadge delta="2,240" pct="17.7" last="12,640" suffix=" ฿" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: four KPI cards, two with a left accent rule */}
            <div className="grid grid-cols-4 gap-4">
              <div className={`mock-tile ${SHOP_CARD} p-5 border-l-4 border-l-blue-500`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 text-[11px] font-bold mb-2 tracking-wide">ยอดเงินคงเหลือในระบบรวม</p>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight">39,615 <span className="text-xs font-medium text-gray-400">บาท</span></h2>
                  </div>
                  <span className="w-10 h-10 bg-violet-50 text-violet-500 rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="sack-dollar" className="text-sm" />
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                  <Icon name="users" className="text-gray-300 text-[9px]" />
                  เงินคงอยู่ใน Wallet ผู้ใช้ทั้งหมด
                </p>
              </div>

              <div className={`mock-tile ${SHOP_CARD} p-5 border-l-4 border-l-green-500`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 text-[11px] font-bold mb-2 tracking-wide">ยอดใช้จ่ายรวม</p>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight">464,660 <span className="text-xs font-medium text-gray-400">บาท</span></h2>
                  </div>
                  <span className="w-10 h-10 bg-violet-50 text-violet-500 rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="receipt" className="text-sm" />
                  </span>
                </div>
                <DeltaBadge delta="5,360" pct="17.3" last="30,950" suffix=" ฿" />
              </div>

              <div className={`mock-tile ${SHOP_CARD} p-5`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 text-[11px] font-bold mb-2 tracking-wide">สมาชิกทั้งหมด</p>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight">1,284 <span className="text-sm font-medium text-gray-400">คน</span></h2>
                  </div>
                  <span className="w-10 h-10 bg-orange-50 text-[#f97316] rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="users" className="text-sm" />
                  </span>
                </div>
                <DeltaBadge delta="96" pct="8.1" last="1,188" />
              </div>

              <div className={`mock-tile ${SHOP_CARD} p-5`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 text-[11px] font-bold mb-2 tracking-wide">สินค้าทั้งหมด</p>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight">19 <span className="text-sm font-medium text-gray-400">ชิ้น</span></h2>
                  </div>
                  <span className="w-10 h-10 bg-orange-50 text-[#f97316] rounded-xl flex items-center justify-center shrink-0">
                    <Icon name="box-open" className="text-sm" />
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-3">รายการสินค้าที่พร้อมขาย</p>
              </div>
            </div>

            {/* Row 3: ranking columns */}
            <div className="grid grid-cols-2 gap-4">
              <RankColumn title="ไอเท็มขายดี" icon="trophy" tint="bg-amber-50 text-amber-500" rows={TOP_ITEMS} unit="ชิ้น" />
              <RankColumn title="Gacha ยอดนิยม" icon="trophy" tint="bg-purple-50 text-purple-500" rows={TOP_BOXES} unit="ครั้ง" />
            </div>
          </div>
        </div>
      </Frame>
    </ScaledMock>
  );
}

/** The dashboard's three-series line chart, drawn with the same colours and
 *  the same flat 3-gridline treatment as `MiniLineChart` in the shop app. */
function MiniChart() {
  const W = 520, H = 150, PX = 26, PY = 8;
  const series = [
    { color: '#f97316', vals: [12, 18, 15, 24, 20, 30, 27, 36, 33, 42] },
    { color: '#3b82f6', vals: [30, 26, 38, 34, 46, 41, 55, 49, 62, 58] },
    { color: '#a855f7', vals: [20, 28, 24, 35, 31, 44, 39, 52, 47, 60] },
  ];
  const max = 70;
  const x = (i: number) => PX + (i * (W - PX * 2)) / (series[0].vals.length - 1);
  const y = (v: number) => PY + (H - PY * 2) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-full block" preserveAspectRatio="none">
      {[0, 0.5, 1].map((p, i) => {
        const gy = PY + (H - PY * 2) * (1 - p);
        return (
          <g key={i}>
            <line x1={PX} y1={gy} x2={W - PX} y2={gy} stroke="#f0f0f0" strokeWidth="1" />
            <text x={PX - 6} y={gy + 3.5} textAnchor="end" fill="#c4c9d4" fontSize="9">{Math.round(max * p)}</text>
          </g>
        );
      })}
      {series.map((s, si) => (
        <path
          key={s.color}
          className="mock-chart-line"
          style={{ animationDelay: `${si * 0.25}s` }}
          d={s.vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}
          fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      {series.map((s, si) => s.vals.map((v, i) => (
        <circle
          key={`${s.color}-${i}`}
          className="mock-chart-dot"
          style={{ animationDelay: `${si * 0.25 + i * 0.09}s` }}
          cx={x(i)} cy={y(v)} r="3" fill={s.color} stroke="white" strokeWidth="1.5"
        />
      )))}
    </svg>
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
function ProductCardMock({ name, price, original, sold, category, seq = 0 }: {
  name: string; price: number; original?: number; sold: number; category: string; seq?: number;
}) {
  const discount = original ? Math.round((1 - price / original) * 100) : 0;
  return (
    <article className="mock-tile mock-card-cycle group relative flex flex-col s-surface border s-border rounded-xl overflow-hidden" style={{ animationDelay: `${seq * 0.9}s` }}>
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
              {SHOP_ITEMS.map((it, i) => <ProductCardMock key={it.name} {...it} seq={i} />)}
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
              <div className="mock-reel flex gap-3 p-5">
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
              {slots.map((s, i) => {
                const tier = getTier(s.tier);
                return (
                  <div key={s.name} className="mock-tile mock-claim-cycle s-surface border s-border rounded-xl p-4 flex items-center gap-4" style={{ animationDelay: `${i * 0.7}s` }}>
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
                      className="mock-tile mock-amount-cycle py-2.5 rounded-lg text-center text-[13px] font-bold border tabular-nums s-surface s-fg s-border"
                      style={{ animationDelay: `${i * 0.5}s` }}
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
                <span className="mock-qr relative w-40 h-40 rounded-xl grid place-items-center overflow-hidden" style={{ background: 'rgb(var(--color-fg))' }}>
                  <Icon name="qrcode" className="text-6xl" style={{ color: 'rgb(var(--color-surface))' }} />
                  <span className="mock-qr-scan" />
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
    key: 'admin',
    title: 'หลังร้านสำหรับเจ้าของเซิร์ฟเวอร์',
    desc: 'ดูยอดเติมเงิน รายได้ Item และ Gacha เทียบกับเดือนก่อน พร้อมอันดับไอเท็มขายดี ทั้งหมดอัปเดตสด',
    Mock: DashboardMock,
  },
];
