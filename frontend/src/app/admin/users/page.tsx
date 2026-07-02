'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  role: string;
  wallet_balance: number;
  created_at: string;
  banned_at?: string | null;
  ban_reason?: string | null;
  total_topup?: number;
  total_spent?: number;
}

interface BannedUser {
  id: number;
  username: string;
  role: string;
  banned_at: string;
  ban_reason: string | null;
  banned_by_username: string | null;
  wallet_balance: number;
}

type SortBy = 'id' | 'wallet_balance' | 'total_topup' | 'total_spent' | 'created_at';

const SORT_LABELS: Record<SortBy, string> = {
  id: 'ลำดับ (ID)',
  wallet_balance: 'ยอดเงินคงเหลือ',
  total_topup: 'ยอดเติมรวม',
  total_spent: 'ยอดใช้จ่ายรวม',
  created_at: 'วันที่สมัคร',
};

export default function AdminUsers() {
  const { alert: adminAlert } = useAdminAlert();
  const [view, setView]         = useState<'all' | 'banned'>('all');
  const [users, setUsers]       = useState<User[]>([]);
  const [banned, setBanned]     = useState<BannedUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(25);
  const [total, setTotal]       = useState(0);
  const [error, setError]       = useState('');

  // Filters
  const [sortBy, setSortBy]         = useState<SortBy>('id');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [fRole, setFRole]           = useState<'' | 'admin' | 'user'>('');
  const [fStatus, setFStatus]       = useState<'' | 'active' | 'banned'>('');
  const [fHasBalance, setFHasBalance] = useState(false);
  const [fHasTopup, setFHasTopup]   = useState(false);
  const [fHasPurchase, setFHasPurchase] = useState(false);
  const [fOnline, setFOnline]       = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const buildQuery = (p: number, s: string, l: number) => {
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', String(l));
    if (s) params.set('search', s);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    if (fRole) params.set('role', fRole);
    if (fStatus) params.set('status', fStatus);
    if (fHasBalance) params.set('hasBalance', '1');
    if (fHasTopup) params.set('hasTopup', '1');
    if (fHasPurchase) params.set('hasPurchase', '1');
    if (fOnline) params.set('online', '1');
    return params.toString();
  };

  const load = (p = page, s = search, l = limit) => {
    setLoading(true);
    api(`/admin/users?${buildQuery(p, s, l)}`, { token: getToken()! })
      .then(d => {
        setUsers((d.users as User[]) || []);
        setTotal((d.total as number) || 0);
      })
      .finally(() => setLoading(false));
  };

  const loadBanned = () => {
    setLoading(true);
    api('/admin/users/banned', { token: getToken()! })
      .then(d => setBanned((d.users as BannedUser[]) || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (view === 'all') load(1, search, limit);
    else loadBanned();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Re-load when filters change (all-view only)
  useEffect(() => {
    if (view !== 'all') return;
    setPage(1);
    load(1, search, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir, fRole, fStatus, fHasBalance, fHasTopup, fHasPurchase, fOnline]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1, search, limit);
  };

  const handleUnban = async (userId: number, username: string) => {
    const reason = await promptReason('ปลดระงับบัญชี', `เหตุผลการปลดระงับ ${username}`);
    if (reason === null) return;
    try {
      setError('');
      await api(`/admin/users/${userId}/unban`, { method: 'POST', token: getToken()!, body: { reason } });
      adminAlert({ title: 'ปลดระงับสำเร็จ', message: `${username} กลับมาใช้งานได้แล้ว`, type: 'success' });
      loadBanned();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
    }
  };

  // Lightweight reason prompt built on the confirm modal + window.prompt fallback.
  const promptReason = async (title: string, label: string): Promise<string | null> => {
    const value = typeof window !== 'undefined' ? window.prompt(`${title}\n${label}`) : null;
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) { adminAlert({ title: 'ต้องระบุเหตุผล', message: 'กรุณากรอกเหตุผล', type: 'warning' }); return null; }
    return trimmed;
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

  const resetFilters = () => {
    setSortBy('id'); setSortDir('desc'); setFRole(''); setFStatus('');
    setFHasBalance(false); setFHasTopup(false); setFHasPurchase(false); setFOnline(false);
  };
  const activeFilterCount = [fRole, fStatus].filter(Boolean).length
    + [fHasBalance, fHasTopup, fHasPurchase, fOnline].filter(Boolean).length
    + (sortBy !== 'id' || sortDir !== 'desc' ? 1 : 0);

  const adminCount   = users.filter(u => u.role === 'admin').length;
  const memberCount  = users.length - adminCount;
  const pageBalance  = users.reduce((s, u) => s + parseFloat(String(u.wallet_balance || 0)), 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-users text-[#f97316]"></i> ระบบจัดการสมาชิก
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ค้นหา ตรวจสอบ กรอง และจัดการข้อมูลสมาชิก</p>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setView('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className="fas fa-users mr-1.5 text-[10px]" /> สมาชิกทั้งหมด
          </button>
          <button onClick={() => setView('banned')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'banned' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className="fas fa-user-slash mr-1.5 text-[10px]" /> ผู้ถูกระงับ
          </button>
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

      {view === 'banned' ? (
        /* ── Banned users table ── */
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-red-50/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-user-slash text-red-600 text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">รายชื่อผู้ถูกระงับ</h3>
              <p className="text-[11px] text-gray-400">ทั้งหมด {banned.length.toLocaleString()} คน</p>
            </div>
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <i className="fas fa-spinner fa-spin text-2xl text-red-400"></i>
              <p className="text-xs text-gray-400 mt-2">กำลังโหลด...</p>
            </div>
          ) : banned.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="fas fa-user-check text-3xl mb-3 text-gray-200"></i>
              <p className="text-sm font-medium">ไม่มีผู้ถูกระงับ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">สมาชิก</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">เหตุผล</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden md:table-cell">ระงับเมื่อ</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden lg:table-cell">โดยแอดมิน</th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {banned.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2.5 group">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                            <img src={`https://mc-heads.net/avatar/${u.username}/32`} alt={u.username} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                          </div>
                          <span className="font-bold text-gray-800 text-[13px] group-hover:text-red-600 transition-colors">{u.username}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5"><span className="text-[13px] text-gray-600">{u.ban_reason || '-'}</span></td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-[13px] text-gray-600">{new Date(u.banned_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell"><span className="text-[13px] text-gray-500">{u.banned_by_username || '-'}</span></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleUnban(u.id, u.username)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 border border-green-600 text-white text-[11px] font-bold shadow-[0_3px_0_#15803d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#15803d] active:translate-y-[2px]">
                            <i className="fas fa-unlock text-[10px]"></i> ปลดระงับ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <>
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
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors flex-shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'bg-[#1e2735] border-[#1e2735] text-white'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-sliders text-[11px]"></i> ตัวกรอง
            {activeFilterCount > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[#1e2735] text-[10px] flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
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

        {/* Filter panel */}
        {showFilters && (
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              {/* Sort */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">เรียงตาม</label>
                <div className="flex items-center gap-1.5">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                    className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-[#637469]">
                    {(Object.keys(SORT_LABELS) as SortBy[]).map(k => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
                  </select>
                  <button type="button" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                    title={sortDir === 'asc' ? 'น้อย → มาก' : 'มาก → น้อย'}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors">
                    <i className={`fas ${sortDir === 'asc' ? 'fa-arrow-up-9-1' : 'fa-arrow-down-9-1'} text-xs`}></i>
                  </button>
                </div>
              </div>
              {/* Role */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Role</label>
                <select value={fRole} onChange={e => setFRole(e.target.value as any)}
                  className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-[#637469]">
                  <option value="">ทั้งหมด</option>
                  <option value="admin">Admin</option>
                  <option value="user">Member</option>
                </select>
              </div>
              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">สถานะ</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value as any)}
                  className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:border-[#637469]">
                  <option value="">ทั้งหมด</option>
                  <option value="active">ปกติ</option>
                  <option value="banned">ถูกระงับ</option>
                </select>
              </div>
              {/* Reset */}
              {activeFilterCount > 0 && (
                <button type="button" onClick={resetFilters}
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                  <i className="fas fa-rotate-left mr-1 text-[10px]"></i> ล้างตัวกรอง
                </button>
              )}
            </div>
            {/* Toggle chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { on: fHasBalance,  set: setFHasBalance,  icon: 'fa-wallet',        label: 'มีเงินคงเหลือ' },
                { on: fHasTopup,    set: setFHasTopup,    icon: 'fa-money-bill-wave', label: 'เคยเติมเงิน' },
                { on: fHasPurchase, set: setFHasPurchase, icon: 'fa-bag-shopping',  label: 'เคยซื้อของ' },
                { on: fOnline,      set: setFOnline,      icon: 'fa-signal',        label: 'กำลังออนไลน์' },
              ].map(c => (
                <button key={c.label} type="button" onClick={() => c.set(!c.on)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    c.on ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  <i className={`fas ${c.icon} text-[10px]`}></i> {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <p className="text-xs text-gray-300 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest w-16">ID</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">สมาชิก</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden md:table-cell">สมัครเมื่อ</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden lg:table-cell">เติมรวม</th>
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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-[13px]">{u.username}</span>
                          {u.banned_at && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600" title={u.ban_reason || 'ถูกระงับ'}>
                              <i className="fas fa-ban text-[8px]"></i> ระงับอยู่
                            </span>
                          )}
                        </div>
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
                    <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-[13px] tabular-nums text-gray-500">
                        {parseFloat(String(u.total_topup || 0)).toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                      </span>
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
      </>
      )}

    </div>
  );
}
