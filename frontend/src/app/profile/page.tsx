'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useAdminAlert } from '@/components/AdminAlert';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: number;
  username: string;
  email?: string;
  role: string;
  wallet_balance: number;
  total_topup: number;
  total_spent: number;
  purchase_count: number;
  topup_count: number;
  created_at: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description?: string;
  status?: string;
  created_at: string;
}

interface Pagination {
  page: number;
  totalPages: number;
  total: number;
}

const TX_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  topup:        { label: 'เติมเงิน',     icon: 'fa-arrow-down',        color: 'text-green-600',  bg: 'bg-green-50' },
  purchase:     { label: 'ซื้อของ',      icon: 'fa-arrow-up',          color: 'text-red-500',    bg: 'bg-red-50' },
  refund:       { label: 'คืนเงิน',      icon: 'fa-rotate-left',       color: 'text-amber-500',  bg: 'bg-amber-50' },
  redeem_code:  { label: 'ใช้โค้ด',      icon: 'fa-ticket-alt',        color: 'text-blue-500',   bg: 'bg-blue-50' },
  admin_adjust: { label: 'Admin',        icon: 'fa-shield-alt',         color: 'text-purple-500', bg: 'bg-purple-50' },
};

const CARD = 'bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden';
const SECTION_HEADER = 'px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5';

export default function ProfilePage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const { alert: showAlert } = useAdminAlert();

  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination]     = useState<Pagination>({ page: 1, totalPages: 1, total: 0 });
  const [txLoading, setTxLoading]       = useState(true);

  // Change password form
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwSaving, setPwSaving]     = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/'); return; }
    if (!authLoading && user) {
      api('/user/profile', { token: getToken()! })
        .then(d => setProfile(d.user as UserProfile))
        .finally(() => setProfileLoading(false));
    }
  }, [authLoading, user]);

  const loadTx = (page: number) => {
    setTxLoading(true);
    api(`/wallet/transactions?page=${page}&limit=10`, { token: getToken()! })
      .then(d => {
        setTransactions((d.transactions as Transaction[]) || []);
        setPagination(d.pagination as Pagination);
      })
      .finally(() => setTxLoading(false));
  };

  useEffect(() => {
    if (!authLoading && user) loadTx(1);
  }, [authLoading, user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) {
      showAlert({ type: 'warning', title: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    if (newPw !== confirmPw) {
      showAlert({ type: 'error', title: 'รหัสผ่านใหม่ไม่ตรงกัน' }); return;
    }
    if (newPw.length < 8) {
      showAlert({ type: 'warning', title: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' }); return;
    }
    setPwSaving(true);
    try {
      await api('/user/change-password', {
        method: 'POST',
        token: getToken()!,
        body: { currentPassword: currentPw, newPassword: newPw },
      });
      showAlert({ type: 'success', title: 'เปลี่ยนรหัสผ่านสำเร็จ' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      showAlert({ type: 'error', title: 'เปลี่ยนรหัสผ่านไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setPwSaving(false);
    }
  };

  const inputCls = 'w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white';

  const isPositive = (type: string) => type === 'topup' || type === 'refund';

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-user text-[#f97316]" /> โปรไฟล์
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ข้อมูลบัญชีและประวัติธุรกรรม</p>
        </div>

        {/* ── Profile Card ── */}
        <div className={CARD}>
          <div className="px-5 py-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              {/* Avatar + name */}
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-md overflow-hidden flex-shrink-0 bg-green-50">
                  {profileLoading ? (
                    <div className="w-full h-full bg-gray-100 animate-pulse" />
                  ) : (
                    <img
                      src={`https://mc-heads.net/avatar/${profile?.username || 'steve'}/64`}
                      alt={profile?.username}
                      className="w-full h-full"
                      style={{ imageRendering: 'pixelated' }}
                      onError={e => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/64'; }}
                    />
                  )}
                </div>
                <div className="mb-1">
                  {profileLoading ? (
                    <div className="h-6 w-32 bg-gray-100 rounded animate-pulse mb-2" />
                  ) : (
                    <h2 className="text-xl font-black text-gray-900 leading-tight">{profile?.username}</h2>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {profile?.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-500 text-white">
                        <i className="fas fa-shield-alt text-[8px]" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-green-500 text-white">
                        <i className="fas fa-user-check text-[8px]" /> Member
                      </span>
                    )}
                    {profile?.email && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <i className="fas fa-envelope text-[10px]" /> {profile.email}
                      </span>
                    )}
                    {profile?.created_at && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <i className="fas fa-calendar text-[10px]" />
                        สมาชิกตั้งแต่ {new Date(profile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Wallet balance highlight */}
              {!profileLoading && profile && (
                <div className="bg-[#168d41] rounded-xl px-4 py-3 text-white shadow-[0_4px_0_#0f6530] border border-[#1faa4f]/30 flex items-center gap-3 flex-shrink-0">
                  <div className="w-9 h-9 bg-black/15 border border-white/20 rounded-xl flex items-center justify-center">
                    <i className="fas fa-coins text-white text-sm" />
                  </div>
                  <div>
                    <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">ยอดเงินคงเหลือ</p>
                    <p className="text-white font-black text-xl tabular-nums leading-tight">
                      {profile.wallet_balance?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      <span className="text-white/60 text-sm font-medium ml-1">฿</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats row */}
            {!profileLoading && profile && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { icon: 'fa-arrow-down', bg: 'bg-green-50', ic: 'text-green-600', label: 'เติมเงินรวม', value: `฿${profile.total_topup.toLocaleString()}` },
                  { icon: 'fa-arrow-up',   bg: 'bg-red-50',   ic: 'text-red-500',   label: 'ใช้จ่ายรวม',  value: `฿${profile.total_spent.toLocaleString()}` },
                  { icon: 'fa-bag-shopping', bg: 'bg-amber-50', ic: 'text-amber-500', label: 'รายการซื้อ', value: `${profile.purchase_count} ครั้ง` },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                      <i className={`fas ${s.icon} ${s.ic} text-sm`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-800 tabular-nums truncate">{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Change Password ── */}
        <div className={CARD}>
          <div className={SECTION_HEADER}>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-key text-amber-500 text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">เปลี่ยนรหัสผ่าน</h3>
              <p className="text-[11px] text-gray-400">รหัสผ่าน Authme สำหรับเข้าเกม</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'รหัสผ่านปัจจุบัน', icon: 'fa-lock', value: currentPw, setter: setCurrentPw, placeholder: 'รหัสผ่าน Authme ที่ใช้อยู่' },
                { label: 'รหัสผ่านใหม่',     icon: 'fa-key',  value: newPw,     setter: setNewPw,     placeholder: 'อย่างน้อย 8 ตัวอักษร' },
                { label: 'ยืนยันรหัสผ่านใหม่', icon: 'fa-check-circle', value: confirmPw, setter: setConfirmPw, placeholder: 'พิมพ์รหัสผ่านใหม่อีกครั้ง' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                      <i className={`fas ${f.icon} text-sm`} />
                    </div>
                    <input
                      type="password"
                      placeholder={f.placeholder}
                      value={f.value}
                      onChange={e => f.setter(e.target.value)}
                      disabled={pwSaving}
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={pwSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
                {pwSaving
                  ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังบันทึก...</>
                  : <><i className="fas fa-save text-[12px]" /> บันทึกรหัสผ่าน</>}
              </button>
            </div>
          </form>
        </div>

        {/* ── Transaction History ── */}
        <div className={CARD}>
          <div className={`${SECTION_HEADER} justify-between`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-clock-rotate-left text-green-600 text-xs" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">ประวัติธุรกรรม</h3>
                <p className="text-[11px] text-gray-400">รายการทั้งหมด {pagination.total} รายการ</p>
              </div>
            </div>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center py-16">
              <i className="fas fa-spinner fa-spin text-2xl text-green-500" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <i className="fas fa-receipt text-3xl mb-3 text-gray-300" />
              <p className="text-sm font-medium">ยังไม่มีธุรกรรม</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="px-5 py-3 font-medium">ประเภท</th>
                      <th className="px-5 py-3 font-medium">จำนวนเงิน</th>
                      <th className="px-5 py-3 font-medium hidden sm:table-cell">รายละเอียด</th>
                      <th className="px-5 py-3 font-medium text-right">วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map(tx => {
                      const cfg = TX_CONFIG[tx.type] || { label: tx.type, icon: 'fa-circle', color: 'text-gray-400', bg: 'bg-gray-50' };
                      const positive = isPositive(tx.type);
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-md ${cfg.bg} ${cfg.color}`}>
                              <i className={`fas ${cfg.icon} text-[10px]`} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-black text-sm tabular-nums ${positive ? 'text-green-600' : 'text-red-500'}`}>
                              {positive ? '+' : '-'}฿{Math.abs(parseFloat(String(tx.amount))).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <span className="text-gray-400 text-[12px] max-w-[220px] truncate block">{tx.description || '—'}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-gray-400 text-[11px] tabular-nums whitespace-nowrap">
                              {new Date(tx.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    หน้า {pagination.page} จาก {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => loadTx(pagination.page - 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-[0_2px_0_#e5e7eb] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <i className="fas fa-chevron-left text-[11px]" />
                    </button>
                    {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                      const p = pagination.totalPages <= 5
                        ? i + 1
                        : pagination.page <= 3
                          ? i + 1
                          : pagination.page >= pagination.totalPages - 2
                            ? pagination.totalPages - 4 + i
                            : pagination.page - 2 + i;
                      return (
                        <button key={p} onClick={() => loadTx(p)}
                          className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-all ${
                            p === pagination.page
                              ? 'bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e]'
                              : 'bg-white border border-gray-200 text-gray-500 shadow-[0_2px_0_#e5e7eb] hover:brightness-95'
                          }`}>
                          {p}
                        </button>
                      );
                    })}
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadTx(pagination.page + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-[0_2px_0_#e5e7eb] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <i className="fas fa-chevron-right text-[11px]" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
