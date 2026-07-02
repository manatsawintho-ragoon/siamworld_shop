'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/dateFormat';
import { useAdminAlert } from '@/components/AdminAlert';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: number;
  username: string;
  email?: string;
  role: string;
  wallet_balance: number;
  created_at: string;
  total_topup: number;
  daily_topup: number;
  weekly_topup: number;
  monthly_topup: number;
  topup_count: number;
  last_topup_at: string | null;
  avg_topup: number;
  used_codes_count: number;
  total_spent: number;
  daily_spent: number;
  daily_purchase_count: number;
  monthly_spent: number;
  purchase_count: number;
  daily_redeem_count: number;
  net_balance_rate: number;
  banned_at?: string | null;
  ban_reason?: string | null;
  banned_by_username?: string | null;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { alert: adminAlert } = useAdminAlert();
  const [user, setUser]       = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editRole,        setEditRole]        = useState('');
  const [editEmail,       setEditEmail]       = useState('');
  const [editBalance,     setEditBalance]     = useState('');
  const [savingSettings,  setSavingSettings]  = useState(false);

  // Danger-zone modals
  const [banOpen,       setBanOpen]       = useState(false);
  const [banReason,     setBanReason]     = useState('');
  const [banBusy,       setBanBusy]       = useState(false);
  const [unbanOpen,     setUnbanOpen]     = useState(false);
  const [unbanReason,   setUnbanReason]   = useState('');
  const [unbanBusy,     setUnbanBusy]     = useState(false);
  const [transferOpen,  setTransferOpen]  = useState(false);
  const [transferTo,    setTransferTo]    = useState('');
  const [transferBusy,  setTransferBusy]  = useState(false);

  const loadUser = () => {
    setLoading(true);
    api(`/admin/users/${id}`, { token: getToken()! })
      .then((d: any) => {
        setUser(d.user);
        setEditRole(d.user.role);
        setEditEmail(d.user.email || '');
        setEditBalance(String(d.user.wallet_balance || 0));
      })
      .catch((err: any) => adminAlert({ title: 'โหลดข้อมูลไม่สำเร็จ', message: err.message, type: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUser(); }, [id]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const payload: any = { role: editRole };
      if (editEmail !== (user.email || '')) payload.email = editEmail;
      if (Number(editBalance) !== user.wallet_balance) payload.balance = Number(editBalance);
      await api(`/admin/users/${id}`, { method: 'PUT', token: getToken()!, body: payload });
      adminAlert({ title: 'บันทึกข้อมูลสำเร็จ', message: 'ข้อมูลบัญชีถูกอัปเดตแล้ว', type: 'success' });
      loadUser();
    } catch (err: any) {
      adminAlert({ title: 'บันทึกไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBan = async () => {
    if (!user || !banReason.trim()) return;
    setBanBusy(true);
    try {
      await api(`/admin/users/${id}/ban`, { method: 'POST', token: getToken()!, body: { reason: banReason.trim() } });
      adminAlert({ title: 'ระงับบัญชีสำเร็จ', message: `${user.username} ถูกระงับการใช้งานแล้ว`, type: 'success' });
      setBanOpen(false);
      setBanReason('');
      loadUser();
    } catch (err: any) {
      adminAlert({ title: 'ระงับบัญชีไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      setBanBusy(false);
    }
  };

  const handleUnban = async () => {
    if (!user || !unbanReason.trim()) return;
    setUnbanBusy(true);
    try {
      await api(`/admin/users/${id}/unban`, { method: 'POST', token: getToken()!, body: { reason: unbanReason.trim() } });
      adminAlert({ title: 'ปลดระงับสำเร็จ', message: `${user.username} กลับมาใช้งานได้แล้ว`, type: 'success' });
      setUnbanOpen(false);
      setUnbanReason('');
      loadUser();
    } catch (err: any) {
      adminAlert({ title: 'ปลดระงับไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      setUnbanBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!user || !transferTo.trim()) return;
    setTransferBusy(true);
    try {
      // Resolve username → user id first. We accept either an id (numeric)
      // or a username (we'll look it up).
      let toUserId: number;
      if (/^\d+$/.test(transferTo.trim())) {
        toUserId = parseInt(transferTo.trim(), 10);
      } else {
        const res = await api<any>(`/admin/users?search=${encodeURIComponent(transferTo.trim())}&limit=1`, { token: getToken()! });
        const match = res.users?.find((u: any) => u.username.toLowerCase() === transferTo.trim().toLowerCase());
        if (!match) throw new Error('ไม่พบบัญชีปลายทาง');
        toUserId = match.id;
      }
      const r = await api<any>(`/admin/users/${id}/transfer`, { method: 'POST', token: getToken()!, body: { toUserId } });
      adminAlert({
        title: 'โอนข้อมูลสำเร็จ',
        message: `ย้ายยอด ${r.merged?.balance ?? 0} บาท + ${r.merged?.purchases ?? 0} purchases + ${r.merged?.inventory ?? 0} items`,
        type: 'success',
      });
      router.push(`/admin/users/${toUserId}`);
    } catch (err: any) {
      adminAlert({ title: 'โอนข้อมูลไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      setTransferBusy(false);
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
    <div className="flex flex-col gap-4 max-w-[1400px] mx-auto lg:h-[calc(100vh-136px)]">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-user-cog text-[#f97316]" /> จัดการข้อมูลผู้ใช้
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ดูข้อมูล · แก้ไขบัญชี · ประวัติการใช้งาน</p>
        </div>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-[#1e2735] text-white shadow-[0_4px_0_#0d131d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d131d] active:translate-y-[2px] flex-shrink-0"
        >
          <i className="fas fa-arrow-left text-xs" /> ย้อนกลับ
        </Link>
      </div>

      {/* ── Ban status banner ── */}
      {user.banned_at && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-user-slash text-red-500 text-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-700">บัญชีนี้ถูกระงับการใช้งาน</p>
            <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
              เหตุผล: {user.ban_reason || '-'}
              <span className="text-red-400"> · ระงับเมื่อ {new Date(user.banned_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {user.banned_by_username && <span className="text-red-400"> · โดย {user.banned_by_username}</span>}
            </p>
          </div>
          <button onClick={() => setUnbanOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 border border-green-600 text-white text-[11px] font-bold shadow-[0_3px_0_#15803d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#15803d] active:translate-y-[2px] flex-shrink-0">
            <i className="fas fa-unlock text-[10px]" /> ปลดระงับ
          </button>
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
                { label: 'ยอดเงินคงเหลือ', value: fmtMoney(user.wallet_balance), unit: '฿', valClass: 'text-[#f97316]', bg: 'bg-orange-50', border: 'border-orange-200', icon: 'fa-wallet', ic: 'text-orange-500' },
                { label: 'เติมเงินสุทธิ',   value: fmtMoney(user.total_topup),    unit: '฿', valClass: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'fa-arrow-up-right-dots', ic: 'text-blue-500' },
                { label: 'ยอดใช้จ่าย',      value: fmtMoney(user.total_spent),    unit: '฿', valClass: 'text-red-500',   bg: 'bg-red-50',    border: 'border-red-200',    icon: 'fa-shopping-bag', ic: 'text-red-500' },
                { label: 'ใช้โค้ดแล้ว',     value: String(user.used_codes_count || 0), unit: 'ครั้ง', valClass: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: 'fa-gift', ic: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} ${s.border} border rounded-xl p-2.5`}>
                  <div className="flex items-center gap-1 mb-1">
                    <i className={`fas ${s.icon} ${s.ic} text-[10px]`} />
                    <p className="text-[10px] font-extrabold text-gray-700 truncate">{s.label}</p>
                  </div>
                  <p className={`text-[15px] font-black tabular-nums leading-tight ${s.valClass}`}>
                    {s.value} <span className="text-[10px] font-medium">{s.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Footer: monthly + ID */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
              <div className="bg-gray-100 border border-gray-300 rounded-xl p-2.5 text-center">
                <p className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wide">Monthly Topup</p>
                <p className="text-sm font-black text-gray-800 tabular-nums">{fmtMoney(user.monthly_topup)} ฿</p>
              </div>
              <div className="bg-gray-100 border border-gray-300 rounded-xl p-2.5 text-center">
                <p className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wide">User ID</p>
                <p className="text-sm font-black text-gray-800 font-mono">#{user.id}</p>
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

            {/* Danger zone — Transfer + Ban / Unban */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fas fa-triangle-exclamation text-[10px]" /> การดำเนินการพิเศษ</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setTransferOpen(true)}
                  className="flex-1 py-2 bg-amber-500 text-white font-bold rounded-lg shadow-[0_3px_0_#b45309] text-xs">
                  <i className="fas fa-arrow-right-arrow-left mr-2" /> โอนข้อมูลไปบัญชีอื่น
                </button>
                {user.banned_at ? (
                  <button onClick={() => setUnbanOpen(true)}
                    className="flex-1 py-2 bg-green-500 text-white font-bold rounded-lg shadow-[0_3px_0_#15803d] text-xs">
                    <i className="fas fa-unlock mr-2" /> ปลดระงับการใช้งาน
                  </button>
                ) : (
                  <button onClick={() => setBanOpen(true)}
                    className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg shadow-[0_3px_0_#991b1b] text-xs">
                    <i className="fas fa-user-slash mr-2" /> ระงับการใช้งาน
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                "ระงับการใช้งาน" จะบล็อกไม่ให้ผู้ใช้ล็อกอินเข้าเว็บ แต่เก็บข้อมูลเดิมไว้ทั้งหมด (ปลดระงับได้ภายหลัง). "โอนข้อมูล" จะย้ายยอดเงิน + ประวัติการซื้อ + ของในคลังไปอีกบัญชีหนึ่ง
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Today Summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">

        {/* เติมเงินวันนี้ */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="h-1 w-full bg-blue-500" />
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-arrow-down text-blue-500 text-xs" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-800">เติมเงินวันนี้</p>
                  <p className="text-[10px] text-gray-400">{user.topup_count} ครั้งรวมทั้งหมด</p>
                </div>
              </div>
              <Link
                href={`/admin/users/${id}/history?tab=topup`}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                ดูประวัติ <i className="fas fa-arrow-right text-[8px]" />
              </Link>
            </div>
            <p className="text-3xl font-black tabular-nums text-blue-600 leading-none">{fmtMoney(user.daily_topup)}</p>
            <p className="text-[10px] text-gray-400 mt-1">฿ · รวมทั้งหมด {fmtMoney(user.total_topup)} ฿</p>
          </div>
        </div>

        {/* ซื้อของวันนี้ */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="h-1 w-full bg-orange-500" />
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <i className="fas fa-shopping-cart text-orange-500 text-xs" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-800">ซื้อของวันนี้</p>
                  <p className="text-[10px] text-gray-400">{user.daily_purchase_count} รายการวันนี้</p>
                </div>
              </div>
              <Link
                href={`/admin/users/${id}/history?tab=purchase`}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                ดูประวัติ <i className="fas fa-arrow-right text-[8px]" />
              </Link>
            </div>
            <p className="text-3xl font-black tabular-nums text-orange-600 leading-none">{fmtMoney(user.daily_spent)}</p>
            <p className="text-[10px] text-gray-400 mt-1">฿ · รวมทั้งหมด {fmtMoney(user.total_spent)} ฿</p>
          </div>
        </div>

        {/* ใช้โค้ดวันนี้ */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="h-1 w-full bg-green-500" />
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <i className="fas fa-gift text-green-500 text-xs" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-800">ใช้โค้ดวันนี้</p>
                  <p className="text-[10px] text-gray-400">{user.used_codes_count} ครั้งรวมทั้งหมด</p>
                </div>
              </div>
              <Link
                href={`/admin/users/${id}/history?tab=redeem`}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors"
              >
                ดูประวัติ <i className="fas fa-arrow-right text-[8px]" />
              </Link>
            </div>
            <p className="text-3xl font-black tabular-nums text-green-600 leading-none">{user.daily_redeem_count}</p>
            <p className="text-[10px] text-gray-400 mt-1">ครั้ง · รวมทั้งหมด {user.used_codes_count} ครั้ง</p>
          </div>
        </div>

      </div>

      {/* Ban modal */}
      {banOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => !banBusy && setBanOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <i className="fas fa-user-slash text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">ระงับการใช้งาน</h3>
                <p className="text-[11px] text-gray-500">ผู้ใช้จะล็อกอินเข้าเว็บไม่ได้ จนกว่าจะปลดระงับ</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">ระงับบัญชี <b>{user.username}</b>?</p>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">เหตุผลการระงับ <span className="text-red-500">*</span></label>
                <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={3} maxLength={500}
                  placeholder="เช่น ใช้สลิปปลอม / โกงระบบ / ละเมิดกฎ"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-red-400 resize-none" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">ประวัติการเงิน + การซื้อ + audit log จะยังถูกเก็บไว้ ผู้ใช้แค่จะ login ไม่ได้</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
              <button onClick={() => setBanOpen(false)} disabled={banBusy}
                className="px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700">ยกเลิก</button>
              <button onClick={handleBan} disabled={banBusy || !banReason.trim()}
                className="px-5 py-2.5 text-[13px] font-bold rounded-lg bg-red-500 text-white shadow-[0_3px_0_#991b1b] disabled:opacity-50">
                {banBusy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-ban mr-1.5" /> ยืนยันระงับ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unban modal */}
      {unbanOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => !unbanBusy && setUnbanOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <i className="fas fa-unlock text-green-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">ปลดระงับการใช้งาน</h3>
                <p className="text-[11px] text-gray-500">ผู้ใช้จะกลับมาล็อกอินเข้าเว็บได้อีกครั้ง</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700">ปลดระงับบัญชี <b>{user.username}</b>?</p>
              {user.ban_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  <p className="text-[11px] text-red-700 leading-relaxed"><i className="fas fa-circle-info mr-1" /> เหตุผลที่ถูกระงับ: {user.ban_reason}</p>
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">เหตุผลการปลดระงับ <span className="text-red-500">*</span></label>
                <textarea value={unbanReason} onChange={(e) => setUnbanReason(e.target.value)} rows={3} maxLength={500}
                  placeholder="เช่น ตรวจสอบแล้วเข้าใจผิด / ครบกำหนดโทษ"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-green-400 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
              <button onClick={() => setUnbanOpen(false)} disabled={unbanBusy}
                className="px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700">ยกเลิก</button>
              <button onClick={handleUnban} disabled={unbanBusy || !unbanReason.trim()}
                className="px-5 py-2.5 text-[13px] font-bold rounded-lg bg-green-500 text-white shadow-[0_3px_0_#15803d] disabled:opacity-50">
                {unbanBusy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-unlock mr-1.5" /> ยืนยันปลดระงับ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => !transferBusy && setTransferOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <i className="fas fa-arrow-right-arrow-left text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">โอนข้อมูลไปบัญชีอื่น</h3>
                <p className="text-[11px] text-gray-500">ยอดเงิน + ประวัติการซื้อ + ของในคลัง + ประวัติโค้ด</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">บัญชีปลายทาง (Username หรือ ID)</label>
                <input type="text" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="เช่น Notch หรือ 42"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  <i className="fas fa-circle-info mr-1" /> หลังโอน: บัญชี <b>{user.username}</b> จะถูก soft-delete อัตโนมัติ และข้อมูลทั้งหมดจะอยู่ที่บัญชีปลายทาง
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
              <button onClick={() => setTransferOpen(false)} disabled={transferBusy}
                className="px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700">ยกเลิก</button>
              <button onClick={handleTransfer} disabled={transferBusy || !transferTo.trim()}
                className="px-5 py-2.5 text-[13px] font-bold rounded-lg bg-amber-500 text-white shadow-[0_3px_0_#b45309] disabled:opacity-50">
                {transferBusy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-check mr-1.5" /> ยืนยันโอนข้อมูล</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
