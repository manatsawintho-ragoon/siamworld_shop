'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable, SkeletonStat } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="space-y-6 pb-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-4 mb-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary transition-all" asChild>
              <Link href="/admin">
                <Icon name="arrow-left" className="text-xs" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Users <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <Icon name="user-group" className="text-primary text-xs" />
            บริหารจัดการบัญชีผู้ใช้งานและยอดเงินคงเหลือในระบบ
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
           <Button size="default" onClick={load} className="rounded-xl font-bold gap-2 h-11 px-6 shadow-md shadow-primary/10 active:scale-95 transition-all">
             <Icon name="arrows-rotate" className={`${loading ? 'animate-spin' : ''}`} /> รีเฟรชข้อมูล
           </Button>
        </motion.div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          label="Total Users" 
          value={summary.total} 
          icon="users" 
          color="primary" 
          delay={0.1}
        />
        <SummaryCard 
          label="Customers" 
          value={summary.customers} 
          icon="user" 
          color="emerald" 
          delay={0.2}
        />
        <SummaryCard 
          label="Admins" 
          value={summary.admins} 
          icon="user-shield" 
          color="blue" 
          delay={0.3}
        />
        <SummaryCard 
          label="Total Deposits" 
          value={fmtBaht(summary.walletTotal)} 
          icon="coins" 
          color="amber" 
          delay={0.4}
        />
      </div>

      {/* Filters & Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="rounded-3xl border-border shadow-sm bg-white dark:bg-card overflow-hidden">
          <CardContent className="p-3 lg:p-4">
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex flex-wrap gap-1.5 p-1 bg-secondary/50 rounded-xl flex-1 items-center">
                {ROLE_TABS.map(tab => (
                  <button 
                    key={tab.value} 
                    onClick={() => setRoleFilter(tab.value)}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                      roleFilter === tab.value
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 z-10'
                        : 'text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm'
                    }`}
                  >
                    <Icon name={tab.icon as IconName} className={`${roleFilter === tab.value ? 'opacity-100' : 'opacity-40'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 xl:w-[320px] group">
                  <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="ค้นหาชื่อ หรืออีเมล..." 
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitSearch()}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground placeholder:text-muted-foreground/60" 
                  />
                </div>
                <Button onClick={submitSearch} className="h-[42px] w-[42px] rounded-xl cursor-pointer shadow-md shadow-primary/10 active:scale-95 transition-all">
                  <Icon name="magnifying-glass" className="text-xs" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        {loading && !users.length ? (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <SkeletonTable rows={10} />
          </Card>
        ) : users.length === 0 ? (
          <Card className="rounded-3xl border-border shadow-sm p-16 bg-white dark:bg-card">
            <EmptyState icon="users" title="ไม่พบข้อมูลผู้ใช้งาน" description="ลองเปลี่ยนเงื่อนไขการค้นหาของคุณ" />
          </Card>
        ) : (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">ผู้ใช้งาน</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">อีเมล</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-center">สิทธิ์</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">ยอดคงเหลือ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-center">วันที่สมัคร</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <AnimatePresence mode="popLayout">
                    {users.map((u, idx) => (
                      <motion.tr 
                        key={u.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-secondary/20 transition-all duration-300 group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.display_name} className="w-10 h-10 rounded-xl object-cover border-2 border-border shadow-sm group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm group-hover:rotate-6 transition-all duration-500">
                                {u.display_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-foreground text-xs truncate max-w-[180px] tracking-tight group-hover:text-primary transition-colors">{u.display_name}</p>
                              {u.phone && <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 opacity-60">{u.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-semibold text-foreground/80 tracking-tight">{u.email}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="scale-90">
                            {u.role === 'admin' ? (
                              <Badge className="bg-blue-500/10 text-blue-600 border-none font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-lg">Admin</Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-lg">Customer</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <p className="text-sm font-bold text-emerald-600 tracking-tight leading-none">{fmtBaht(u.wallet_balance)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{fmtDate(u.created_at)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="outline" onClick={() => openEdit(u)} className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider gap-2 bg-white border-2 hover:bg-slate-50 active:scale-95 transition-all shadow-sm">
                            <Icon name="user-gear" className="text-primary" /> Manage
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-6 border-t border-border/60 bg-secondary/10 gap-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                   Showing <span className="text-foreground">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span> of <span className="text-foreground">{total}</span>
                </p>
                <div className="flex items-center gap-2.5 bg-background border border-border p-1.5 rounded-2xl shadow-sm">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={page <= 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    className="h-8 w-8 rounded-lg active:scale-95 disabled:opacity-30 transition-all"
                  >
                    <Icon name="chevron-left" className="text-[10px]" />
                  </Button>
                  <div className="px-3 flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{page}</span>
                    <span className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest">of</span>
                    <span className="text-xs font-bold text-muted-foreground/60">{pages}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={page >= pages} 
                    onClick={() => setPage(p => Math.min(pages, p + 1))} 
                    className="h-8 w-8 rounded-lg active:scale-95 disabled:opacity-30 transition-all"
                  >
                    <Icon name="chevron-right" className="text-[10px]" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </motion.div>

      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, delay }: any) {
  const colorMap: any = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="rounded-2xl border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-500 group overflow-hidden bg-white dark:bg-card h-full">
        <CardContent className="p-4 relative">
          <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ${colorMap[color].split(' ')[0]}`} />
          <div className="flex items-center gap-4 relative z-10">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-base border shadow-sm group-hover:rotate-12 transition-transform duration-500 ${colorMap[color]}`}>
              <Icon name={icon} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
              <h4 className="text-xl font-bold text-foreground tracking-tight leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</h4>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full sm:max-w-xl flex flex-col bg-background sm:border-border rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden z-10"
      >
        <div className="sm:hidden flex justify-center pt-5 pb-1 flex-shrink-0">
          <div className="w-16 h-1.5 bg-muted rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-4 p-6 border-b border-border flex-shrink-0 bg-secondary/10">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="w-12 h-12 rounded-xl object-cover border-2 border-border shadow-md" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-md shadow-primary/20 flex-shrink-0">
                {user.display_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-lg tracking-tight truncate leading-tight">{user.display_name}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-90 shadow-sm"
          >
            <Icon name="times" className="text-sm" />
          </button>
        </div>

        <div className="flex p-1.5 bg-secondary/50 border-b border-border">
          <button onClick={() => onTab('profile')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Account Profile</button>
          <button onClick={() => onTab('wallet')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === 'wallet' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Wallet Manager</button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[65vh] custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Display Name</label>
                  <input className="w-full px-4 py-3 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                    value={editForm.displayName} onChange={e => onEditFormChange({...editForm, displayName: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Email Address</label>
                  <input className="w-full px-4 py-3 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                    value={editForm.email} onChange={e => onEditFormChange({...editForm, email: e.target.value})} />
                </div>
                <div className="space-y-1.5 relative">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">User Permission Role</label>
                  <select className="w-full px-4 py-3 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground appearance-none cursor-pointer"
                    value={editForm.role} onChange={e => onEditFormChange({...editForm, role: e.target.value})}>
                    <option value="customer">ลูกค้า (Customer)</option>
                    <option value="admin">แอดมิน (Authorized Admin)</option>
                  </select>
                  <Icon name="chevron-down" className="absolute right-5 top-[38px] text-muted-foreground/40 pointer-events-none text-[10px]" />
                </div>
                <Button className="w-full h-14 rounded-2xl font-bold text-[10px] uppercase tracking-wider mt-2 shadow-lg shadow-primary/20 active:scale-95 transition-all" onClick={onSubmitProfile} disabled={savingProfile}>
                  {savingProfile ? <Icon name="spinner" className="mr-2 animate-spin" /> : <Icon name="check-double" className="mr-2" />}
                  Save Profile Changes
                </Button>
              </motion.div>
            ) : (
              <motion.div 
                key="wallet"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                  <Card className="relative rounded-2xl border-emerald-500/20 bg-white/80 dark:bg-card/80 backdrop-blur-xl shadow-md">
                    <CardContent className="p-6 text-center">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Current Wallet Balance</p>
                      <p className="text-3xl font-bold text-foreground tracking-tight">{fmtBaht(modalBalance)}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => onWalletFormChange({...walletForm, type: 'credit'})}
                    className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-bold text-[9px] uppercase tracking-wider transition-all active:scale-90 cursor-pointer ${walletForm.type === 'credit' ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 shadow-md shadow-emerald-500/10' : 'border-border bg-white text-muted-foreground hover:border-emerald-500/20'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${walletForm.type === 'credit' ? 'bg-emerald-500 text-white' : 'bg-secondary/50 text-muted-foreground'}`}>
                      <Icon name="plus" />
                    </div>
                    Deposit
                  </button>
                  <button onClick={() => onWalletFormChange({...walletForm, type: 'debit'})}
                    className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-bold text-[9px] uppercase tracking-wider transition-all active:scale-90 cursor-pointer ${walletForm.type === 'debit' ? 'border-rose-500 bg-rose-500/5 text-rose-600 shadow-md shadow-rose-500/10' : 'border-border bg-white text-muted-foreground hover:border-rose-500/20'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${walletForm.type === 'debit' ? 'bg-rose-500 text-white' : 'bg-secondary/50 text-muted-foreground'}`}>
                      <Icon name="minus" />
                    </div>
                    Withdraw
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-xl text-muted-foreground/30 group-focus-within:text-primary transition-colors">฿</span>
                    <input type="number" placeholder="0.00" className="w-full pl-12 pr-4 py-3.5 bg-secondary/30 border-2 border-transparent rounded-xl text-xl font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                      value={walletForm.amount} onChange={e => onWalletFormChange({...walletForm, amount: e.target.value})} />
                  </div>
                  <input placeholder="Reference / Note" className="w-full px-5 py-3 bg-secondary/30 border-2 border-transparent rounded-xl text-[10px] font-bold outline-none focus:bg-white focus:border-primary/20 transition-all text-foreground placeholder:text-muted-foreground/40 uppercase tracking-widest"
                    value={walletForm.description} onChange={e => onWalletFormChange({...walletForm, description: e.target.value})} />
                  <Button className={`w-full h-14 rounded-2xl font-bold text-[10px] uppercase tracking-wider shadow-md transition-all active:scale-95 ${walletForm.type === 'debit' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`} onClick={onSubmitWallet} disabled={savingWallet || !walletForm.amount}>
                    {savingWallet ? <Icon name="spinner" className="mr-2 animate-spin" /> : <Icon name="arrow-right-arrow-left" className="mr-2" />}
                    Confirm
                  </Button>
                </div>

                <div className="pt-5 border-t border-border/60">
                  <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                     <Icon name="clock-rotate-left" className="opacity-40" />
                     Recent Activity
                  </h4>
                  {historyLoading ? (
                    <div className="space-y-2">
                       {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-secondary/30 animate-pulse rounded-xl" />)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map(tx => (
                        <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/20 border border-transparent hover:border-border transition-all group">
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-[10px] truncate tracking-tight uppercase group-hover:text-primary transition-colors">{tx.description || (tx.type === 'credit' ? 'Admin Adj (+)' : 'Admin Adj (-)')}</p>
                            <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider mt-0.5">{fmtDateTime(tx.created_at)}</p>
                          </div>
                          <div className={`font-bold text-xs ml-3 px-2 py-0.5 rounded-md ${tx.type === 'credit' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                            {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString()}
                          </div>
                        </div>
                      ))}
                      {!history.length && (
                        <div className="py-8 text-center border-2 border-dashed border-border rounded-2xl">
                          <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">No History</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export default function UsersPage() {
  return <Suspense fallback={<div className="p-8"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
