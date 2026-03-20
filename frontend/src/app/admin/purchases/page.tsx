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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <i className="fas fa-receipt mr-2 text-gray-400"></i>ธุรกรรม
        </h1>
        <button onClick={load} className="btn-ghost text-sm"><i className="fas fa-rotate"></i> รีเฟรช</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ผู้ซื้อ</th>
                  <th>สินค้า</th>
                  <th>เซิร์ฟเวอร์</th>
                  <th>ราคา</th>
                  <th>สถานะ</th>
                  <th>วันที่</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td className="text-gray-400">{p.id}</td>
                    <td className="font-medium">{p.username}</td>
                    <td>{p.product_name}</td>
                    <td><span className="badge bg-gray-100 text-gray-700">{p.server_name}</span></td>
                    <td className="font-medium">{p.price?.toLocaleString()} ฿</td>
                    <td>
                      <span className={`badge ${
                        p.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        p.status === 'failed' ? 'bg-red-100 text-red-700' :
                        p.status === 'refunded' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {p.status === 'delivered' ? 'สำเร็จ' : p.status === 'pending' ? 'รอ' : p.status === 'failed' ? 'ล้มเหลว' : p.status === 'refunded' ? 'คืนเงิน' : p.status}
                      </span>
                    </td>
                    <td className="text-gray-400 text-xs">{new Date(p.created_at).toLocaleString('th-TH')}</td>
                    <td>
                      {(p.status === 'failed' || p.status === 'pending') && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRetry(p.id)}
                            disabled={actionLoading === p.id}
                            className="btn bg-gray-100 text-gray-600 text-xs px-2 py-1"
                            title="ส่งของใหม่"
                          >
                            {actionLoading === p.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-redo"></i>}
                          </button>
                          <button
                            onClick={() => handleRefund(p.id)}
                            disabled={actionLoading === p.id}
                            className="btn bg-red-50 text-red-600 text-xs px-2 py-1"
                            title="คืนเงิน"
                          >
                            <i className="fas fa-rotate-left"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-8">ยังไม่มีธุรกรรม</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
