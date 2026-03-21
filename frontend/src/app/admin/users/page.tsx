'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import Link from 'next/link';

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
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [topupModal, setTopupModal] = useState<User | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [error, setError] = useState('');
  const backdropDown = useRef(false);

  const totalPages = Math.ceil(total / limit);

  const load = (p = page, s = search, l = limit) => {
    setLoading(true);
    api(`/admin/users?page=${p}&limit=${l}&search=${encodeURIComponent(s)}`, { token: getToken()! })
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
    load(1, search, limit);
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
    if (!topupModal || !topupAmount || Number(topupAmount) <= 0) return;
    setTopupLoading(true);
    try {
      setError('');
      await api(`/admin/users/${topupModal.id}/topup`, { method: 'POST', token: getToken()!, body: { amount: Number(topupAmount), description: 'Admin top-up' } });
      setTopupModal(null);
      setTopupAmount('');
      load();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
    }
    setTopupLoading(false);
  };

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    load(p, search, limit);
  };

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="space-y-4">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">
          <i className="fas fa-users mr-2 text-[#f97316]"></i>ระบบจัดการสมาชิก
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">ค้นหา ตรวจสอบ เปลี่ยน Role และเติมเงินให้สมาชิก</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-circle shrink-0"></i>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-users text-green-600 text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">จัดการสมาชิก</h3>
              <p className="text-[11px] text-gray-500">ค้นหา ตรวจสอบ และแก้ไขข้อมูลสมาชิกทั้งหมดในระบบ</p>
            </div>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {total.toLocaleString()} คน
          </span>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="flex-1 max-w-sm">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300"
                placeholder="ค้นหาชื่อผู้ใช้..."
              />
            </div>
          </form>
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <span>แสดงครั้งละ</span>
            <select
              value={limit}
              onChange={e => { const l = Number(e.target.value); setLimit(l); setPage(1); load(1, search, l); }}
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>รายการ</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
            <p className="text-sm text-gray-400 mt-2">กำลังโหลด...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center">
            <i className="fas fa-users-slash text-3xl text-gray-200 mb-3 block"></i>
            <p className="text-sm text-gray-400">ไม่พบสมาชิก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest w-16">ID</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">ชื่อผู้ใช้</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">สมัครเมื่อ</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">ยอดเงิน</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">สถานะ (ROLE)</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">#{u.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={`https://mc-heads.net/avatar/${u.username}/32`}
                          alt={u.username}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-lg shrink-0"
                          style={{ imageRendering: 'pixelated' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/32'; }}
                        />
                        <span className="font-semibold text-gray-800">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-gray-700 font-medium">
                        {new Date(u.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {new Date(u.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-800">
                        {parseFloat(String(u.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">฿</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center">
                        {u.role === 'admin' ? (
                          <span className="px-3 py-1 bg-gradient-to-r from-orange-400 to-[#f97316] text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-[0_2px_0_rgba(194,65,12,0.4)] flex items-center gap-1.5">
                            <i className="fas fa-star text-[8px]"></i> ADMIN
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black rounded-full uppercase tracking-widest border border-gray-200 shadow-sm flex items-center gap-1.5">
                            <i className="fas fa-user text-[8px]"></i> MEMBER
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-white hover:text-[#f97316] hover:border-[#f97316] transition-all shadow-sm"
                          title="แก้ไขข้อมูล"
                        >
                          <i className="fas fa-edit text-sm"></i>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              แสดง {Math.min((page - 1) * limit + 1, total).toLocaleString()}&ndash;{Math.min(page * limit, total).toLocaleString()} จาก {total.toLocaleString()} รายการ
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">&hellip;</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goPage(p as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      page === p
                        ? 'bg-[#1e2735] text-white shadow-[0_3px_0_#38404d]'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => goPage(page + 1)}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Topup Modal */}
      {topupModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onMouseDown={() => { backdropDown.current = true; }}
          onMouseUp={e => { if (backdropDown.current && e.target === e.currentTarget) setTopupModal(null); backdropDown.current = false; }}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-3.5 border-b border-gray-100 bg-slate-50/70 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-wallet text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm">เติมเงิน</h3>
                <p className="text-[11px] text-gray-500 truncate">เพิ่มยอดเงินให้สมาชิก {topupModal.username}</p>
              </div>
              <button
                onClick={() => setTopupModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all text-xs shrink-0"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* User info card */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <img
                  src={`https://mc-heads.net/avatar/${topupModal.username}/40`}
                  alt={topupModal.username}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg shrink-0"
                  style={{ imageRendering: 'pixelated' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/40'; }}
                />
                <div>
                  <p className="font-bold text-sm text-gray-800">{topupModal.username}</p>
                  <p className="text-xs text-gray-500">
                    ยอดปัจจุบัน: <span className="font-bold text-gray-700">{parseFloat(String(topupModal.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                  </p>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">จำนวนเงินที่ต้องการเติม</label>
                <div className="relative">
                  <i className="fas fa-baht-sign absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm"></i>
                  <input
                    type="number"
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300"
                    placeholder="0.00"
                    min={1}
                    autoFocus
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setTopupModal(null)}
                  className="flex-1 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleTopup}
                  disabled={topupLoading || !topupAmount || Number(topupAmount) <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e]"
                >
                  {topupLoading
                    ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> กำลังเติม...</>
                    : <><i className="fas fa-plus text-[12px]"></i> เติมเงิน</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
