'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

interface Stats {
  totalRevenue: number;
  totalTopups: number;
  totalLootboxRevenue: number;
  totalUsers: number;
  activeProducts: number;
  totalPurchases: number;
  todayRevenue: number;
  todayTopups: number;
  topProducts: { name: string; purchase_count: number }[];
  recentPurchases: { id: number; username: string; product_name: string; price: number; server_name: string; status: string; created_at: string }[];
  recentTransactions: { id: number; username: string; type: string; amount: number; description: string; status: string; created_at: string }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { totalOnline } = useOnlinePlayers();

  useEffect(() => {
    api('/admin/stats', { token: getToken()! })
      .then(d => setStats(d.stats as Stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <i className="fas fa-spinner fa-spin text-3xl text-[#f97316]"></i>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <h1 className="text-xl font-bold text-gray-800">
        แดชบอร์ด
      </h1>

      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Span (Chart Area in Mockup, doing a placeholder for now) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <i className="fas fa-chart-line text-[#f97316]"></i> สถิติระบบ (12 เดือนล่าสุด)
            </h3>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button className="px-3 py-1 text-xs font-semibold rounded-md text-gray-500 hover:text-gray-900">รายวัน</button>
              <button className="px-3 py-1 text-xs font-semibold rounded-md text-gray-500 hover:text-gray-900">สัปดาห์</button>
              <button className="px-3 py-1 text-xs font-semibold rounded-md bg-white shadow-sm text-[#f97316]">เดือน</button>
              <button className="px-3 py-1 text-xs font-semibold rounded-md text-gray-500 hover:text-gray-900">ปี</button>
            </div>
          </div>
          <div className="h-48 w-full border-b border-l border-gray-100 relative flex items-end">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxwYXRoIGQ9Ik0wIDExNEwwWiIgZmlsbD0iI2YwZjBmMCIvPgo8L3N2Zz4=')] opacity-50"></div>
            {/* Mock Line Chart Vector */}
            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full text-[#f97316] relative z-10 opacity-80" stroke="currentColor" fill="none" strokeWidth="2">
              <path d="M0 45 L10 40 L20 42 L30 35 L40 38 L50 20 L60 25 L70 10 L80 15 L90 5 L100 0" />
            </svg>
            <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent pointer-events-none z-20"></div>
          </div>
          <div className="flex justify-center gap-4 mt-4 text-[10px] text-gray-500 font-medium">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]"></span>สมาชิกใหม่</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>ยอดขาย Point</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span>ยอดเติมเงิน</span>
          </div>
        </div>

        {/* Right Span 4 Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-[#f97316] rounded-2xl p-5 text-white flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white/80 text-xs font-semibold mb-1">สมาชิกทั้งหมด</p>
                <h2 className="text-3xl font-black">{stats?.totalUsers || 0} <span className="text-sm font-medium">คน</span></h2>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i className="fas fa-users"></i>
              </div>
            </div>
            <p className="text-[10px] text-white/70 mt-4 flex items-center gap-1"><i className="fas fa-arrow-up text-white/90"></i> สมาชิกใหม่ 12 คนเดือนนี้</p>
          </div>

          <div className="bg-white rounded-2xl p-5 flex flex-col justify-between shadow-sm border border-gray-200 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-1">สินค้าทั้งหมด</p>
                <h2 className="text-3xl font-black text-gray-800">{stats?.activeProducts || 0} <span className="text-sm font-medium text-gray-500">ชิ้น</span></h2>
              </div>
              <div className="w-10 h-10 bg-orange-50 text-[#f97316] rounded-xl flex items-center justify-center">
                <i className="fas fa-box-open"></i>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-4">รายการสินค้าที่พร้อมขาย</p>
          </div>

          <div className="bg-white rounded-2xl p-5 flex flex-col justify-between shadow-sm border border-gray-200 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-1">ขายได้ทั้งหมด</p>
                <h2 className="text-3xl font-black text-gray-800">{stats?.totalPurchases || 0} <span className="text-sm font-medium text-gray-500">ชิ้น</span></h2>
              </div>
              <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                <i className="fas fa-shopping-cart"></i>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-4">จำนวนชิ้นที่ส่งมอบสำเร็จ</p>
          </div>

          <div className="bg-white rounded-2xl p-5 flex flex-col justify-between shadow-sm border border-gray-200 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-xs font-semibold mb-1">เติมเงินรวม</p>
                <h2 className="text-3xl font-black text-[#f97316]">{stats?.totalTopups?.toLocaleString() || 0} <span className="text-sm font-medium text-gray-500">บาท</span></h2>
              </div>
              <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center">
                <i className="fas fa-wallet"></i>
              </div>
            </div>
            <p className="text-[10px] text-green-500 mt-4 flex items-center gap-1"><i className="fas fa-arrow-up"></i> ยอดจำแนกทั้งหมด</p>
          </div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Product List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <i className="fas fa-trophy text-[#f97316]"></i>
            <h3 className="font-bold text-gray-800 text-sm">ขายดี (Products)</h3>
          </div>
          <div className="p-5 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar-light">
            {stats?.topProducts?.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black
                  ${i === 0 ? 'text-[#f97316]' : i === 1 ? 'text-gray-400' : 'text-orange-900'}
                `}>#{i + 1}</div>
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                  <i className="fas fa-box"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400">หมวดหมู่: Item</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{p.purchase_count} ชิ้น</p>
                </div>
              </div>
            ))}
            {(!stats?.topProducts || stats.topProducts.length === 0) && (
              <p className="text-xs text-center text-gray-400 py-4">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Latest Topups Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-clock text-[#f97316]"></i>
              <h3 className="font-bold text-gray-800 text-sm">เติมเงินล่าสุด</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">ผู้ใช้</th>
                  <th className="px-5 py-3 font-semibold text-right">จำนวน</th>
                  <th className="px-5 py-3 font-semibold">วันที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats?.recentTransactions?.filter(t => t.type === 'topup').slice(0, 5).map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://mc-heads.net/avatar/${tx.username}/32`} alt="" className="w-8 h-8 rounded-lg" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{tx.username}</p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1"><i className="fas fa-wallet text-gray-300"></i> ทรูมันนี่ / พร้อมเพย์</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-black text-green-500 tabular-nums">+{tx.amount?.toLocaleString()} ฿</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-gray-500 tabular-nums">{new Date(tx.created_at).toLocaleString('th-TH')}</p>
                    </td>
                  </tr>
                ))}
                {(!stats?.recentTransactions || stats.recentTransactions.filter(t => t.type === 'topup').length === 0) && (
                  <tr><td colSpan={3} className="text-center text-gray-400 py-8 text-sm">ยังไม่มีเติมเงิน</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Latest Purchases (Full table) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-users text-[#f97316]"></i>
            <h3 className="font-bold text-gray-800 text-sm">ผู้เล่นที่ซื้อสินค้าล่าสุด</h3>
          </div>
          <button className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-semibold transition-colors flex items-center gap-2">
             <i className="fas fa-sync-alt"></i> รีเฟรช
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-4 font-semibold w-[20%]">ชื่อตัวละคร</th>
                <th className="px-5 py-4 font-semibold w-[30%]">สินค้า</th>
                <th className="px-5 py-4 font-semibold w-[20%]">เซิร์ฟเวอร์</th>
                <th className="px-5 py-4 font-semibold w-[15%]">IP / สถานะ</th>
                <th className="px-5 py-4 font-semibold w-[15%] text-right">เวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats?.recentPurchases?.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-gray-300 w-4">{i + 1}</div>
                      <img src={`https://mc-heads.net/avatar/${p.username}/24`} alt="" className="w-6 h-6 rounded-md" />
                      <p className="text-sm font-bold text-gray-800">{p.username}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs font-semibold text-gray-700">{p.product_name}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-[10px] font-bold text-gray-500">
                      {p.server_name}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-[10px] font-bold text-green-600">
                      <i className="fas fa-check-circle mr-1"></i> Thành công
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className="text-xs text-gray-500 tabular-nums">{new Date(p.created_at).toLocaleTimeString('th-TH')}</p>
                  </td>
                </tr>
              ))}
              {(!stats?.recentPurchases || stats.recentPurchases.length === 0) && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8 text-sm">ยังไม่มีการซื้อ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
