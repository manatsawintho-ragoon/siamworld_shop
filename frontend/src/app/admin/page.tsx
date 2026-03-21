'use client';
import { useEffect, useState, useMemo } from 'react';
import { api, getToken } from '@/lib/api';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

interface RankEntry { username: string; total_amount: number; tx_count: number }
interface ActivityEntry { activity_type: string; username: string; detail: string; amount: number; created_at: string }
interface TopupEntry { id: number; username: string; amount: number; method: string; description: string; created_at: string }
interface UserEntry { id: number; username: string; role: string; created_at: string; ip: string | null; regip: string | null }
interface ChartEntry { month_key: string; month_label: string; new_users: number; topup_amount: number; revenue_amount: number }
interface LootBoxEntry { name: string; open_count: number; total_revenue: number }

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
  topProducts: { name: string; purchase_count: number; total_revenue: number }[];
  topLootBoxes: LootBoxEntry[];
  recentPurchases: { id: number; username: string; product_name: string; price: number; server_name: string; status: string; created_at: string }[];
  recentTransactions: { id: number; username: string; type: string; amount: number; description: string; status: string; created_at: string }[];
  recentTopups: TopupEntry[];
  recentUsers: UserEntry[];
  monthlyChart: ChartEntry[];
  topupRankAlltime: RankEntry[];
  topupRankMonth: RankEntry[];
  topupRankToday: RankEntry[];
  activityFeed: ActivityEntry[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วันที่แล้ว`;
}

/* ─── Mini SVG line chart (no library needed) ─── */
function MiniLineChart({ data, labels }: {
  data: { users: number[]; topups: number[]; revenue: number[] };
  labels: string[];
}) {
  const W = 700, H = 200, PX = 50, PY = 20;
  const chartW = W - PX * 2, chartH = H - PY * 2;
  const allVals = [...data.users, ...data.topups, ...data.revenue];
  const maxVal = Math.max(...allVals, 1);

  const toPath = (vals: number[]) => {
    if (vals.length === 0) return '';
    return vals.map((v, i) => {
      const x = PX + (i / Math.max(vals.length - 1, 1)) * chartW;
      const y = PY + chartH - (v / maxVal) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  };

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {gridLines.map((pct, i) => {
        const y = PY + chartH - pct * chartH;
        const val = Math.round(maxVal * pct);
        return (
          <g key={i}>
            <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#f0f0f0" strokeWidth="1" />
            <text x={PX - 8} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{val > 999 ? `${(val / 1000).toFixed(0)}k` : val}</text>
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((label, i) => {
        const x = PX + (i / Math.max(labels.length - 1, 1)) * chartW;
        return <text key={i} x={x} y={H + 15} textAnchor="middle" fill="#9ca3af" fontSize="9">{label}</text>;
      })}
      {/* Lines */}
      <path d={toPath(data.users)} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath(data.revenue)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath(data.topups)} fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {[
        { vals: data.users, color: '#f97316' },
        { vals: data.revenue, color: '#3b82f6' },
        { vals: data.topups, color: '#a855f7' },
      ].map(({ vals, color }) =>
        vals.map((v, i) => {
          const x = PX + (i / Math.max(vals.length - 1, 1)) * chartW;
          const y = PY + chartH - (v / maxVal) * chartH;
          return <circle key={`${color}-${i}`} cx={x} cy={y} r="3.5" fill={color} stroke="white" strokeWidth="2" />;
        })
      )}
    </svg>
  );
}

const medals = ['🥇', '🥈', '🥉'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { totalOnline } = useOnlinePlayers();
  const [chartMode, setChartMode] = useState<'month'>('month');

  useEffect(() => {
    api('/admin/stats', { token: getToken()! })
      .then(d => setStats(d.stats as Stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    const chart = stats?.monthlyChart || [];
    return {
      labels: chart.map(c => c.month_label),
      data: {
        users: chart.map(c => c.new_users),
        topups: chart.map(c => c.topup_amount),
        revenue: chart.map(c => c.revenue_amount),
      }
    };
  }, [stats?.monthlyChart]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <i className="fas fa-spinner fa-spin text-3xl text-[#f97316]"></i>
    </div>
  );

  const s = stats;

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <i className="fas fa-chart-pie text-[#f97316]"></i> แดชบอร์ด
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">ภาพรวมระบบทั้งหมด</p>
      </div>

      {/* ═══ Row 1: Chart + 4 Stat Cards ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-chart-line text-orange-500 text-xs"></i>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">สถิติระบบ (12 เดือนล่าสุด)</h3>
              </div>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['month'] as const).map(mode => (
                <button key={mode} onClick={() => setChartMode(mode)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${chartMode === mode ? 'bg-white shadow-sm text-[#f97316]' : 'text-gray-500 hover:text-gray-700'}`}>
                  เดือน
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <div className="h-[220px]">
              <MiniLineChart data={chartData.data} labels={chartData.labels} />
            </div>
            <div className="flex justify-center gap-5 mt-2 text-[10px] font-bold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></span><span className="text-gray-500">สมาชิกใหม่</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span><span className="text-gray-500">ยอดขาย Point (฿)</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span><span className="text-gray-500">ยอดเติมเงิน (฿)</span></span>
            </div>
          </div>
        </div>

        {/* 4 Stat Cards (2x2 grid) */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {/* สมาชิก — orange highlight */}
          <div className="bg-[#f97316] rounded-2xl p-5 text-white shadow-[0_4px_20px_rgba(249,115,22,0.3)] relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-[11px] font-bold mb-1">สมาชิกทั้งหมด</p>
                <h2 className="text-3xl font-black">{s?.totalUsers || 0} <span className="text-sm font-medium text-white/70">คน</span></h2>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="fas fa-users text-sm"></i>
              </div>
            </div>
            <p className="text-[10px] text-white/70 mt-3 flex items-center gap-1">
              {(s?.monthNewUsers || 0) > 0 && <i className="fas fa-arrow-up text-white/90"></i>}
              สมาชิกใหม่ {s?.monthNewUsers || 0} คนเดือนนี้
            </p>
          </div>

          {/* สินค้า */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-[11px] font-bold mb-1">สินค้าทั้งหมด</p>
                <h2 className="text-3xl font-black text-gray-800">{s?.activeProducts || 0} <span className="text-sm font-medium text-gray-400">ชิ้น</span></h2>
              </div>
              <div className="w-10 h-10 bg-orange-50 text-[#f97316] rounded-xl flex items-center justify-center">
                <i className="fas fa-box-open text-sm"></i>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">รายการสินค้าที่พร้อมขาย</p>
          </div>

          {/* ขายได้ */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-[11px] font-bold mb-1">ขายได้ทั้งหมด</p>
                <h2 className="text-3xl font-black text-gray-800">{s?.totalPurchases || 0} <span className="text-sm font-medium text-gray-400">ชิ้น</span></h2>
              </div>
              <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                <i className="fas fa-shopping-cart text-sm"></i>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">จำนวนชิ้นที่ส่งมอบสำเร็จ</p>
          </div>

          {/* เติมรวม */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-[11px] font-bold mb-1">เติมรวม</p>
                <h2 className="text-3xl font-black text-[#f97316]">{(s?.totalTopups || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-medium text-gray-400">บาท</span></h2>
              </div>
              <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                <i className="fas fa-wallet text-sm"></i>
              </div>
            </div>
            <p className="text-[10px] text-green-500 mt-3 flex items-center gap-1">
              {(s?.todayTopups || 0) > 0 && <i className="fas fa-arrow-up"></i>}
              ยอดเติมเงินทั้งหมด
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Row 2: 4 Cards — ขายดี (สินค้า) | ขายดี (Gacha) | เติมสูงสุด | เติมล่าสุด ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ขายดี (สินค้า) */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-fire text-orange-500 text-[10px]"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">ขายดี (สินค้า)</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.topProducts?.length ? s.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] flex-shrink-0 relative">
                  <i className="fas fa-box"></i>
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">ร้านค้า</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-black text-gray-800">{p.purchase_count} <span className="text-[10px] font-medium text-gray-400">ชิ้น</span></p>
                  <p className="text-[10px] text-gray-400">฿{p.total_revenue?.toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <i className="fas fa-box-open text-xl mb-2 text-gray-300"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* ขายดี (Gacha Box) */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-dice text-purple-500 text-[10px]"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">ขายดี (Gacha)</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.topLootBoxes?.length ? s.topLootBoxes.map((lb, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-400 text-[10px] flex-shrink-0 relative">
                  <i className="fas fa-dice"></i>
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-purple-500 text-white text-[8px] font-black flex items-center justify-center">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{lb.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">กาชาบอกซ์</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-black text-gray-800">{lb.open_count} <span className="text-[10px] font-medium text-gray-400">ครั้ง</span></p>
                  <p className="text-[10px] text-gray-400">฿{lb.total_revenue?.toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <i className="fas fa-dice text-xl mb-2 text-gray-300"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* เติมสูงสุด */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-crown text-amber-500 text-[10px]"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">เติมสูงสุด</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.topupRankAlltime?.length ? s.topupRankAlltime.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                <div className="w-5 flex items-center justify-center flex-shrink-0">
                  {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-[10px] font-black text-gray-400">#{i + 1}</span>}
                </div>
                <img src={`https://mc-heads.net/avatar/${r.username}/24`} alt="" className="w-6 h-6 rounded-md flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{r.username}</p>
                  <p className="text-[10px] text-gray-400">{r.tx_count} ครั้ง</p>
                </div>
                <span className="text-[12px] font-black text-green-500 tabular-nums flex-shrink-0">+{r.total_amount?.toLocaleString()} ฿</span>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <i className="fas fa-trophy text-xl mb-2 text-gray-300"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* เติมล่าสุด */}
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-wallet text-green-500 text-[10px]"></i>
            </div>
            <h3 className="font-bold text-gray-900 text-[13px]">เติมล่าสุด</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {s?.recentTopups?.length ? s.recentTopups.map((tx, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50/60 transition-colors">
                <img src={`https://mc-heads.net/avatar/${tx.username}/24`} alt="" className="w-6 h-6 rounded-md flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{tx.username}</p>
                  <p className="text-[10px] text-gray-400 truncate">{tx.description || tx.method || 'Bank Transfer'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-black text-green-500 tabular-nums">+{tx.amount?.toLocaleString()} ฿</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">{new Date(tx.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <i className="fas fa-wallet text-xl mb-2 text-gray-300"></i>
                <p className="text-[11px]">ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Row 3: ผู้เล่นที่สมัครล่าสุด ═══ */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-users text-orange-500 text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">ผู้เล่นที่สมัครล่าสุด</h3>
              <p className="text-[11px] text-gray-400">{s?.recentUsers?.length || 0} รายการ</p>
            </div>
          </div>
          <button onClick={() => { setLoading(true); api('/admin/stats', { token: getToken()! }).then(d => setStats(d.stats as Stats)).catch(() => {}).finally(() => setLoading(false)); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-[11px] font-bold transition-colors">
            <i className="fas fa-sync-alt text-[10px]"></i> รีเฟรช
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="px-5 py-3 font-medium w-12 text-center">#</th>
                <th className="px-5 py-3 font-medium">ชื่อตัวละคร</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">วันที่</th>
                <th className="px-5 py-3 font-medium">เวลา</th>
                <th className="px-5 py-3 font-medium text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {s?.recentUsers?.map((u, i) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3 text-center">
                    <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={`https://mc-heads.net/avatar/${u.username}/24`} alt="" className="w-6 h-6 rounded-md" />
                      <p className="text-[13px] font-bold text-gray-800">{u.username}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold ${
                      u.role === 'admin' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
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
                    <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-[10px] font-bold text-green-600">
                      <i className="fas fa-check-circle mr-1 text-[8px]"></i>เปิดใช้
                    </span>
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
