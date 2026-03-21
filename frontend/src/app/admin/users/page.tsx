'use client';
import { useEffect, useState, useRef } from 'react';
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
    if (!confirm(`à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™ role à¹€à¸›à¹‡à¸™ ${role}?`)) return;
    try {
      setError('');
      await api(`/admin/users/${userId}/role`, { method: 'PUT', token: getToken()!, body: { role } });
      load();
    } catch (err: any) {
      const msg = err?.message || 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”';
      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('403') || msg.includes('forbidden') || msg.includes('Access denied')) {
        setError('Token à¸«à¸¡à¸”à¸­à¸²à¸¢à¸¸ à¸à¸£à¸¸à¸“à¸²à¸­à¸­à¸à¸ˆà¸²à¸à¸£à¸°à¸šà¸šà¹à¸¥à¹‰à¸§à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸«à¸¡à¹ˆ');
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
      setError(err?.message || 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”');
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
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-circle shrink-0"></i>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-users text-green-600 text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">à¸ˆà¸±à¸”à¸à¸²à¸£à¸ªà¸¡à¸²à¸Šà¸´à¸</h3>
              <p className="text-[11px] text-gray-400">à¸„à¹‰à¸™à¸«à¸² à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š à¹à¸¥à¸°à¹à¸à¹‰à¹„à¸‚à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸¡à¸²à¸Šà¸´à¸à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹ƒà¸™à¸£à¸°à¸šà¸š</p>
            </div>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {total.toLocaleString()} à¸„à¸™
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
                placeholder="à¸„à¹‰à¸™à¸«à¸²à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰..."
              />
            </div>
          </form>
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <span>à¹à¸ªà¸”à¸‡à¸„à¸£à¸±à¹‰à¸‡à¸¥à¸°</span>
            <select
              value={limit}
              onChange={e => { const l = Number(e.target.value); setLimit(l); setPage(1); load(1, search, l); }}
              className="border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>à¸£à¸²à¸¢à¸à¸²à¸£</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
            <p className="text-sm text-gray-400 mt-2">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center">
            <i className="fas fa-users-slash text-3xl text-gray-200 mb-3 block"></i>
            <p className="text-sm text-gray-400">à¹„à¸¡à¹ˆà¸žà¸šà¸ªà¸¡à¸²à¸Šà¸´à¸</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-16">ID</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">à¸ªà¸¡à¸±à¸„à¸£à¹€à¸¡à¸·à¹ˆà¸­</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Role</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">à¸ˆà¸±à¸”à¸à¸²à¸£</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">#{u.id}</td>
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
                      <p className="text-[11px] text-gray-400">
                        {new Date(u.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} à¸™.
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-800">
                        {parseFloat(String(u.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">à¸¿</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className={`text-[11px] font-bold px-3 py-1 rounded-full border-0 focus:outline-none focus:ring-2 cursor-pointer appearance-none ${
                          u.role === 'admin'
                            ? 'bg-orange-100 text-orange-600 focus:ring-orange-300'
                            : 'bg-gray-100 text-gray-600 focus:ring-gray-300'
                        }`}
                      >
                        <option value="user">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => { setTopupModal(u); setTopupAmount(''); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e] hover:brightness-110 transition-all"
                          title="à¹€à¸•à¸´à¸¡à¹€à¸‡à¸´à¸™"
                        >
                          <i className="fas fa-wallet text-xs"></i>
                        </button>
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
              à¹à¸ªà¸”à¸‡ {Math.min((page - 1) * limit + 1, total).toLocaleString()}â€“{Math.min(page * limit, total).toLocaleString()} à¸ˆà¸²à¸ {total.toLocaleString()} à¸£à¸²à¸¢à¸à¸²à¸£
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
                  <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">â€¦</span>
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
      {topupModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onMouseDown={() => { backdropDown.current = true; }}
          onMouseUp={e => { if (backdropDown.current && e.target === e.currentTarget) setTopupModal(null); backdropDown.current = false; }}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-wallet text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm">à¹€à¸•à¸´à¸¡à¹€à¸‡à¸´à¸™</h3>
                <p className="text-[11px] text-gray-400 truncate">à¹€à¸žà¸´à¹ˆà¸¡à¸¢à¸­à¸”à¹€à¸‡à¸´à¸™à¹ƒà¸«à¹‰à¸ªà¸¡à¸²à¸Šà¸´à¸ {topupModal.username}</p>
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
                  <p className="text-xs text-gray-400">
                    à¸¢à¸­à¸”à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™: <span className="font-bold text-gray-700">{parseFloat(String(topupModal.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} à¸¿</span>
                  </p>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">à¸ˆà¸³à¸™à¸§à¸™à¹€à¸‡à¸´à¸™à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¹€à¸•à¸´à¸¡</label>
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
                  à¸¢à¸à¹€à¸¥à¸´à¸
                </button>
                <button
                  onClick={handleTopup}
                  disabled={topupLoading || !topupAmount || Number(topupAmount) <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e]"
                >
                  {topupLoading
                    ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> à¸à¸³à¸¥à¸±à¸‡à¹€à¸•à¸´à¸¡...</>
                    : <><i className="fas fa-plus text-[12px]"></i> à¹€à¸•à¸´à¸¡à¹€à¸‡à¸´à¸™</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
