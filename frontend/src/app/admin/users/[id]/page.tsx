'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import RconModal from '@/components/RconModal';
import { fmtDate, fmtMoney } from '@/lib/dateFormat';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: number;
  username: string;
  email?: string;
  role: string;
  wallet_balance: number;
  created_at: string;
  total_topup: number;
  monthly_topup: number;
  used_codes_count: number;
  total_spent: number;
}

interface HistoryLog {
  id: number;
  amount?: number;
  point_amount?: number;
  balance_after?: number;
  created_at: string;
  description?: string;
  reference_id?: string;
  reward_type?: string;
  command?: string;
}

interface TabState {
  logs: HistoryLog[];
  total: number;
  page: number;
  loading: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 5;
const initTab = (): TabState => ({ logs: [], total: 0, page: 1, loading: false });

// ─── History Mini Card ────────────────────────────────────────────────────────

function HistoryMiniCard({
  title, icon, iconBg, iconColor, tab, totalLink, onPageChange, children,
}: {
  title: string; icon: string; iconBg: string; iconColor: string;
  tab: TabState; totalLink: string;
  onPageChange: (p: number) => void;
  children: (log: HistoryLog) => React.ReactNode;
}) {
  const totalPages = Math.ceil(tab.total / PREVIEW_LIMIT);
  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5 flex-shrink-0">
        <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <i className={`fas ${icon} ${iconColor} text-[10px]`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-xs">{title}</h3>
          <p className="text-[10px] text-gray-400">
            {tab.loading ? '...' : `${tab.total.toLocaleString()} รายการ`}
          </p>
        </div>
        <Link
          href={totalLink}
          className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-[#1e2735] transition-colors flex-shrink-0 px-1.5 py-1 rounded-md hover:bg-gray-100"
        >
          ดูทั้งหมด <i className="fas fa-arrow-right text-[8px]" />
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab.loading ? (
          <div className="flex items-center justify-center py-8">
            <i className="fas fa-spinner fa-spin text-lg text-gray-200" />
          </div>
        ) : tab.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-300 gap-1.5">
            <i className="fas fa-inbox text-xl" />
            <p className="text-xs text-gray-400">ไม่มีข้อมูล</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50/80">
            {tab.logs.map(log => children(log))}
          </div>
        )}
      </div>

      {/* Mini Pagination */}
      {totalPages > 1 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] text-gray-400">
            หน้า <span className="font-bold text-gray-600">{tab.page}</span> / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (tab.page > 1) onPageChange(tab.page - 1); }}
              disabled={tab.page === 1 || tab.loading}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors text-[9px]"
            >
              <i className="fas fa-chevron-left" />
            </button>
            <button
              onClick={() => { if (tab.page < totalPages) onPageChange(tab.page + 1); }}
              disabled={tab.page === totalPages || tab.loading}
              className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors text-[9px]"
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [user, setUser]       = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [topup,    setTopup]    = useState<TabState>(initTab());
  const [purchase, setPurchase] = useState<TabState>(initTab());
  const [redeem,   setRedeem]   = useState<TabState>(initTab());

  const [viewingRcon, setViewingRcon] = useState<string | null>(null);

  // Edit states
  const [editRole,        setEditRole]        = useState('');
  const [editEmail,       setEditEmail]       = useState('');
  const [editBalance,     setEditBalance]     = useState('');
  const [savingSettings,  setSavingSettings]  = useState(false);
  const [saveSuccess,     setSaveSuccess]     = useState('');

  const loadUser = () => {
    setLoading(true);
    api(`/admin/users/${id}`, { token: getToken()! })
      .then((d: any) => {
        setUser(d.user);
        setEditRole(d.user.role);
        setEditEmail(d.user.email || '');
        setEditBalance(String(d.user.wallet_balance || 0));
      })
      .catch((err: any) => setError(err.message || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้'))
      .finally(() => setLoading(false));
  };

  const loadHistory = (
    type: 'topup' | 'purchase' | 'redeem',
    page: number,
    setter: React.Dispatch<React.SetStateAction<TabState>>,
  ) => {
    setter(prev => ({ ...prev, loading: true }));
    api(`/admin/users/${id}/history?type=${type}&page=${page}&limit=${PREVIEW_LIMIT}`, { token: getToken()! })
      .then((d: any) => {
        setter({ logs: d.logs || [], total: d.pagination?.total || 0, page, loading: false });
      })
      .catch(() => setter(prev => ({ ...prev, loading: false })));
  };

  useEffect(() => {
    loadUser();
    loadHistory('topup',    1, setTopup);
    loadHistory('purchase', 1, setPurchase);
    loadHistory('redeem',   1, setRedeem);
  }, [id]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true); setSaveSuccess(''); setError('');
    try {
      const payload: any = { role: editRole };
      if (editEmail !== (user.email || '')) payload.email = editEmail;
      if (Number(editBalance) !== user.wallet_balance) payload.balance = Number(editBalance);
      await api(`/admin/users/${id}`, { method: 'PUT', token: getToken()!, body: payload });
      setSaveSuccess('บันทึกข้อมูลสำเร็จ');
      loadUser();
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) return (
    <div className="py-20 text-center">
      <i className="fas fa-spinner fa-spin text-2xl text-orange-400" />
      <p className="text-xs text-gray-400 mt-2">กำลังโหลดข้อมูล...</p>
    </div>
  );

  if (!user) return (
    <div className="py-20 text-center">
      <i className="fas fa-user-slash text-3xl text-gray-200 block mb-3" />
      <h2 className="text-base font-bold text-gray-600">ไม่พบข้อมูลผู้ใช้</h2>
      <button onClick={() => router.back()} className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">กลับ</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 max-w-[1400px] mx-auto" style={{ height: 'calc(100vh - 136px)' }}>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-user-cog text-[#f97316]" /> จัดการข้อมูลผู้ใช้
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ดูข้อมูล · แก้ไขบัญชี · ประวัติการใช้งาน</p>
        </div>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-[#1e2735] text-white shadow-[0_4px_0_#0d131d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d131d] active:translate-y-[2px]"
        >
          <i className="fas fa-arrow-left text-xs" /> ย้อนกลับ
        </Link>
      </div>

      {/* ── Banners ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0">
          <i className="fas fa-exclamation-circle flex-shrink-0 text-sm" />
          <span className="flex-1 text-xs">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 transition-colors"><i className="fas fa-times text-xs" /></button>
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0">
          <i className="fas fa-check-circle flex-shrink-0 text-sm" />
          <span className="flex-1 text-xs">{saveSuccess}</span>
          <button onClick={() => setSaveSuccess('')} className="text-green-400 hover:text-green-600 transition-colors"><i className="fas fa-times text-xs" /></button>
        </div>
      )}

      {/* ── Top: User Card + Edit ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">

        {/* ── User Card ── */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

          <div className="px-4 pt-4 pb-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200" style={{ width: 56, height: 56 }}>
                <img
                  src={`https://mc-heads.net/avatar/${user.username}/64`}
                  alt={user.username}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/64'; }}
                />
              </div>
              <div className="mb-1 min-w-0 flex-1">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide truncate">{user.username}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold mt-0.5 ${
                  user.role === 'admin' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                }`}>
                  <i className={`fas ${user.role === 'admin' ? 'fa-shield-alt' : 'fa-user-check'} text-[8px]`} />
                  {user.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-2">
              <i className="fas fa-calendar-alt text-gray-300 text-[9px]" />
              <span>สมัคร {new Date(user.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })} {new Date(user.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
            </div>

            {/* Stats 2×2 */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { label: 'ยอดเงินคงเหลือ', value: fmtMoney(user.wallet_balance), unit: '฿', valClass: 'text-[#f97316]', bg: 'bg-orange-50', icon: 'fa-wallet', ic: 'text-orange-400' },
                { label: 'เติมเงินสุทธิ',   value: fmtMoney(user.total_topup),    unit: '฿', valClass: 'text-blue-600',    bg: 'bg-blue-50',   icon: 'fa-arrow-up-right-dots', ic: 'text-blue-400' },
                { label: 'ยอดใช้จ่าย',      value: fmtMoney(user.total_spent),    unit: '฿', valClass: 'text-red-500',     bg: 'bg-red-50',    icon: 'fa-shopping-bag', ic: 'text-red-400' },
                { label: 'ใช้โค้ดแล้ว',     value: String(user.used_codes_count || 0), unit: 'ครั้ง', valClass: 'text-green-600', bg: 'bg-green-50', icon: 'fa-gift', ic: 'text-green-500' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-2.5`}>
                  <div className="flex items-center gap-1 mb-1">
                    <i className={`fas ${s.icon} ${s.ic} text-[9px]`} />
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide truncate">{s.label}</p>
                  </div>
                  <p className={`text-[15px] font-black tabular-nums leading-tight ${s.valClass}`}>
                    {s.value} <span className="text-[10px] font-medium">{s.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Footer: monthly + ID */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Monthly Topup</p>
                <p className="text-sm font-black text-gray-700 tabular-nums">{fmtMoney(user.monthly_topup)} ฿</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">User ID</p>
                <p className="text-sm font-black text-gray-700 font-mono">#{user.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Edit Card ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

          {/* Header */}
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1e2735]/10 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-pen text-[#1e2735] text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">แก้ไขข้อมูลบัญชี</h3>
              <p className="text-[11px] text-gray-400">อีเมล · ยอดเงิน · สิทธิ์การใช้งาน</p>
            </div>
          </div>

          <div className="p-4 space-y-3">

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                <i className="fas fa-envelope text-blue-400 mr-1.5" /> อีเมล (Email)
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                placeholder="example@mail.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Balance */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  <i className="fas fa-coins text-[#f97316] mr-1.5" /> จำนวนเงิน (Balance)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold select-none">฿</span>
                  <input
                    type="number"
                    value={editBalance}
                    onChange={e => setEditBalance(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 transition-colors"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  <i className="fas fa-shield-alt text-purple-400 mr-1.5" /> สิทธิ์ (Role)
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 transition-colors bg-white"
                >
                  <option value="user">Member (ผู้ใช้ทั่วไป)</option>
                  <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                </select>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-2.5 bg-[#1e2735] text-white font-black rounded-xl shadow-[0_4px_0_#0d131d] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest disabled:opacity-60"
            >
              {savingSettings
                ? <><i className="fas fa-spinner fa-spin" /> กำลังบันทึก...</>
                : <><i className="fas fa-save" /> บันทึกข้อมูลทั้งหมด</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom: History cards (3 columns) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">

        {/* ── ประวัติเติมเงิน ── */}
        <HistoryMiniCard
          title="ประวัติเติมเงิน"
          icon="fa-wallet"
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          tab={topup}
          totalLink={`/admin/users/${id}/history?tab=topup`}
          onPageChange={p => loadHistory('topup', p, setTopup)}
        >
          {log => {
            const { date, time } = fmtDate(log.created_at);
            return (
              <div key={log.id} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-blue-50/40 transition-colors">
                <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-plus text-blue-500 text-[8px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{log.description || 'เติมเงิน'}</p>
                  <p className="text-[9px] text-gray-400">{date} · {time} น.</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-black text-blue-600 tabular-nums">+{fmtMoney(log.amount)}</p>
                  {log.balance_after !== undefined && (
                    <p className="text-[9px] text-gray-400">คงเหลือ {fmtMoney(log.balance_after)}</p>
                  )}
                </div>
              </div>
            );
          }}
        </HistoryMiniCard>

        {/* ── ประวัติทำรายการ ── */}
        <HistoryMiniCard
          title="ประวัติทำรายการ"
          icon="fa-shopping-cart"
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          tab={purchase}
          totalLink={`/admin/users/${id}/history?tab=purchase`}
          onPageChange={p => loadHistory('purchase', p, setPurchase)}
        >
          {log => {
            const { date, time } = fmtDate(log.created_at);
            return (
              <div key={log.id} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-orange-50/40 transition-colors">
                <div className="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-receipt text-orange-500 text-[8px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{log.description || 'ซื้อสินค้า'}</p>
                  <p className="text-[9px] text-gray-400">{date} · {time} น.</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-black text-orange-600 tabular-nums">-{fmtMoney(log.amount)}</p>
                </div>
              </div>
            );
          }}
        </HistoryMiniCard>

        {/* ── ประวัติใช้โค้ด ── */}
        <HistoryMiniCard
          title="ประวัติใช้โค้ด"
          icon="fa-gift"
          iconBg="bg-green-50"
          iconColor="text-green-600"
          tab={redeem}
          totalLink={`/admin/users/${id}/history?tab=redeem`}
          onPageChange={p => loadHistory('redeem', p, setRedeem)}
        >
          {log => {
            const { date, time } = fmtDate(log.created_at);
            return (
              <div key={log.id} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-green-50/40 transition-colors">
                <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-ticket text-green-600 text-[8px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-700 truncate font-mono">{log.reference_id || log.description || 'โค้ด'}</p>
                  <p className="text-[9px] text-gray-400">{date} · {time} น.</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {log.reward_type === 'point' && log.point_amount !== undefined ? (
                    <p className="text-[12px] font-black text-green-600 tabular-nums">+{fmtMoney(log.point_amount)}</p>
                  ) : (
                    <button
                      onClick={() => setViewingRcon(log.command || '')}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-bold hover:bg-purple-200 active:scale-95 transition-all cursor-pointer"
                    >
                      RCON
                    </button>
                  )}
                </div>
              </div>
            );
          }}
        </HistoryMiniCard>

      </div>

      {/* ── RCON Command Modal ── */}
      {viewingRcon !== null && (
        <RconModal command={viewingRcon} onClose={() => setViewingRcon(null)} />
      )}
    </div>
  );
}
