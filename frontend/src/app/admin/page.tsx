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

  if (loading) return <div className="flex items-center justify-center py-20"><i className="fas fa-spinner fa-spin text-3xl text-brand-400"></i></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">
        <i className="fas fa-chart-line mr-2 text-brand-500"></i>Dashboard
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <DashCard icon="fa-coins" label="รายได้ร้านค้า" value={`${stats?.totalRevenue?.toLocaleString() || 0} ฿`} />
        <DashCard icon="fa-wallet" label="เติมเงินรวม" value={`${stats?.totalTopups?.toLocaleString() || 0} ฿`} />
        <DashCard icon="fa-box-open" label="รายได้กล่องสุ่ม" value={`${stats?.totalLootboxRevenue?.toLocaleString() || 0} ฿`} />
        <DashCard icon="fa-users" label="ผู้ใช้ทั้งหมด" value={`${stats?.totalUsers || 0}`} />
        <DashCard icon="fa-receipt" label="การซื้อทั้งหมด" value={`${stats?.totalPurchases || 0}`} />
        <DashCard icon="fa-gamepad" label="ออนไลน์" value={`${totalOnline}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold dark:text-white"><i className="fas fa-clock mr-2 text-brand-400"></i>การซื้อล่าสุด</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ผู้ซื้อ</th>
                  <th>สินค้า</th>
                  <th>เซิร์ฟเวอร์</th>
                  <th>ราคา</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentPurchases?.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium dark:text-gray-200">{p.username}</td>
                    <td className="dark:text-gray-300">{p.product_name}</td>
                    <td><span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{p.server_name}</span></td>
                    <td className="font-medium dark:text-gray-200">{p.price?.toLocaleString()} ฿</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {(!stats?.recentPurchases || stats.recentPurchases.length === 0) && (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-8">ยังไม่มีการซื้อ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold dark:text-white"><i className="fas fa-trophy mr-2 text-warning-400"></i>สินค้ายอดนิยม</h3>
          </div>
          <div className="p-4 space-y-3">
            {stats?.topProducts?.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-200 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-100 text-gray-500'
                }`}>{i + 1}</span>
                <span className="flex-1 text-sm truncate dark:text-gray-200">{p.name}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">{p.purchase_count} ขาย</span>
              </div>
            ))}
            {(!stats?.topProducts || stats.topProducts.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions — includes topup, lootbox, shop purchases */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold dark:text-white"><i className="fas fa-list-ul mr-2 text-brand-400"></i>ธุรกรรมล่าสุด (เติมเงิน + กล่องสุ่ม + ร้านค้า)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ผู้ใช้</th>
                <th>ประเภท</th>
                <th>จำนวน</th>
                <th>รายละเอียด</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentTransactions?.map(tx => (
                <tr key={tx.id}>
                  <td className="font-medium dark:text-gray-200">{tx.username}</td>
                  <td>
                    <span className={`badge ${
                      tx.type === 'topup' ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400' :
                      tx.type === 'purchase' ? 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400' :
                      tx.type === 'refund' ? 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {tx.type === 'topup' ? 'เติมเงิน' :
                       tx.type === 'purchase' ? 'ซื้อสินค้า' :
                       tx.type === 'refund' ? 'คืนเงิน' : tx.type}
                    </span>
                  </td>
                  <td className={`font-bold ${tx.amount >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount?.toLocaleString()} ฿
                  </td>
                  <td className="text-gray-500 dark:text-gray-400 text-sm">{tx.description}</td>
                  <td className="text-gray-400 dark:text-gray-500 text-xs">{new Date(tx.created_at).toLocaleString('th-TH')}</td>
                </tr>
              ))}
              {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">ยังไม่มีธุรกรรม</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DashCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="card p-4 hover:shadow-theme-md transition-all duration-300">
      <div className="w-10 h-10 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center mb-3">
        <i className={`fas ${icon} text-brand-500`}></i>
      </div>
      <div className="text-xl font-bold dark:text-white">{value}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    delivered: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
    pending: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400',
    failed: 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400',
    refunded: 'bg-purple-100 text-purple-700',
  };
  const labels: Record<string, string> = {
    delivered: 'สำเร็จ',
    pending: 'รอดำเนินการ',
    failed: 'ล้มเหลว',
    refunded: 'คืนเงิน',
  };
  return <span className={`badge ${styles[status] || 'bg-gray-100 text-gray-600'}`}>{labels[status] || status}</span>;
}
