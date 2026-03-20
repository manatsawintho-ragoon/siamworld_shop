'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface User {
  id: number;
  username: string;
  role: string;
  wallet_balance: number;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [topupModal, setTopupModal] = useState<User | null>(null);
  const [topupAmount, setTopupAmount] = useState(0);
  const [topupLoading, setTopupLoading] = useState(false);
  const [error, setError] = useState('');

  const load = (p = page, s = search) => {
    setLoading(true);
    api(`/admin/users?page=${p}&limit=20&search=${encodeURIComponent(s)}`, { token: getToken()! })
      .then(d => {
        setUsers((d.users as User[]) || []);
        setTotal((d.total as number) || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const handleRoleChange = async (userId: number, role: string) => {
    if (!confirm(`เปลี่ยน role เป็น ${role}?`)) return;
    try {
      setError('');
      await api(`/admin/users/${userId}/role`, { method: 'PUT', token: getToken()!, body: { role } });
      load();
    } catch (err: any) {
      const msg = err?.message || 'เกิดข้อผิดพลาด';
      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('403') || msg.includes('forbidden') || msg.includes('Access denied')) {
        setError('Token หมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่');
      } else {
        setError(msg);
      }
    }
  };

  const handleTopup = async () => {
    if (!topupModal || topupAmount <= 0) return;
    setTopupLoading(true);
    try {
      setError('');
      await api(`/admin/users/${topupModal.id}/topup`, { method: 'POST', token: getToken()!, body: { amount: topupAmount, description: 'Admin top-up' } });
      setTopupModal(null);
      setTopupAmount(0);
      load();
    } catch (err: any) {
      const msg = err?.message || 'เกิดข้อผิดพลาด';
      setError(msg);
    }
    setTopupLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        <i className="fas fa-users mr-2 text-gray-400"></i>จัดการผู้ใช้
        <span className="text-base font-normal text-gray-400 ml-2">({total} คน)</span>
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="ค้นหาชื่อผู้ใช้..." />
        </div>
        <button type="submit" className="btn-primary text-sm">ค้นหา</button>
      </form>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ชื่อผู้ใช้</th>
                  <th>Role</th>
                  <th>ยอดเงิน</th>
                  <th>วันที่สมัคร</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="text-gray-400">#{u.id}</td>
                    <td className="font-medium">{u.username}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-black"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="font-medium">{parseFloat(String(u.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</td>
                    <td className="text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString('th-TH')}</td>
                    <td>
                      <button onClick={() => { setTopupModal(u); setTopupAmount(0); }} className="btn btn-success text-xs px-3 py-1.5">
                        <i className="fas fa-plus"></i> เติมเงิน
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => { setPage(p => Math.max(1, p - 1)); load(Math.max(1, page - 1)); }} disabled={page === 1} className="btn-ghost text-sm py-1.5">
            <i className="fas fa-chevron-left"></i>
          </button>
          <span className="btn text-sm py-1.5 bg-gray-100 text-gray-600">หน้า {page}</span>
          <button onClick={() => { setPage(p => p + 1); load(page + 1); }} disabled={users.length < 20} className="btn-ghost text-sm py-1.5">
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {topupModal && (
        <div className="modal-overlay" onClick={() => setTopupModal(null)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4">เติมเงินให้ {topupModal.username}</h3>
              <p className="text-sm text-gray-500 mb-4">ยอดปัจจุบัน: <span className="font-bold">{parseFloat(String(topupModal.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span></p>
              <input type="number" value={topupAmount || ''} onChange={e => setTopupAmount(Number(e.target.value))} className="input mb-4" placeholder="จำนวนเงิน (฿)" min={1} autoFocus />
              <div className="flex gap-3">
                <button onClick={() => setTopupModal(null)} className="btn-ghost flex-1 justify-center">ยกเลิก</button>
                <button onClick={handleTopup} disabled={topupLoading || topupAmount <= 0} className="btn-success flex-1 justify-center">
                  {topupLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-plus"></i> เติมเงิน</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
