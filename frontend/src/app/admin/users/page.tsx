'use client';
import { useEffect, useState } from 'react';
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
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(25);
  const [total, setTotal]       = useState(0);
  const [error, setError]       = useState('');

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

  useEffect(() => { load(); }, []);

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

  const adminCount   = users.filter(u => u.role === 'admin').length;
  const memberCount  = users.length - adminCount;
  const pageBalance  = users.reduce((s, u) => s + parseFloat(String(u.wallet_balance || 0)), 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-users text-[#f97316]"></i> ระบบจัดการสมาชิก
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ค้นหา ตรวจสอบ และจัดการข้อมูลสมาชิก</p>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-circle flex-shrink-0"></i>
          <span className="flex-1 text-xs">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* ── Stats mini cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'สมาชิกทั้งหมด',      value: total.toLocaleString(),      icon: 'fa-users',      color: 'text-blue-500',   bg: 'bg-blue-50'   },
          { label: 'Admin (หน้านี้)',      value: String(adminCount),          icon: 'fa-shield-alt', color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Member (หน้านี้)',     value: String(memberCount),         icon: 'fa-user-check', color: 'text-green-500',  bg: 'bg-green-50'  },
          { label: 'ยอดเงินรวม (หน้านี้)', value: `${pageBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`, icon: 'fa-wallet', color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${s.icon} ${s.color} text-sm`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-gray-800 tabular-nums truncate">{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-users text-green-600 text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">รายชื่อสมาชิก</h3>
              <p className="text-[11px] text-gray-400">ทั้งหมด {total.toLocaleString()} คน</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <form onSubmit={handleSearch} className="flex-1 min-w-[180px] max-w-sm">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs"></i>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                placeholder="ค้นหาชื่อผู้ใช้..."
              />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setPage(1); load(1, '', limit); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-xs">
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </form>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
            <span>แสดง</span>
            <select
              value={limit}
              onChange={e => { const l = Number(e.target.value); setLimit(l); setPage(1); load(1, search, l); }}
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-[#637469] transition-colors"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>รายการ/หน้า</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <i className="fas fa-spinner fa-spin text-2xl text-orange-400"></i>
            <p className="text-xs text-gray-400 mt-2">กำลังโหลด...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <i className="fas fa-users-slash text-3xl mb-3 text-gray-200"></i>
            <p className="text-sm font-medium">ไม่พบสมาชิก</p>
            <p className="text-xs text-gray-300 mt-1">ลองเปลี่ยนคำค้นหา</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest w-16">ID</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">สมาชิก</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden md:table-cell">สมัครเมื่อ</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">ยอดเงิน</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Role</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-gray-400">#{u.id}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                          <img
                            src={`https://mc-heads.net/avatar/${u.username}/32`}
                            alt={u.username}
                            className="w-full h-full"
                            style={{ imageRendering: 'pixelated' }}
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }}
                          />
                          <div className="w-full h-full items-center justify-center hidden">
                            <i className="fas fa-user text-gray-400 text-xs"></i>
                          </div>
                        </div>
                        <span className="font-bold text-gray-800 text-[13px]">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="text-[13px] font-semibold text-gray-700">
                        {new Date(u.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(u.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="font-black text-gray-800 tabular-nums text-[13px]">
                        {parseFloat(String(u.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        <span className="text-[10px] font-medium text-gray-400 ml-1">บาท</span>
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-500 text-white">
                          <i className="fas fa-shield-alt text-[8px]"></i> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-green-500 text-white">
                          <i className="fas fa-user-check text-[8px]"></i> Member
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 border border-amber-600 text-white text-[11px] font-bold shadow-[0_3px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b45309] active:translate-y-[2px]"
                          title="ดูข้อมูล / จัดการ"
                        >
                          <i className="fas fa-pen text-[10px]"></i> จัดการ
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
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-gray-400">
              แสดง {Math.min((page - 1) * limit + 1, total).toLocaleString()}–{Math.min(page * limit, total).toLocaleString()} จาก {total.toLocaleString()} รายการ
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goPage(page - 1)} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">&hellip;</span>
                ) : (
                  <button key={p} onClick={() => goPage(p as number)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      page === p
                        ? 'bg-[#1e2735] text-white shadow-[0_3px_0_#38404d]'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >{p}</button>
                )
              )}
              <button
                onClick={() => goPage(page + 1)} disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
