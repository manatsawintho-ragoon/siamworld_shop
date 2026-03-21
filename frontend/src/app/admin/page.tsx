'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

interface RankEntry { username: string; total_amount: number; tx_count: number }
interface ActivityEntry { activity_type: string; username: string; detail: string; amount: number; created_at: string }
interface TopupEntry { id: number; username: string; amount: number; method: string; description: string; created_at: string }
interface UserEntry { id: number; username: string; role: string; created_at: string; ip: string | null; regip: string | null }
interface ChartEntry { month_key: string; month_label: string; new_users: number; topup_amount: number; revenue_amount: number }
interface LootBoxEntry { name: string; image?: string; open_count: number; total_revenue: number }
interface TopProductEntry { name: string; image?: string; purchase_count: number; total_revenue: number }

interface Stats {
  totalRevenue: number;
  totalTopups: number;
  totalLootboxRevenue: number;
  totalUsers: number;
  activeProducts: number;
  totalPurchases: number;
  todayRevenue: number;
  todayTopups: number;
  monthNewUsers: number;
  totalLootboxOpened: number;
  totalRedeemUsed: number;
  activeRedeemCodes: number;
  todayPurchases: number;
  monthRevenue: number;
  monthTopups: number;
  topProducts: TopProductEntry[];
  topLootBoxes: LootBoxEntry[];
  recentPurchases: { id: number; username: string; product_name: string; price: number; server_name: string; status: string; created_at: string }[];
  recentTransactions: { id: number; username: string; type: string; amount: number; description: string; status: string; created_at: string }[];
  recentTopups: TopupEntry[];
  recentUsers: UserEntry[];
  monthlyChart: ChartEntry[];
  dailyChart: ChartEntry[];
  weeklyChart: ChartEntry[];
  topupRankAlltime: RankEntry[];
  topupRankMonth: RankEntry[];
  topupRankToday: RankEntry[];
  activityFeed: ActivityEntry[];
}

/* ─── Mini SVG line chart with tooltip ─── */
function MiniLineChart({ data, labels }: {
  data: { users: number[]; topups: number[]; revenue: number[] };
  labels: string[];
}) {
  const W = 700, H = 130, PX = 44, PY = 14;
  const chartW = W - PX * 2, chartH = H - PY * 2;
  const LABEL_H = 20;
  const totalH = H + LABEL_H;
  const allVals = [...data.users, ...data.topups, ...data.revenue];
  const maxVal = Math.max(...allVals, 1);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tipIdx, setTipIdx] = useState<number | null>(null);

  const toPath = (vals: number[]) => {
    if (vals.length < 2) return '';
    return vals.map((v, i) => {
      const x = PX + (i / (vals.length - 1)) * chartW;
      const y = PY + chartH - (v / maxVal) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const ptX = (i: number) => PX + (i / Math.max(labels.length - 1, 1)) * chartW;
  const ptY = (v: number) => PY + chartH - (v / maxVal) * chartH;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || labels.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(labels.length - 1, Math.round((mouseX - PX) / chartW * (labels.length - 1))));
    setTipIdx(idx);
  };

  const fmt = (n: number) => n > 999 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

  const tip = tipIdx !== null ? {
    x: ptX(tipIdx),
    users: data.users[tipIdx] ?? 0,
    revenue: data.revenue[tipIdx] ?? 0,
    topups: data.topups[tipIdx] ?? 0,
    label: labels[tipIdx] ?? '',
  } : null;

  const TIP_W = 168, TIP_H = 76, TIP_PAD = 10;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${totalH}`}
      className="w-full h-full block"
      preserveAspectRatio="none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTipIdx(null)}
      style={{ cursor: tipIdx !== null ? 'crosshair' : 'default' }}
    >
      {/* Grid lines — 3 only */}
      {[0, 0.5, 1].map((pct, i) => {
        const y = PY + chartH - pct * chartH;
        const val = Math.round(maxVal * pct);
        return (
          <g key={i}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#f0f0f0" strokeWidth="1" />
            <text x={PX - 6} y={y + 3.5} textAnchor="end" fill="#c4c9d4" fontSize="9">{val > 999 ? `${(val / 1000).toFixed(0)}k` : val}</text>
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((label, i) => (
        <text key={i} x={ptX(i)} y={H + 14} textAnchor="middle" fill="#c4c9d4" fontSize="9">{label}</text>
      ))}
      {/* Lines */}
      <path d={toPath(data.users)} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath(data.revenue)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath(data.topups)} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {([
        { vals: data.users, color: '#f97316' },
        { vals: data.revenue, color: '#3b82f6' },
        { vals: data.topups, color: '#a855f7' },
      ] as const).map(({ vals, color }) =>
        vals.map((v, i) => (
          <circle key={`${color}-${i}`} cx={ptX(i)} cy={ptY(v)} r="3" fill={color} stroke="white" strokeWidth="1.5" />
        ))
      )}
      {/* Tooltip */}
      {tip && (() => {
        const tipX = tip.x + PX > W / 2 ? tip.x - TIP_W - 8 : tip.x + 8;
        const tipY = PY;
        return (
          <g>
            {/* Vertical guide line */}
            <line x1={tip.x} y1={PY} x2={tip.x} y2={H} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,2" />
            {/* Highlight dots */}
            {[
              { v: tip.users, color: '#f97316' },
              { v: tip.revenue, color: '#3b82f6' },
              { v: tip.topups, color: '#a855f7' },
            ].map(({ v, color }, i) => (
              <circle key={i} cx={tip.x} cy={ptY(v)} r="5" fill={color} stroke="white" strokeWidth="2" />
            ))}
            {/* Box */}
            <rect x={tipX} y={tipY} width={TIP_W} height={TIP_H} rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }} />
            {/* Header */}
            <text x={tipX + TIP_PAD} y={tipY + TIP_PAD + 10} fill="#374151" fontSize="10" fontWeight="700">{tip.label}</text>
            <line x1={tipX + TIP_PAD} y1={tipY + TIP_PAD + 16} x2={tipX + TIP_W - TIP_PAD} y2={tipY + TIP_PAD + 16} stroke="#f3f4f6" strokeWidth="1" />
            {/* Rows */}
            {[
              { color: '#f97316', label: 'สมาชิกใหม่', val: `${tip.users.toLocaleString()} คน` },
              { color: '#3b82f6', label: 'ยอดขาย Item', val: `${fmt(tip.revenue)} ฿` },
              { color: '#a855f7', label: 'ยอดเติมเงิน', val: `${fmt(tip.topups)} ฿` },
            ].map(({ color, label, val }, i) => (
              <g key={i}>
                <circle cx={tipX + TIP_PAD + 4} cy={tipY + 36 + i * 14} r="3.5" fill={color} />
                <text x={tipX + TIP_PAD + 13} y={tipY + 40 + i * 14} fill="#6b7280" fontSize="9.5">{label}</text>
                <text x={tipX + TIP_W - TIP_PAD} y={tipY + 40 + i * 14} textAnchor="end" fill="#111827" fontSize="9.5" fontWeight="700">{val}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

const medals = ['🥇', '🥈', '🥉'];

const LiveBadge = ({ lastUpdated }: { lastUpdated: Date | null }) => (
  <div className="flex items-center gap-1.5">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
    </span>
    <span className="text-[10px] text-gray-400">
      {lastUpdated ? `อัพเดท ${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'อัพเดทอัตโนมัติ'}
    </span>
  </div>
);

interface FinancialSummary { totalOutstanding: number; totalSpent: number; }

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [financial, setFinancial] = useState<FinancialSummary>({ totalOutstanding: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { totalOnline } = useOnlinePlayers();
  const [chartMode, setChartMode] = useState<'day' | 'week' | 'month'>('month');

  const fetchStats = useCallback(() => {
    Promise.all([
      api('/admin/stats', { token: getToken()! })
        .then(d => { setStats(d.stats as Stats); setLastUpdated(new Date()); }),
      api('/admin/financial-summary', { token: getToken()! })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(d => setFinancial({ totalOutstanding: Number((d as any).totalOutstanding ?? 0), totalSpent: Number((d as any).totalSpent ?? 0) })),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const chartData = useMemo(() => {
    const chart =
      chartMode === 'day' ? (stats?.dailyChart || []) :
      chartMode === 'week' ? (stats?.weeklyChart || []) :
      (stats?.monthlyChart || []);
    return {
      labels: chart.map(c => c.month_label),
      data: {
        users: chart.map(c => c.new_users),
        topups: chart.map(c => c.topup_amount),
        revenue: chart.map(c => c.revenue_amount),
      }
    };
  }, [stats?.dailyChart, stats?.weeklyChart, stats?.monthlyChart, chartMode]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <i className="fas fa-spinner fa-spin text-3xl text-[#f97316]"></i>
    </div>
  );

  const s = stats;
  const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-chart-pie text-[#f97316]"></i> แดชบอร์ด
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ภาพรวมระบบทั้งหมด</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge lastUpdated={lastUpdated} />
          <button onClick={() => { setLoading(true); fetchStats(); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1e2735] text-white rounded-lg text-[11px] font-bold shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]">
            <i className="fas fa-sync-alt text-[10px]"></i> รีเฟรช
          </button>
        </div>
      </div>

      {/* ═══ Row 1: Chart + ยอดเติมรวม + รายได้ Item/Gacha ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">

        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-chart-line text-orange-500 text-xs"></i>
              </div>
              <h3 className="font-bold text-gray-900 text-sm">
                สถิติระบบ ({chartMode === 'day' ? '30 วันล่าสุด' : chartMode === 'week' ? '8 สัปดาห์ล่าสุด' : '12 เดือนล่าสุด'})
              </h3>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {([
                { label: 'รายวัน', mode: 'day' as const },
                { label: 'สัปดาห์', mode: 'week' as const },
                { label: 'เดือน', mode: 'month' as const },
              ]).map(({ label, mode }) => (
                <button key={mode}
                  onClick={() => setChartMode(mode)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                    chartMode === mode
                      ? 'bg-white shadow-sm text-[#f97316]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 px-4 pt-2 pb-3">
            <div className="flex-1 min-h-0 overflow-hidden">
              <MiniLineChart data={chartData.data} labels={chartData.labels} />
            </div>
            <div className="flex-shrink-0 flex justify-center gap-5 pt-2 text-[10px] font-bold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></span><span className="text-gray-500">สมาชิกใหม่</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span><span className="text-gray-500">ยอดขาย Item (฿)</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span><span className="text-gray-500">ยอดเติมเงิน (฿)</span></span>
            </div>
          </div>
        </div>

        {/* Right column: ยอดเติมรวม + รายได้ Item + รายได้ Gacha */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* ยอดเติมรวม — green full width */}
          <div className="flex-1 bg-[#168d41] rounded-2xl p-5 text-white shadow-[0_4px_0_#0f6530,0_2px_24px_rgba(22,141,65,0.45)] border border-[#1faa4f]/30 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-black/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute right-16 bottom-0 w-20 h-20 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white text-[11px] font-bold mb-1 tracking-wide uppercase opacity-70">ยอดเติมรวม</p>
                <h2 className="text-4xl font-black leading-tight tracking-tight text-white">{fmt2(s?.totalTopups || 0)} <span className="text-base font-medium text-white/60">บาท</span></h2>
              </div>
              <div className="w-11 h-11 bg-black/15 border border-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fas fa-wallet text-white text-sm"></i>
              </div>
            </div>
            <p className="text-[10px] text-white/70 mt-3 flex items-center gap-1">
              {(s?.monthTopups || 0) > 0 && <i className="fas fa-arrow-up text-white text-[9px]"></i>}
              <span>ยอดเดือนนี้ <span className="text-white font-bold">+{(s?.monthTopups || 0).toLocaleString()} ฿</span></span>
            </p>
          </div>

          {/* รายได้ Item + รายได้ Gacha side-by-side */}
          <div className="grid grid-cols-2 gap-4">

            {/* รายได้ Item */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-[11px] font-bold mb-2 uppercase tracking-wide">รายได้ Item</p>
                  <h2 className="text-2xl font-black text-gray-800 leading-tight">{fmt2(s?.totalRevenue || 0)} <span className="text-xs font-medium text-gray-400">บาท</span></h2>
                </div>
                <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-shopping-cart text-sm"></i>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                <i className="fas fa-box text-gray-300 text-[9px]"></i>
                ขายได้ <span className="font-bold text-gray-600">{s?.totalPurchases || 0}</span> ชิ้น
              </p>
            </div>

            {/* รายได้ Gacha */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-[11px] font-bold mb-2 uppercase tracking-wide">รายได้ Gacha</p>
                  <h2 className="text-2xl font-black text-gray-800 leading-tight">{fmt2(s?.totalLootboxRevenue || 0)} <span className="text-xs font-medium text-gray-400">บาท</span></h2>
                </div>
                <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-dice text-sm"></i>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                <i className="fas fa-box-open text-gray-300 text-[9px]"></i>
                เปิดกล่องแล้ว <span className="font-bold text-gray-600">{s?.totalLootboxOpened || 0}</span> ครั้ง
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ═══ Row 2: 4 KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* ยอดเงินคงเหลือรวม */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-[11px] font-bold mb-2 uppercase tracking-wide">ยอดเงินคงเหลือในระบบรวม</p>
              <h2 className="text-2xl font-black text-gray-800 leading-tight">{fmt2(financial.totalOutstanding)} <span className="text-xs font-medium text-gray-400">บาท</span></h2>
            </div>
            <div className="w-10 h-10 bg-violet-50 text-violet-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-piggy-bank text-sm"></i>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
            <i className="fas fa-users text-gray-300 text-[9px]"></i>
            เงินคงอยู่ใน Wallet ผู้ใช้ทั้งหมด
          </p>
        </div>

        {/* ยอดใช้จ่ายรวม */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-[11px] font-bold mb-2 uppercase tracking-wide">ยอดใช้จ่ายรวม</p>
              <h2 className="text-2xl font-black text-gray-800 leading-tight">{fmt2(financial.totalSpent)} <span className="text-xs font-medium text-gray-400">บาท</span></h2>
            </div>
            <div className="w-10 h-10 bg-violet-50 text-violet-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-receipt text-sm"></i>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
            <i className="fas fa-shopping-bag text-gray-300 text-[9px]"></i>
            รวม Item + Gacha (ไม่รวม Admin)
          </p>
        </div>

        {/* สมาชิกทั้งหมด */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-[11px] font-bold mb-2 uppercase tracking-wide">สมาชิกทั้งหมด</p>
              <h2 className="text-2xl font-black text-gray-800 leading-tight">{s?.totalUsers || 0} <span className="text-sm font-medium text-gray-400">คน</span></h2>
            </div>
            <div className="w-10 h-10 bg-orange-50 text-[#f97316] rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-users text-sm"></i>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
            {(s?.monthNewUsers || 0) > 0 && <i className="fas fa-arrow-up text-green-500 text-[9px]"></i>}
            สมาชิกใหม่ <span className="font-bold text-gray-600">{s?.monthNewUsers || 0}</span> คนเดือนนี้
          </p>
        </div>

        {/* สินค้าทั้งหมด */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-[11px] font-bold mb-2 uppercase tracking-wide">สินค้าทั้งหมด</p>
              <h2 className="text-2xl font-black text-gray-800 leading-tight">{s?.activeProducts || 0} <span className="text-sm font-medium text-gray-400">ชิ้น</span></h2>
            </div>
            <div className="w-10 h-10 bg-orange-50 text-[#f97316] rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-box-open text-sm"></i>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-3">รายการสินค้าที่พร้อมขาย</p>
        </div>

      </div>

      {/* ═══ Row 2: 4 Ranking Columns ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* ขายดี (Point) */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-trophy text-amber-500 text-xs"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">ไอเท็มขายดี</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.topProducts?.length ? s.topProducts.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {i < 3 ? <span className="text-sm leading-none">{medals[i]}</span> : <span className="text-[10px] font-black text-gray-500">#{i + 1}</span>}
                </div>
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <i className="fas fa-box text-gray-300 text-[11px]"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-500">หมวดหมู่: ไอเทม</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-black text-gray-800">{p.purchase_count} <span className="text-[10px] font-normal text-gray-500">ชิ้น</span></p>
                  <p className="text-[10px] text-gray-500">฿{p.total_revenue?.toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <i className="fas fa-box-open text-2xl mb-2"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* ขายดี (RP) */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-trophy text-purple-500 text-xs"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">Gacha ยอดนิยม</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.topLootBoxes?.length ? s.topLootBoxes.slice(0, 5).map((lb, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {i < 3 ? <span className="text-sm leading-none">{medals[i]}</span> : <span className="text-[10px] font-black text-gray-500">#{i + 1}</span>}
                </div>
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {lb.image
                    ? <img src={lb.image} alt={lb.name} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <i className="fas fa-dice text-purple-300 text-[11px]"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{lb.name}</p>
                  <p className="text-[10px] text-gray-500">หมวดหมู่: ไอเทม</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-black text-gray-800">{lb.open_count} <span className="text-[10px] font-normal text-gray-500">ครั้ง</span></p>
                  <p className="text-[10px] text-gray-500">฿{lb.total_revenue?.toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <i className="fas fa-dice text-2xl mb-2"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* เติมสูงสุด (เดือนนี้) */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-coins text-amber-500 text-xs"></i>
              </div>
              <h3 className="font-bold text-gray-900 text-[13px]">เติมสูงสุด</h3>
            </div>
            <LiveBadge lastUpdated={lastUpdated} />
          </div>
          <div className="divide-y divide-gray-100">
            {s?.topupRankMonth?.length ? s.topupRankMonth.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {i < 3 ? <span className="text-sm leading-none">{medals[i]}</span> : <span className="text-[10px] font-black text-gray-500">#{i + 1}</span>}
                </div>
                <img src={`https://mc-heads.net/avatar/${r.username}/28`} alt="" className="w-8 h-8 rounded-lg flex-shrink-0" style={{ imageRendering: 'pixelated' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{r.username}</p>
                  <p className="text-[10px] text-gray-500">สมาชิกที่ {i + 1}</p>
                </div>
                <span className="text-[12px] font-black text-amber-500 tabular-nums flex-shrink-0">+{r.total_amount?.toLocaleString()} ฿</span>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <i className="fas fa-trophy text-2xl mb-2"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* เติมล่าสุด */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-credit-card text-green-500 text-xs"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">เติมล่าสุด</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.recentTopups?.length ? s.recentTopups.slice(0, 5).map((tx, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <img src={`https://mc-heads.net/avatar/${tx.username}/28`} alt="" className="w-8 h-8 rounded-lg flex-shrink-0" style={{ imageRendering: 'pixelated' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{tx.username}</p>
                  <p className="text-[10px] text-gray-500 truncate">{tx.description || tx.method || 'Bank Transfer'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-black text-green-500 tabular-nums">+{tx.amount?.toLocaleString()} ฿</p>
                  <p className="text-[10px] text-gray-500 tabular-nums">
                    {new Date(tx.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(tx.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <i className="fas fa-wallet text-2xl mb-2"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ═══ Row 3: ผู้เล่นที่สมัครล่าสุด ═══ */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-users text-green-600 text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">ผู้เล่นที่สมัครล่าสุด</h3>
              <p className="text-[11px] text-gray-500">{s?.recentUsers?.length || 0} รายการ</p>
            </div>
          </div>
          <LiveBadge lastUpdated={lastUpdated} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-5 py-3 font-medium w-12 text-center">#</th>
                <th className="px-5 py-3 font-medium">ชื่อตัวละคร</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">วันที่</th>
                <th className="px-5 py-3 font-medium">เวลา</th>
                <th className="px-5 py-3 font-medium text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {s?.recentUsers?.map((u, i) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3 text-center">
                    <span className="text-xs font-bold text-gray-500">{i + 1}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={`https://mc-heads.net/avatar/${u.username}/24`} alt="" className="w-6 h-6 rounded-md" style={{ imageRendering: 'pixelated' }} />
                      <p className="text-[13px] font-bold text-gray-800">{u.username}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      u.role === 'admin' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                    }`}>
                      <i className={`fas ${u.role === 'admin' ? 'fa-shield-alt' : 'fa-user-check'} text-[8px]`}></i>
                      {u.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-gray-600 font-mono tabular-nums">{u.ip || u.regip || '-'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-gray-600 tabular-nums">{new Date(u.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-gray-600 tabular-nums">{new Date(u.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => router.push('/admin/users')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2735] text-white text-[10px] font-bold shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]"
                    >
                      <i className="fas fa-sliders-h text-[8px]"></i> จัดการ User
                    </button>
                  </td>
                </tr>
              ))}
              {(!s?.recentUsers || s.recentUsers.length === 0) && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-10 text-sm">ยังไม่มีสมาชิก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
