'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import TimeRemaining from '@/components/TimeRemaining';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface Sub {
  id: number; shop_name: string; domain: string; status: string;
  expires_at: string; package_months: number; price_paid: number;
  display_name: string; email: string; frontend_port: number;
  mc_ip?: string; deploy_log?: string;
}

const FILTER_TABS = [
  { value: '',           label: 'ทั้งหมด',        icon: 'fa-list' },
  { value: 'active',     label: 'ใช้งานอยู่',     icon: 'fa-circle-check' },
  { value: 'deploying',  label: 'กำลังติดตั้ง',  icon: 'fa-rocket' },
  { value: 'suspended',  label: 'ถูกระงับ',     icon: 'fa-ban' },
  { value: 'expired',    label: 'หมดอายุ',      icon: 'fa-clock' },
];

const PAGE_SIZE = 30;

function Content() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initStatus = searchParams.get('status') || '';
  const [subs, setSubs] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initStatus);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [manageSub, setManageSub] = useState<Sub | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [logsSub, setLogsSub] = useState<Sub | null>(null);
  const [logsData, setLogsData] = useState('');
  const [statsData, setStatsData] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await api.get('/api/admin/subscriptions', {
        params: {
          page,
          status: status || undefined,
          search: searchTerm || undefined,
          limit: PAGE_SIZE,
        },
      });
      setSubs(r.data.subscriptions);
      setTotal(r.data.total);
    } catch {
      if (!silent) toast.error('โหลดล้มเหลว', 'ไม่สามารถดึงข้อมูลร้านค้าได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, status, searchTerm, toast]);

  useEffect(() => { load(); }, [page, status, searchTerm]);
  useEffect(() => { setPage(1); setSelectedIds([]); }, [status, searchTerm]);

  useEffect(() => {
    if (!manageSub) return;
    const fresh = subs.find(s => s.id === manageSub.id);
    if (!fresh) return;
    if (
      fresh.status !== manageSub.status ||
      fresh.mc_ip !== manageSub.mc_ip ||
      fresh.expires_at !== manageSub.expires_at
    ) setManageSub(fresh);
  }, [subs, manageSub]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const submitSearch = () => setSearchTerm(searchInput.trim());

  const toggleSelectAll = () => {
    if (selectedIds.length === subs.length) setSelectedIds([]);
    else setSelectedIds(subs.map(s => s.id));
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
    else setSelectedIds(prev => [...prev, id]);
  };

  const handleBulkAction = async (action: 'suspend' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`ต้องการลบ ${selectedIds.length} ร้านค้าที่เลือกอย่างถาวรใช่หรือไม่?`)) return;
    setActionLoading(-1);
    try {
      await api.post('/api/admin/subscriptions/bulk-action', { ids: selectedIds, action });
      toast.success('สำเร็จ', `ดำเนินการเรียบร้อยแล้ว`);
      setSelectedIds([]);
      load();
    } catch {
      toast.error('ล้มเหลว', 'ไม่สามารถดำเนินการได้');
    } finally {
      setActionLoading(null);
    }
  };

  const viewLogs = async (sub: Sub) => {
    setLogsSub(sub);
    setLogsData('กำลังโหลด...');
    setStatsData('กำลังโหลด...');
    setShowLogsModal(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.get(`/api/admin/subscriptions/${sub.id}/logs`),
        api.get(`/api/admin/subscriptions/${sub.id}/stats`)
      ]);
      setLogsData(logsRes.data.logs);
      setStatsData(statsRes.data.stats);
    } catch {
      setLogsData('โหลดข้อมูลล้มเหลว');
      setStatsData('โหลดข้อมูลล้มเหลว');
    }
  };

  const doAction = async (id: number, action: string) => {
    setActionLoading(id);
    try {
      if (action === 'remove') {
        await api.delete(`/api/admin/subscriptions/${id}`);
      } else if (action === 'fix-npm') {
        await api.post(`/api/admin/subscriptions/${id}/fix-npm`);
      } else if (action === 'dns-harden' || action === 'dns-unharden') {
        const mode = action === 'dns-harden' ? 'proxied' : 'dns-only';
        await api.post(`/api/admin/subscriptions/${id}/dns-mode`, { mode });
      } else {
        await api.post(`/api/admin/subscriptions/${id}/action`, { action });
      }
      toast.success('สำเร็จ', `ดำเนินการเรียบร้อยแล้ว`);
      if (action === 'remove' || action === 'redeploy') setManageSub(null);
      load();
    } catch (err: any) {
      toast.error('ล้มเหลว', err.response?.data?.error || 'ไม่สามารถดำเนินการได้');
    } finally {
      setActionLoading(null);
    }
  };

  const updateMcIp = async (sub: Sub, value: string) => {
    setActionLoading(sub.id);
    try {
      await api.patch(`/api/admin/subscriptions/${sub.id}/mc-ip`, { mcIp: value.trim() || null });
      toast.success('สำเร็จ', `อัปเดต MC IP เรียบร้อยแล้ว`);
      load();
    } catch {
      toast.error('ล้มเหลว', 'ไม่สามารถอัปเดตได้');
    } finally {
      setActionLoading(null);
    }
  };

  const promptMcIp = (sub: Sub) => {
    const input = window.prompt(`กรอก IP ของ Minecraft Server`, sub.mc_ip || '');
    if (input !== null) updateMcIp(sub, input);
  };

  const exportPDF = () => {
    window.print();
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
                <i className="fas fa-arrow-left text-xs" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Customers <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
              <i className="fas fa-shop text-primary text-xs" />
              จัดการร้านค้าลูกค้าทั้งหมด {total.toLocaleString('th-TH')} ร้าน
            </p>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px] uppercase tracking-wider h-5 flex items-center gap-1.5">
               <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${refreshing ? 'animate-pulse' : ''}`} />
               Live Update
            </Badge>
          </div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => load(true)} disabled={refreshing} className="h-11 w-11 rounded-xl bg-card border-border shadow-sm active:scale-95 transition-all">
            <i className={`fas fa-arrows-rotate text-xs ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={exportPDF} className="h-11 px-5 rounded-xl bg-card border-border shadow-sm font-bold text-sm gap-2 active:scale-95 transition-all">
            <i className="fas fa-file-pdf text-red-500" />
            พิมพ์รายงาน
          </Button>
        </motion.div>
      </div>

      {/* Filter & Search Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-3xl border-border shadow-sm bg-white dark:bg-card overflow-hidden">
          <CardContent className="p-3 lg:p-4">
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex flex-wrap gap-1.5 p-1 bg-secondary/50 rounded-xl flex-1 items-center">
                {FILTER_TABS.map(tab => (
                  <button 
                    key={tab.value} 
                    onClick={() => setStatus(tab.value)}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                      status === tab.value
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 z-10'
                        : 'text-muted-foreground hover:bg-white hover:text-foreground'
                    }`}
                  >
                    <i className={`fas ${tab.icon} ${status === tab.value ? 'opacity-100' : 'opacity-40'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 xl:w-[320px] group">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="ค้นหาร้าน / โดเมน / อีเมล..." 
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitSearch()}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground placeholder:text-muted-foreground/60" 
                  />
                </div>
                <Button onClick={submitSearch} className="h-[42px] w-[42px] rounded-xl cursor-pointer shadow-md shadow-primary/10 active:scale-95 transition-all">
                  <i className="fas fa-magnifying-glass text-xs" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bulk Actions Indicator */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -20 }} 
            animate={{ opacity: 1, height: 'auto', y: 0 }} 
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 ml-2">
                  <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-bounce-slow">
                     <i className="fas fa-check-double text-[10px]" />
                  </div>
                  <span className="text-primary text-xs font-bold uppercase tracking-wider">เลือก {selectedIds.length} ร้านค้า</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedIds([])} className="h-9 rounded-lg font-bold text-[10px] uppercase tracking-wider border-border bg-white active:scale-95 transition-all">
                    ยกเลิก
                  </Button>
                  <Button onClick={() => handleBulkAction('suspend')} disabled={actionLoading === -1} className="h-9 px-4 rounded-lg font-bold text-[10px] uppercase tracking-wider border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500 hover:text-white active:scale-95 transition-all">
                    ระงับ
                  </Button>
                  <Button variant="destructive" onClick={() => handleBulkAction('delete')} disabled={actionLoading === -1} className="h-9 px-4 rounded-lg font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all">
                    ลบ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Table Data */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {loading ? (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <SkeletonTable rows={10} />
          </Card>
        ) : subs.length === 0 ? (
          <Card className="rounded-3xl border-border shadow-sm p-16 bg-white dark:bg-card">
            <EmptyState icon="fa-store-slash" title="ไม่พบข้อมูลร้านค้า" description="ลองเปลี่ยนเงื่อนไขการค้นหาหรือเพิ่มร้านค้าใหม่" actionLabel="กลับหน้าหลัก" actionHref="/admin" />
          </Card>
        ) : (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="px-6 py-4 w-12 text-center border-b border-border/60">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length === subs.length && subs.length > 0} 
                        onChange={toggleSelectAll} 
                        className="rounded border-2 border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer accent-primary" 
                      />
                    </th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">ร้านค้า / เจ้าของ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">โดเมน / พอร์ต</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-center">สถานะ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">แพ็กเกจ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">เวลาที่เหลือ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <AnimatePresence mode="popLayout">
                    {subs.map((sub, idx) => {
                      const diff = new Date(sub.expires_at).getTime() - Date.now();
                      const d = Math.floor(diff / 86400000);
                      const isExpiringSoon = d < 7 && d >= 0 && sub.status !== 'suspended';
                      return (
                        <motion.tr 
                          key={sub.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="hover:bg-secondary/20 transition-all duration-300 group"
                        >
                          <td className="px-6 py-4 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(sub.id)} 
                              onChange={() => toggleSelect(sub.id)} 
                              className="rounded border-2 border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer accent-primary transition-transform active:scale-125" 
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base border-2 flex-shrink-0 transition-all duration-500 shadow-sm
                                ${isExpiringSoon
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse'
                                  : 'bg-primary/10 border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:rotate-6 shadow-primary/10'}`}>
                                <i className="fas fa-server" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-foreground text-xs truncate max-w-[180px] tracking-tight group-hover:text-primary transition-colors">{sub.shop_name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">
                                  <span className="text-foreground">{sub.display_name}</span>
                                  <span className="opacity-30">•</span>
                                  <span className="truncate max-w-[120px]">{sub.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => { navigator.clipboard.writeText(sub.domain); toast.info('คัดลอกแล้ว', sub.domain); }}
                              className="text-primary text-xs font-bold hover:underline cursor-pointer tracking-tight"
                            >
                              {sub.domain}
                            </button>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary text-secondary-foreground rounded-lg text-[9px] font-bold border border-border shadow-sm">
                                <i className="fas fa-plug text-primary/60" />
                                {sub.frontend_port}
                              </span>
                              <button 
                                onClick={() => promptMcIp(sub)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all border shadow-sm cursor-pointer ${
                                  sub.mc_ip
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500 hover:text-white'
                                }`}
                              >
                                <i className="fas fa-shield-halved" />
                                {sub.mc_ip || 'FIREWALL OFF'}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="scale-90"><StatusBadge status={sub.status} /></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs font-bold text-foreground tracking-tight">{sub.package_months} เดือน</div>
                            <div className="text-[10px] text-emerald-600 font-bold mt-0.5 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded-md inline-block">฿{Number(sub.price_paid).toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="scale-90 origin-left"><TimeRemaining date={sub.expires_at} /></div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Button variant="secondary" size="icon" onClick={() => viewLogs(sub)} title="ดู Logs & Stats" className="h-8 w-8 rounded-lg bg-card border border-border hover:bg-slate-900 hover:text-emerald-400 transition-all cursor-pointer shadow-sm">
                                <i className="fas fa-terminal text-[10px]" />
                              </Button>
                              <Button variant="outline" size="icon" asChild title="ข้อมูลล็อกอิน" className="h-8 w-8 rounded-lg bg-card border border-border hover:border-primary/40 hover:text-primary transition-all cursor-pointer shadow-sm">
                                <Link href={`/dashboard/credentials?id=${sub.id}`}>
                                  <i className="fas fa-key text-[10px]" />
                                </Link>
                              </Button>
                              <Button onClick={() => setManageSub(sub)} disabled={actionLoading === sub.id} className="h-9 px-4 rounded-xl cursor-pointer font-bold text-[10px] uppercase tracking-wider gap-2 shadow-md shadow-primary/10 active:scale-95 transition-all">
                                {actionLoading === sub.id ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-gear text-[10px] opacity-40" /> Manage</>}
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                    <i className="fas fa-chevron-left text-[10px]" />
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
                    <i className="fas fa-chevron-right text-[10px]" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </motion.div>

      {/* Manage Modal */}
      <AnimatePresence>
        {manageSub && (
          <ManageModal
            sub={manageSub}
            loading={actionLoading === manageSub.id}
            onAction={(action) => doAction(manageSub.id, action)}
            onSetMcIp={(value) => updateMcIp(manageSub, value)}
            onClose={() => setManageSub(null)}
          />
        )}
      </AnimatePresence>

      {/* Logs & Stats Modal */}
      <AnimatePresence>
        {showLogsModal && logsSub && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md" 
              onClick={() => setShowLogsModal(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-950 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="flex items-center justify-between px-10 py-8 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
                <div className="flex items-center gap-5">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                      <i className="fas fa-terminal" />
                   </div>
                   <div>
                    <h2 className="text-xl font-black text-white tracking-tight">System Terminal</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Inspecting: <span className="text-emerald-500">{logsSub.shop_name}</span></p>
                   </div>
                </div>
                <button 
                  onClick={() => setShowLogsModal(false)} 
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white transition-all cursor-pointer shadow-lg active:scale-90"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-10 space-y-10 custom-scrollbar">
                <section>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       Container Resource Usage
                    </h3>
                  </div>
                  <pre className="text-xs font-mono text-emerald-400 bg-black/80 border border-slate-800 p-8 rounded-2xl overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                    {statsData}
                  </pre>
                </section>
                <section>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       Real-time Application Logs
                    </h3>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-black/80 border border-slate-800 p-8 rounded-2xl overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner max-h-[400px]">
                    {logsData}
                  </pre>
                </section>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}

function ManageModal({
  sub, loading, onAction, onSetMcIp, onClose,
}: {
  sub: Sub;
  loading: boolean;
  onAction: (action: string) => void;
  onSetMcIp: (value: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [mcIpInput, setMcIpInput] = useState(sub.mc_ip || '');
  
  useEffect(() => { setMcIpInput(sub.mc_ip || ''); }, [sub.id]);

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

  const mcIpDirty = (mcIpInput.trim() || null) !== (sub.mc_ip || null);
  const mcIpValid = !mcIpInput.trim() || /^(\d{1,3}\.){3}\d{1,3}$/.test(mcIpInput.trim());
  const isSuspended = sub.status === 'suspended';

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
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
              <i className="fas fa-gear text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-lg tracking-tight truncate leading-tight">{sub.shop_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={sub.status} />
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-foreground hover:shadow-sm transition-all cursor-pointer active:scale-90"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-14 text-[10px] font-bold uppercase tracking-wider rounded-xl gap-2 cursor-pointer shadow-sm hover:bg-secondary transition-all" asChild>
              <a href={`https://${sub.domain}/admin`} target="_blank" rel="noopener noreferrer">
                <i className="fas fa-arrow-up-right-from-square text-primary text-[10px]" />
                เปิดหน้าร้าน
              </a>
            </Button>
            <Button variant="outline" className="h-14 text-[10px] font-bold uppercase tracking-wider rounded-xl gap-2 cursor-pointer shadow-sm hover:bg-secondary transition-all" asChild>
              <Link href={`/dashboard/credentials?id=${sub.id}`}>
                <i className="fas fa-key text-primary text-[10px]" />
                ข้อมูลล็อกอิน
              </Link>
            </Button>
          </div>

          <div className="p-5 bg-secondary/50 border border-border rounded-2xl group transition-all focus-within:bg-white focus-within:border-primary/20">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-shield-halved text-primary/60" /> MC Server IP
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                inputMode="decimal" 
                value={mcIpInput} 
                onChange={e => setMcIpInput(e.target.value)}
                placeholder="1.2.3.4 (เว้นว่างเพื่อปิด)"
                className={`flex-1 px-4 py-2.5 bg-background border-2 rounded-xl text-xs font-bold tracking-tight outline-none transition-all ${
                  mcIpInput && !mcIpValid
                    ? 'border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                    : 'border-transparent focus:border-primary focus:ring-4 focus:ring-primary/10 bg-white'
                }`} 
              />
              <Button 
                onClick={() => onSetMcIp(mcIpInput)}
                disabled={loading || !mcIpDirty || !mcIpValid}
                className="h-10 px-4 rounded-xl cursor-pointer font-bold text-[10px] uppercase tracking-wider shadow-md shadow-primary/20 active:scale-95"
              >
                บันทึก
              </Button>
            </div>
            {!mcIpValid && mcIpInput && (
              <p className="text-[9px] font-bold text-rose-500 mt-2 uppercase tracking-wider"><i className="fas fa-circle-exclamation mr-1.5" /> รูปแบบ IP ไม่ถูกต้อง</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">การควบคุมระบบ</p>
            <div className="grid grid-cols-3 gap-2">
              <ActionTile icon="fa-rotate" color="emerald" label="รีสตาร์ท" disabled={loading} onClick={() => onAction('restart')} />
              <ActionTile icon="fa-play" color="blue" label="เริ่มระบบ" disabled={loading} onClick={() => onAction('start')} />
              <ActionTile icon="fa-stop" color="amber" label="หยุดระบบ" disabled={loading} onClick={() => onAction('stop')} />
              <ActionTile icon="fa-wand-magic-sparkles" color="purple" label="ซ่อม NPM" disabled={loading} onClick={() => onAction('fix-npm')} />
              <ActionTile icon="fa-rocket" color="indigo" label="Redeploy" disabled={loading} onClick={() => onAction('redeploy')} />
              <ActionTile
                icon="fa-shield-halved" color="cyan" label="กัน DDoS (CF Proxy)"
                disabled={loading}
                onClick={() => {
                  if (confirm(
                    'เปลี่ยน DNS ของร้านนี้เป็น Cloudflare Proxied?\n\n' +
                    '✓ ซ่อน origin IP ป้องกัน DDoS attack\n' +
                    '✗ MySQL port (33XXX) จะใช้ไม่ได้จากภายนอก — ใช้ได้เฉพาะลูกค้าที่ใช้ Bridge\n' +
                    '⚠ Let\'s Encrypt cert จะ renew ไม่ผ่าน HTTP-01 ในครั้งถัดไป — เปลี่ยน NPM มาใช้ Cloudflare Origin Certificate ก่อนหมดอายุ\n\n' +
                    'หลังกด ต้องทำต่อ: รัน deploy/harden-mysql-port.sh เพื่อปิด MySQL port ที่ host firewall\n' +
                    'รายละเอียดทั้งหมดใน deploy/OPERATIONS-DDOS-HARDEN.md\n\n' +
                    'แนะนำเฉพาะลูกค้า Bridge เท่านั้น'
                  )) onAction('dns-harden');
                }}
              />
              <ActionTile
                icon="fa-shield-xmark" color="slate" label="ปลดกัน (DNS-only)"
                disabled={loading}
                onClick={() => {
                  if (confirm('คืน DNS เป็น DNS-only (เปิด MySQL port กลับมา)?\n\nใช้สำหรับลูกค้าที่ยังใช้ AuthMe direct')) onAction('dns-unharden');
                }}
              />
              {isSuspended ? (
                <ActionTile icon="fa-circle-check" color="teal" label="ปลดระงับ" disabled={loading} onClick={() => onAction('unsuspend')} />
              ) : (
                <ActionTile icon="fa-ban" color="orange" label="ระงับใช้งาน" disabled={loading} onClick={() => onAction('suspend')} />
              )}
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={() => onAction('remove')} 
            disabled={loading}
            className="w-full h-14 rounded-2xl border-2 border-rose-500/20 bg-rose-500/5 text-rose-500 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all active:scale-95 shadow-sm"
          >
            <i className="fas fa-trash mr-2" /> ลบร้านค้าถาวร
          </Button>
        </div>

        {loading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <i className="fas fa-spinner fa-spin text-xs" /> 
            กำลังดำเนินการ...
          </motion.div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

function ActionTile({
  icon, color, label, disabled, onClick,
}: {
  icon: string; color: string; label: string;
  disabled: boolean; onClick: () => void;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.amber;
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`group flex flex-col items-center justify-center gap-2 py-4 px-1 rounded-2xl border border-border bg-white transition-all active:scale-90 cursor-pointer hover:border-current/30 hover:shadow-lg hover:shadow-current/5 disabled:opacity-30 disabled:grayscale disabled:pointer-events-none`}
    >
      <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.icon} flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm`}>
        <i className={`fas ${icon} text-base`} />
      </div>
      <span className={`text-[9px] font-bold text-muted-foreground tracking-wider ${c.hoverText} truncate max-w-full`}>{label}</span>
    </button>
  );
}

const COLOR_MAP: Record<string, { icon: string; bg: string; hoverBg: string; hoverText: string }> = {
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-500/10', hoverBg: 'hover:bg-emerald-500/5',  hoverText: 'group-hover:text-emerald-600' },
  blue:    { icon: 'text-blue-600',    bg: 'bg-blue-500/10',    hoverBg: 'hover:bg-blue-500/5',     hoverText: 'group-hover:text-blue-600' },
  amber:   { icon: 'text-amber-600',   bg: 'bg-amber-500/10',   hoverBg: 'hover:bg-amber-500/5',    hoverText: 'group-hover:text-amber-600' },
  teal:    { icon: 'text-teal-600',    bg: 'bg-teal-500/10',    hoverBg: 'hover:bg-teal-500/5',     hoverText: 'group-hover:text-teal-600' },
  orange:  { icon: 'text-orange-600',  bg: 'bg-orange-500/10',  hoverBg: 'hover:bg-orange-500/5',   hoverText: 'group-hover:text-orange-600' },
  red:     { icon: 'text-red-600',     bg: 'bg-red-500/10',     hoverBg: 'hover:bg-red-500/5',      hoverText: 'group-hover:text-red-600' },
  purple:  { icon: 'text-purple-600',  bg: 'bg-purple-500/10',  hoverBg: 'hover:bg-purple-500/5',   hoverText: 'group-hover:text-purple-600' },
  indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-500/10',  hoverBg: 'hover:bg-indigo-500/5',   hoverText: 'group-hover:text-indigo-600' },
  cyan:    { icon: 'text-cyan-600',    bg: 'bg-cyan-500/10',    hoverBg: 'hover:bg-cyan-500/5',     hoverText: 'group-hover:text-cyan-600' },
  slate:   { icon: 'text-slate-600',   bg: 'bg-slate-500/10',   hoverBg: 'hover:bg-slate-500/5',    hoverText: 'group-hover:text-slate-600' },
};

export default function CustomersPage() {
  return <Suspense fallback={<div className="p-8"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
