'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { Icon, type IconName } from '@/components/ui/icon';

interface User {
  id: number; email: string; display_name: string; phone: string;
  wallet_balance: number; role: string; avatar_url?: string | null; created_at: string;
}

interface Summary {
  total: number; admins: number; customers: number; walletTotal: number;
}

interface WalletTx {
  id: number; type: string; amount: number; balance_after: number;
  description: string | null; reference_id: string | null; created_at: string;
}

const fmtBaht = (n: number) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
const fmtDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

type RoleFilter = 'all' | 'customer' | 'admin';

const ROLE_TABS: { value: RoleFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'ทั้งหมด', icon: 'users' },
  { value: 'customer', label: 'ลูกค้า', icon: 'user' },
  { value: 'admin', label: 'แอดมิน', icon: 'user-shield' },
];

const PAGE_SIZE = 20;

function Content() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, admins: 0, customers: 0, walletTotal: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const [editModal, setEditModal] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', email: '', role: 'customer' });
  const [walletForm, setWalletForm] = useState({ amount: '', type: 'credit', description: '' });
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>('profile');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [history, setHistory] = useState<WalletTx[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [modalBalance, setModalBalance] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/users', {
        params: {
          page,
          limit: PAGE_SIZE,
          search: searchTerm || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter,
        },
      });
      setUsers(r.data.users);
      setTotal(r.data.total);
      if (r.data.summary) setSummary(r.data.summary);
    } catch {
      toast.error('โหลดข้อมูลล้มเหลว', 'ไม่สามารถดึงรายชื่อผู้ใช้งานได้');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, roleFilter, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [roleFilter, searchTerm]);

  const submitSearch = () => setSearchTerm(searchInput.trim());

  const loadHistory = useCallback(async (userId: number) => {
    setHistoryLoading(true);
    try {
      const r = await api.get(`/api/admin/users/${userId}/wallet/history`, { params: { limit: 8 } });
      setHistory(r.data.transactions || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openEdit = (u: User) => {
    setEditModal(u);
    setEditForm({ displayName: u.display_name, email: u.email, role: u.role });
    setWalletForm({ amount: '', type: 'credit', description: '' });
    setActiveTab('profile');
    setModalBalance(Number(u.wallet_balance) || 0);
    loadHistory(u.id);
  };

  const closeEdit = () => {
    setEditModal(null);
    setSavingProfile(false);
    setSavingWallet(false);
    setHistory([]);
  };

  const submitProfile = async () => {
    if (!editModal) return;
    if (!editForm.displayName.trim()) {
      toast.error('ข้อมูลไม่ครบ', 'กรุณาระบุชื่อที่แสดง');
      return;
    }
    setSavingProfile(true);
    try {
      await api.put(`/api/admin/users/${editModal.id}`, {
        displayName: editForm.displayName.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      });
      toast.success('บันทึกสำเร็จ', `อัปเดตข้อมูล ${editForm.displayName} แล้ว`);
      load();
      closeEdit();
    } catch (e: any) {
      toast.error('บันทึกไม่สำเร็จ', e.response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSavingProfile(false);
    }
  };

  const submitWallet = async () => {
    if (!editModal || !walletForm.amount) return;
    const amt = parseFloat(walletForm.amount);
    if (!isFinite(amt) || amt <= 0) {
      toast.error('จำนวนเงินไม่ถูกต้อง', 'ระบุตัวเลขมากกว่า 0');
      return;
    }
    setSavingWallet(true);
    try {
      const r = await api.post(`/api/admin/users/${editModal.id}/wallet`, {
        amount: amt,
        type: walletForm.type,
        description: walletForm.description || undefined,
      });
      const newBalance = Number(r.data.balanceAfter ?? modalBalance);
      setModalBalance(newBalance);
      toast.success(
        walletForm.type === 'credit' ? 'เพิ่มเงินสำเร็จ' : 'หักเงินสำเร็จ',
        `${editModal.display_name} • ยอดคงเหลือ ${fmtBaht(newBalance)}`
      );
      setUsers(prev => prev.map(u => u.id === editModal.id ? { ...u, wallet_balance: newBalance } : u));
      setSummary(prev => ({
        ...prev,
        walletTotal: prev.walletTotal + (walletForm.type === 'credit' ? amt : -amt),
      }));
      setWalletForm({ amount: '', type: walletForm.type, description: '' });
      loadHistory(editModal.id);
    } catch (e: any) {
      toast.error('เกิดข้อผิดพลาด', e.response?.data?.error || 'ไม่สามารถอัปเดตยอดเงินได้');
    } finally {
      setSavingWallet(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">ผู้ใช้งาน</h2>
          <p className="admin-sub">จัดการบัญชีผู้ใช้และยอดเงินคงเหลือในระบบ</p>
        </div>
        <button onClick={load} className="admin-btn" disabled={loading}>
          <Icon name="arrows-rotate" className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard label="ผู้ใช้ทั้งหมด" value={summary.total} />
        <SummaryCard label="ลูกค้า" value={summary.customers} />
        <SummaryCard label="แอดมิน" value={summary.admins} />
        <SummaryCard label="ยอดเงินรวมในระบบ" value={fmtBaht(summary.walletTotal)} />
      </div>

      {/* Filter + search. Wraps rather than scrolls, so nothing sits off-screen
          on a phone. */}
      <div className="admin-card admin-card-body">
        <div className="admin-toolbar">
          <div className="flex gap-1.5" role="group" aria-label="กรองตามสิทธิ์">
            {ROLE_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setRoleFilter(tab.value)}
                aria-pressed={roleFilter === tab.value}
                className={`admin-btn admin-btn-sm flex-1 ${roleFilter === tab.value ? 'admin-btn-primary' : ''}`}
              >
                <Icon name={tab.icon as IconName} className="text-[13px]" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 sm:ml-auto sm:w-[340px]">
            <input
              type="search"
              placeholder="ค้นหาชื่อ หรืออีเมล"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitSearch()}
              className="admin-input"
            />
            <button onClick={submitSearch} className="admin-btn shrink-0" aria-label="ค้นหา">
              <Icon name="magnifying-glass" className="text-[13px]" />
            </button>
          </div>
        </div>
      </div>

      {loading && !users.length ? (
        <div className="admin-card"><SkeletonTable rows={10} /></div>
      ) : users.length === 0 ? (
        <div className="admin-card p-10">
          <EmptyState icon="users" title="ไม่พบข้อมูลผู้ใช้งาน" description="ลองเปลี่ยนเงื่อนไขการค้นหา" />
        </div>
      ) : (
        <div className="admin-card">
          <div className="p-3 md:p-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ผู้ใช้งาน</th>
                  <th>อีเมล</th>
                  <th>สิทธิ์</th>
                  <th className="text-right">ยอดคงเหลือ</th>
                  <th>วันที่สมัคร</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td data-label="ผู้ใช้งาน">
                      <span className="flex items-center gap-2.5 justify-end md:justify-start">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-md object-cover border border-border shrink-0" />
                        ) : (
                          <span className="w-8 h-8 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center font-semibold text-[13px] shrink-0">
                            {u.display_name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground truncate">{u.display_name}</span>
                          {u.phone && <span className="block admin-meta">{u.phone}</span>}
                        </span>
                      </span>
                    </td>
                    <td data-label="อีเมล" className="break-all">{u.email}</td>
                    <td data-label="สิทธิ์">
                      <span className="admin-chip">{u.role === 'admin' ? 'แอดมิน' : 'ลูกค้า'}</span>
                    </td>
                    <td data-label="ยอดคงเหลือ" className="admin-num md:text-right font-medium">{fmtBaht(u.wallet_balance)}</td>
                    <td data-label="วันที่สมัคร" className="admin-meta">{fmtDate(u.created_at)}</td>
                    <td data-label="" className="md:text-right">
                      <button onClick={() => openEdit(u)} className="admin-btn admin-btn-sm w-full md:w-auto">
                        <Icon name="user-gear" className="text-[13px]" /> จัดการ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-border">
              <p className="admin-meta">
                แสดง {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} จาก {total} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button className="admin-btn admin-btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <Icon name="chevron-left" className="text-[11px]" /> ก่อนหน้า
                </button>
                <span className="admin-meta admin-num">{page} / {pages}</span>
                <button className="admin-btn admin-btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                  ถัดไป <Icon name="chevron-right" className="text-[11px]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editModal && (
        <UserEditModal
          user={editModal}
          activeTab={activeTab}
          editForm={editForm}
          walletForm={walletForm}
          modalBalance={modalBalance}
          history={history}
          historyLoading={historyLoading}
          savingProfile={savingProfile}
          savingWallet={savingWallet}
          onTab={setActiveTab}
          onEditFormChange={setEditForm}
          onWalletFormChange={setWalletForm}
          onSubmitProfile={submitProfile}
          onSubmitWallet={submitWallet}
          onClose={closeEdit}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-card p-3.5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="admin-num text-xl font-semibold text-foreground mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function UserEditModal({
  user, activeTab, editForm, walletForm, modalBalance, history, historyLoading,
  savingProfile, savingWallet,
  onTab, onEditFormChange, onWalletFormChange,
  onSubmitProfile, onSubmitWallet, onClose,
}: {
  user: User;
  activeTab: 'profile' | 'wallet';
  editForm: any;
  walletForm: any;
  modalBalance: number;
  history: WalletTx[];
  historyLoading: boolean;
  savingProfile: boolean;
  savingWallet: boolean;
  onTab: (t: 'profile' | 'wallet') => void;
  onEditFormChange: (s: any) => void;
  onWalletFormChange: (s: any) => void;
  onSubmitProfile: () => void;
  onSubmitWallet: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  if (!mounted) return null;

  /* The dialog is rendered through a portal, which puts it outside the admin
     layout and therefore outside `.admin-shell`, so it carries the class
     itself to inherit the same controls and motion rules. */
  return createPortal(
    <div className="admin-shell fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-950/55" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg flex flex-col bg-card border border-border rounded-t-xl sm:rounded-xl shadow-xl z-10 max-h-[92vh]">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{user.display_name}</p>
            <p className="admin-meta truncate">{user.email}</p>
          </div>
          <button onClick={onClose} className="admin-btn admin-btn-sm shrink-0" aria-label="ปิด">
            <Icon name="times" className="text-[13px]" />
          </button>
        </div>

        <div className="flex border-b border-border shrink-0" role="tablist">
          {([
            { key: 'profile' as const, label: 'ข้อมูลบัญชี' },
            { key: 'wallet' as const, label: 'จัดการยอดเงิน' },
          ]).map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => onTab(t.key)}
              className={`flex-1 py-2.5 text-[14px] font-medium cursor-pointer border-b-2 -mb-px ${
                activeTab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto">
          {activeTab === 'profile' ? (
            <div className="space-y-4">
              <div>
                <label className="admin-label" htmlFor="ue-name">ชื่อที่แสดง</label>
                <input id="ue-name" className="admin-input" value={editForm.displayName}
                  onChange={e => onEditFormChange({ ...editForm, displayName: e.target.value })} />
              </div>
              <div>
                <label className="admin-label" htmlFor="ue-email">อีเมล</label>
                <input id="ue-email" className="admin-input" value={editForm.email}
                  onChange={e => onEditFormChange({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="admin-label" htmlFor="ue-role">สิทธิ์การใช้งาน</label>
                <select id="ue-role" className="admin-select" value={editForm.role}
                  onChange={e => onEditFormChange({ ...editForm, role: e.target.value })}>
                  <option value="customer">ลูกค้า</option>
                  <option value="admin">แอดมิน</option>
                </select>
              </div>
              <button className="admin-btn admin-btn-primary w-full" onClick={onSubmitProfile} disabled={savingProfile}>
                {savingProfile && <Icon name="spinner" className="animate-spin" />}
                บันทึกข้อมูล
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-border rounded-md p-3.5">
                <p className="text-[13px] text-muted-foreground">ยอดเงินคงเหลือปัจจุบัน</p>
                <p className="admin-num text-2xl font-semibold text-foreground mt-1">{fmtBaht(modalBalance)}</p>
              </div>

              <div>
                <span className="admin-label">ประเภทรายการ</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onWalletFormChange({ ...walletForm, type: 'credit' })}
                    aria-pressed={walletForm.type === 'credit'}
                    className={`admin-btn ${walletForm.type === 'credit' ? 'admin-btn-primary' : ''}`}
                  >
                    <Icon name="plus" className="text-[13px]" /> เพิ่มเงิน
                  </button>
                  <button
                    onClick={() => onWalletFormChange({ ...walletForm, type: 'debit' })}
                    aria-pressed={walletForm.type === 'debit'}
                    className={`admin-btn ${walletForm.type === 'debit' ? 'admin-btn-danger' : ''}`}
                  >
                    <Icon name="minus" className="text-[13px]" /> หักเงิน
                  </button>
                </div>
              </div>

              <div>
                <label className="admin-label" htmlFor="uw-amount">จำนวนเงิน (บาท)</label>
                <input id="uw-amount" type="number" inputMode="decimal" placeholder="0.00" className="admin-input admin-num"
                  value={walletForm.amount} onChange={e => onWalletFormChange({ ...walletForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="admin-label" htmlFor="uw-note">หมายเหตุ (ไม่บังคับ)</label>
                <input id="uw-note" placeholder="เช่น ชดเชยระบบขัดข้อง" className="admin-input"
                  value={walletForm.description} onChange={e => onWalletFormChange({ ...walletForm, description: e.target.value })} />
              </div>
              <button
                className={`admin-btn w-full ${walletForm.type === 'debit' ? 'admin-btn-danger' : 'admin-btn-primary'}`}
                onClick={onSubmitWallet}
                disabled={savingWallet || !walletForm.amount}
              >
                {savingWallet && <Icon name="spinner" className="animate-spin" />}
                {walletForm.type === 'debit' ? 'ยืนยันการหักเงิน' : 'ยืนยันการเพิ่มเงิน'}
              </button>

              <div className="pt-4 border-t border-border">
                <h4 className="admin-section-title mb-2.5">รายการล่าสุด</h4>
                {historyLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-11 bg-secondary rounded-md" />)}
                  </div>
                ) : history.length === 0 ? (
                  <p className="admin-meta py-4 text-center">ยังไม่มีรายการ</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {history.map(tx => (
                      <li key={tx.id} className="flex justify-between items-baseline gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-[14px] text-foreground truncate">
                            {tx.description || (tx.type === 'credit' ? 'แอดมินเพิ่มเงิน' : 'แอดมินหักเงิน')}
                          </span>
                          <span className="block admin-meta">{fmtDateTime(tx.created_at)}</span>
                        </span>
                        <span className={`admin-num text-[14px] font-medium shrink-0 ${tx.type === 'credit' ? 'text-emerald-600' : 'text-destructive'}`}>
                          {tx.type === 'credit' ? '+' : '-'}{Number(tx.amount).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function UsersPage() {
  return <Suspense fallback={<div className="p-4"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
