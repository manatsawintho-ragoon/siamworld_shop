'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface Purchase {
  id: number;
  username: string;
  product_name: string;
  price: number;
  server_name: string;
  status: string;
  created_at: string;
}

export default function AdminPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api('/admin/purchases', { token: getToken()! })
      .then(d => setPurchases((d.purchases as Purchase[]) || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRetry = async (id: number) => {
    setActionLoading(id);
    try {
      await api(`/admin/purchases/${id}/retry`, { method: 'POST', token: getToken()! });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (id: number) => {
    if (!confirm('ต้องการคืนเงินรายการนี้?')) return;
    setActionLoading(id);
    try {
      await api(`/admin/purchases/${id}/refund`, { method: 'POST', token: getToken()! });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          ระบบเติมเงิน / ธุรกรรม
        </h1>
        <button onClick={load} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-semibold transition-colors flex items-center gap-2 shadow-sm border border-gray-200">
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> รีเฟรช
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <i className="fas fa-list-ul text-[#f97316]"></i>
          <h3 className="font-bold text-gray-800 text-sm">รายการธุรกรรมทั้งหมด</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#f97316]">
            <i className="fas fa-spinner fa-spin text-3xl"></i>
            <p className="text-xs mt-3 text-gray-500 font-medium tracking-wide">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-4 font-semibold w-[5%]">#</th>
                  <th className="px-5 py-4 font-semibold w-[20%]">ผู้ซื้อ</th>
                  <th className="px-5 py-4 font-semibold w-[25%]">สินค้า</th>
                  <th className="px-5 py-4 font-semibold w-[15%]">เซิร์ฟเวอร์</th>
                  <th className="px-5 py-4 font-semibold w-[10%] text-right">ราคา</th>
                  <th className="px-5 py-4 font-semibold w-[10%] text-center">สถานะ</th>
                  <th className="px-5 py-4 font-semibold w-[15%] text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-400 font-medium">#{p.id}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://mc-heads.net/avatar/${p.username}/24`} alt="" className="w-6 h-6 rounded-md" />
                        <span className="text-sm font-bold text-gray-800">{p.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold text-gray-700">{p.product_name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-500">
                        {p.server_name}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-bold text-gray-800">{p.price?.toLocaleString()} ฿</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold ${
                        p.status === 'delivered' ? 'bg-green-50 text-green-600 border border-green-100' :
                        p.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                        p.status === 'failed' ? 'bg-red-50 text-red-600 border border-red-100' :
                        p.status === 'refunded' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        'bg-gray-50 text-gray-500 border border-gray-200'
                      }`}>
                        {p.status === 'delivered' ? <><i className="fas fa-check-circle mr-1"></i> สำเร็จ</> :
                         p.status === 'pending' ? <><i className="fas fa-clock mr-1"></i> รอ</> :
                         p.status === 'failed' ? <><i className="fas fa-times-circle mr-1"></i> ล้มเหลว</> :
                         p.status === 'refunded' ? <><i className="fas fa-rotate-left mr-1"></i> คืนเงิน</> : p.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(p.created_at).toLocaleString('th-TH')}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(p.status === 'failed' || p.status === 'pending') && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRetry(p.id)}
                            disabled={actionLoading === p.id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-50"
                            title="ส่งของใหม่"
                          >
                            {actionLoading === p.id ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-redo text-xs"></i>}
                          </button>
                          <button
                            onClick={() => handleRefund(p.id)}
                            disabled={actionLoading === p.id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors disabled:opacity-50"
                            title="คืนเงิน"
                          >
                            {actionLoading === p.id ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-rotate-left text-xs"></i>}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-12 text-sm"><i className="fas fa-receipt text-2xl mb-2 text-gray-300 block"></i>ยังไม่มีธุรกรรม</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
