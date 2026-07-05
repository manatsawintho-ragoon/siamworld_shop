'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useAdminAlert } from '@/components/AdminAlert';
import { useRouter } from 'next/navigation';
import {
  User, Shield, UserCheck, Mail, Calendar, Coins, ArrowDown, ArrowUp,
  ShoppingBag, Key, Lock, CheckCircle2, Loader2, Save, History, Receipt,
  Clock, X, ChevronLeft, ChevronRight, Ticket, RotateCcw, Circle,
  type LucideIcon,
} from 'lucide-react';

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

const TX_CONFIG: Record<string, { label: string; Icon: LucideIcon; tint: string }> = {
  topup:        { label: 'เติมเงิน', Icon: ArrowDown, tint: '34 197 94' },
  purchase:     { label: 'ซื้อของ',  Icon: ArrowUp,   tint: '239 68 68' },
  refund:       { label: 'คืนเงิน',  Icon: RotateCcw, tint: '245 158 11' },
  redeem_code:  { label: 'ใช้โค้ด',  Icon: Ticket,    tint: '59 130 246' },
  admin_adjust: { label: 'Admin',    Icon: Shield,    tint: '168 85 247' },
};

const CARD = 'bg-surface rounded-2xl shadow-theme-sm border border-border/70 overflow-hidden';
const SECTION_HEADER = 'px-5 py-3.5 border-b border-border bg-surface-hover/60 flex items-center gap-2.5';

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

  const inputCls = 'w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground-subtle bg-surface';

  const isPositive = (type: string) => type === 'topup' || type === 'refund';

  const stats = profile ? [
    { Icon: ArrowDown,   tint: '34 197 94',  label: 'เติมเงินรวม', value: `฿${profile.total_topup.toLocaleString()}` },
    { Icon: ArrowUp,     tint: '239 68 68',  label: 'ใช้จ่ายรวม',  value: `฿${profile.total_spent.toLocaleString()}` },
    { Icon: ShoppingBag, tint: '245 158 11', label: 'รายการซื้อ',  value: `${profile.purchase_count} ครั้ง` },
  ] : [];

  const pwFields: { label: string; Icon: LucideIcon; value: string; setter: (v: string) => void; placeholder: string }[] = [
    { label: 'รหัสผ่านปัจจุบัน', Icon: Lock, value: currentPw, setter: setCurrentPw, placeholder: 'รหัสผ่านที่ใช้อยู่' },
    { label: 'รหัสผ่านใหม่',     Icon: Key,  value: newPw,     setter: setNewPw,     placeholder: 'อย่างน้อย 8 ตัวอักษร' },
    { label: 'ยืนยันรหัสผ่านใหม่', Icon: CheckCircle2, value: confirmPw, setter: setConfirmPw, placeholder: 'พิมพ์รหัสผ่านใหม่อีกครั้ง' },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" strokeWidth={2.25} /> โปรไฟล์
          </h1>
          <p className="text-xs text-foreground-subtle mt-0.5">ข้อมูลบัญชีและประวัติธุรกรรม</p>
        </div>

        {/* ── Profile Card ── */}
        <div className={CARD}>
          <div className="px-5 py-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              {/* Avatar + name */}
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 rounded-2xl border-4 border-surface shadow-md overflow-hidden flex-shrink-0 bg-primary/10">
                  {profileLoading ? (
                    <div className="w-full h-full bg-surface-hover animate-pulse" />
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
                    <div className="h-6 w-32 bg-surface-hover rounded animate-pulse mb-2" />
                  ) : (
                    <h2 className="text-xl font-black text-foreground leading-tight">{profile?.username}</h2>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {profile?.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-500 text-white">
                        <Shield className="w-2 h-2" strokeWidth={2.5} /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary text-primary-foreground">
                        <UserCheck className="w-2 h-2" strokeWidth={2.5} /> Member
                      </span>
                    )}
                    {profile?.email && (
                      <span className="text-xs text-foreground-subtle flex items-center gap-1">
                        <Mail className="w-2.5 h-2.5" strokeWidth={2.25} /> {profile.email}
                      </span>
                    )}
                    {profile?.created_at && (
                      <span className="text-xs text-foreground-subtle flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" strokeWidth={2.25} />
                        สมาชิกตั้งแต่ {new Date(profile.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Wallet balance highlight */}
              {!profileLoading && profile && (
                <div className="theme-wallet-card rounded-xl px-4 py-3 text-white shadow-[0_4px_0_rgb(var(--color-primary-shadow))] border border-white/15 flex items-center gap-3 flex-shrink-0">
                  <div className="w-9 h-9 bg-black/15 border border-white/20 rounded-xl flex items-center justify-center">
                    <Coins className="w-4 h-4 text-white" strokeWidth={2.25} />
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
                {stats.map((s, i) => (
                  <div key={i} className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `rgb(${s.tint} / 0.12)` }}>
                      <s.Icon className="w-4 h-4" strokeWidth={2.25} style={{ color: `rgb(${s.tint})` }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground tabular-nums truncate">{s.value}</p>
                      <p className="text-[10px] text-foreground-subtle">{s.label}</p>
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
            <div className="w-8 h-8 rounded-lg bg-amber-500/12 flex items-center justify-center flex-shrink-0">
              <Key className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.25} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">เปลี่ยนรหัสผ่าน</h3>
              <p className="text-[11px] text-foreground-subtle">รหัสผ่านสำหรับเข้าเกม</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {pwFields.map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-bold text-foreground-subtle mb-1.5">{f.label}</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle">
                      <f.Icon className="w-4 h-4" strokeWidth={2} />
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
                className="flex items-center gap-2 px-5 py-2.5 bg-primary disabled:opacity-50 text-primary-foreground text-[13px] font-bold rounded-lg shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:brightness-110 transition-all active:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] active:translate-y-[2px]">
                {pwSaving
                  ? <><Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} /> กำลังบันทึก...</>
                  : <><Save className="w-3 h-3" strokeWidth={2.25} /> บันทึกรหัสผ่าน</>}
              </button>
            </div>
          </form>
        </div>

        {/* ── Transaction History ── */}
        <div className={CARD}>
          <div className={`${SECTION_HEADER} justify-between`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0">
                <History className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">ประวัติธุรกรรม</h3>
                <p className="text-[11px] text-foreground-subtle">รายการทั้งหมด {pagination.total} รายการ</p>
              </div>
            </div>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-primary animate-spin" strokeWidth={2.5} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-foreground-subtle">
              <Receipt className="w-8 h-8 mb-3 opacity-50" strokeWidth={1.75} />
              <p className="text-sm font-medium">ยังไม่มีธุรกรรม</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-foreground-subtle uppercase border-b border-border">
                      <th className="px-5 py-3 font-medium">ประเภท</th>
                      <th className="px-5 py-3 font-medium">จำนวนเงิน</th>
                      <th className="px-5 py-3 font-medium hidden sm:table-cell">รายละเอียด</th>
                      <th className="px-5 py-3 font-medium text-right">วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map(tx => {
                      const cfg = TX_CONFIG[tx.type] || { label: tx.type, Icon: Circle, tint: '148 163 184' };
                      const TxIcon = cfg.Icon;
                      const isPending = tx.status === 'pending';
                      const isFailed  = tx.status === 'failed' || tx.status === 'refunded';
                      const positive  = isPositive(tx.type) && !isPending && !isFailed;
                      return (
                        <tr key={tx.id} className={`hover:bg-surface-hover/60 transition-colors ${isPending ? 'opacity-60' : ''}`}>
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1 rounded-md w-fit" style={{ backgroundColor: `rgb(${cfg.tint} / 0.12)`, color: `rgb(${cfg.tint})` }}>
                                <TxIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                                {cfg.label}
                              </span>
                              {isPending && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-warning/10 text-warning w-fit">
                                  <Clock className="w-2 h-2" strokeWidth={2.5} /> รอดำเนินการ
                                </span>
                              )}
                              {isFailed && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-error/10 text-error w-fit">
                                  <X className="w-2 h-2" strokeWidth={2.5} /> {tx.status === 'refunded' ? 'คืนเงิน' : 'ไม่สำเร็จ'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-black text-sm tabular-nums ${isPending ? 'text-foreground-subtle' : positive ? 'text-success' : 'text-error'}`}>
                              {isPending ? '' : positive ? '+' : '-'}฿{Math.abs(parseFloat(String(tx.amount))).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-5 py-3 hidden sm:table-cell">
                            <span className="text-foreground-subtle text-[12px] max-w-[220px] truncate block">{tx.description || '-'}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-foreground-subtle text-[11px] tabular-nums whitespace-nowrap">
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
                <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11px] text-foreground-subtle">
                    หน้า {pagination.page} จาก {pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => loadTx(pagination.page - 1)}
                      aria-label="หน้าก่อนหน้า"
                      className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground-subtle shadow-sm hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
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
                              ? 'bg-primary text-primary-foreground shadow-[0_3px_0_rgb(var(--color-primary-shadow))]'
                              : 'bg-surface border border-border text-foreground-subtle shadow-sm hover:brightness-95'
                          }`}>
                          {p}
                        </button>
                      );
                    })}
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadTx(pagination.page + 1)}
                      aria-label="หน้าถัดไป"
                      className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground-subtle shadow-sm hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
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
