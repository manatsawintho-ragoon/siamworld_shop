'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/icon';

interface Slip {
  id: number; amount: number; status: string; purpose: string;
  display_name: string; email: string; created_at: string;
  verified_at: string | null; reject_reason: string | null;
  easyslip_ref: string | null;
}

const FILTER_TABS = [
  { value: '',         label: 'ทั้งหมด',       icon: 'list' },
  { value: 'pending',  label: 'รอดำเนินการ',  icon: 'clock' },
  { value: 'verified', label: 'ตรวจสอบแล้ว',  icon: 'circle-check' },
  { value: 'rejected', label: 'ปฏิเสธแล้ว',   icon: 'circle-xmark' },
];

const PAGE_SIZE = 50;
const fmtBaht = (n: number) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

function Content() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<Slip | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/admin/slips', { params: { page, status: status || undefined, limit: PAGE_SIZE } })
      .then(r => { setSlips(r.data.slips); setTotal(r.data.total); })
      .catch(() => toast.error('โหลดล้มเหลว', 'ไม่สามารถดึงข้อมูลสลิปได้'))
      .finally(() => setLoading(false));
  }, [page, status, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const verify = async (id: number) => {
    if (!confirm('ต้องการอนุมัติสลิปนี้ใช่หรือไม่?')) return;
    setActionLoading(id);
    try {
      await api.post(`/api/admin/slips/${id}/verify`);
      toast.success('อนุมัติสำเร็จ', `สลิป #${id} ตรวจสอบเรียบร้อย`);
      load();
    } catch (e: any) {
      toast.error('ล้มเหลว', e.response?.data?.error || 'ไม่สามารถอนุมัติได้');
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (id: number, reason: string) => {
    setActionLoading(id);
    try {
      await api.post(`/api/admin/slips/${id}/reject`, { reason });
      toast.success('ปฏิเสธสำเร็จ', `สลิป #${id} ถูกปฏิเสธ`);
      setRejectModal(null);
      load();
    } catch (e: any) {
      toast.error('ล้มเหลว', e.response?.data?.error || 'ไม่สามารถปฏิเสธได้');
    } finally {
      setActionLoading(null);
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
              Payments <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <Icon name="receipt" className="text-primary text-xs" />
            ตรวจสอบและจัดการรายการชำระเงินทั้งหมด {total.toLocaleString('th-TH')} รายการ
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
           <Button size="default" onClick={load} className="rounded-xl font-bold gap-2 h-11 px-6 shadow-md shadow-primary/10 active:scale-95 transition-all">
             <Icon name="arrows-rotate" className={`${loading ? 'animate-spin' : ''}`} /> รีเฟรชข้อมูล
           </Button>
        </motion.div>
      </div>

      {/* Filter tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-3xl border-border shadow-sm bg-white dark:bg-card overflow-hidden">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5 p-1 bg-secondary/50 rounded-xl items-center">
              {FILTER_TABS.map(tab => (
                <button 
                  key={tab.value} 
                  onClick={() => setStatus(tab.value)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                    status === tab.value
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 z-10'
                      : 'text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm'
                  }`}
                >
                  <Icon name={tab.icon as IconName} className={`${status === tab.value ? 'opacity-100' : 'opacity-40'}`} />
                  {tab.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {loading ? (
          <Card className="rounded-[2.5rem] border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <SkeletonTable rows={10} />
          </Card>
        ) : slips.length === 0 ? (
          <Card className="rounded-[2.5rem] border-border shadow-sm p-24 bg-white dark:bg-card">
            <EmptyState icon="receipt" title="ไม่พบรายการชำระเงิน" description="ไม่พบข้อมูลสลิปที่ตรงกับสถานะที่คุณเลือก" />
          </Card>
        ) : (
          <Card className="rounded-[2.5rem] border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">ผู้ใช้งาน</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">จำนวน / วัตถุประสงค์</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-center">สถานะ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">วัน-เวลา</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <AnimatePresence mode="popLayout">
                    {slips.map((slip, idx) => (
                      <motion.tr 
                        key={slip.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-secondary/20 transition-all duration-300 group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                              {slip.display_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground text-xs truncate max-w-[180px] tracking-tight group-hover:text-primary transition-colors">{slip.display_name}</p>
                              <p className="text-[10px] font-semibold text-muted-foreground mt-0.5 opacity-60 truncate max-w-[180px]">{slip.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-emerald-600 tracking-tight leading-none">{fmtBaht(slip.amount)}</p>
                          <Badge variant="secondary" className="mt-1.5 text-[8px] font-bold uppercase tracking-widest border-none rounded-lg bg-secondary/80">
                            {slip.purpose === 'topup' ? 'Wallet Top-up' : 'Package Renew'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="scale-90 origin-center">
                             <StatusBadge status={slip.status} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[11px] font-bold text-foreground tracking-tight">{fmtDateTime(slip.created_at)}</p>
                          {slip.verified_at && (
                            <p className="text-[9px] text-emerald-600 font-bold mt-1 uppercase tracking-wider flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md w-fit">
                              <Icon name="check-double" className="text-[7px]" />
                              Verified at {new Date(slip.verified_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          {slip.reject_reason && (
                            <div className="mt-1 flex items-center gap-1 text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md w-fit group-hover:animate-pulse">
                              <Icon name="circle-xmark" className="text-[9px]" />
                              <p className="text-[9px] font-bold uppercase tracking-wider truncate max-w-[120px]" title={slip.reject_reason}>
                                {slip.reject_reason}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {slip.status === 'pending' ? (
                            <div className="flex justify-end items-center gap-2">
                              <Button onClick={() => verify(slip.id)} disabled={actionLoading === slip.id}
                                className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-md shadow-emerald-500/10 active:scale-95 transition-all">
                                {actionLoading === slip.id ? <Icon name="spinner" className="animate-spin" /> : 'Approve'}
                              </Button>
                              <Button variant="outline" onClick={() => setRejectModal(slip)} disabled={actionLoading === slip.id}
                                className="h-9 px-4 rounded-xl border-rose-500/20 text-rose-500 bg-rose-500/5 hover:bg-rose-500 hover:text-white font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all">
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end opacity-60 group-hover:opacity-100 transition-opacity">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Reference ID</span>
                              <Badge variant="outline" className="font-mono text-[9px] font-bold border-border bg-secondary/30 px-2 py-0.5 rounded-lg">
                                {slip.easyslip_ref || 'INTERNAL'}
                              </Badge>
                            </div>
                          )}
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
        {rejectModal && (
          <RejectModal
            slip={rejectModal}
            loading={actionLoading === rejectModal.id}
            onSubmit={(reason) => reject(rejectModal.id, reason)}
            onClose={() => setRejectModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RejectModal({
  slip, loading, onSubmit, onClose,
}: {
  slip: Slip;
  loading: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState('');

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

  const submit = () => {
    const r = reason.trim();
    if (!r) return;
    onSubmit(r);
  };

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
        className="relative w-full sm:max-w-xl flex flex-col bg-background sm:border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10"
      >
        <div className="sm:hidden flex justify-center pt-5 pb-1 flex-shrink-0">
          <div className="w-16 h-1 bg-muted rounded-full" />
        </div>

        <div className="flex items-center justify-between gap-4 p-6 border-b border-border flex-shrink-0 bg-rose-500/5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-500/20">
              <Icon name="circle-xmark" className="text-lg" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-lg tracking-tight truncate leading-tight">Reject Payment</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{slip.display_name} • {fmtBaht(slip.amount)}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-foreground hover:shadow-sm transition-all cursor-pointer active:scale-90"
          >
            <Icon name="times" className="text-sm" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Reason for Rejection</label>
            <textarea
              autoFocus
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Invalid receipt, Incorrect amount, Duplicate submission..."
              className="w-full px-5 py-3 bg-secondary/50 border-2 border-transparent rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-rose-500/20 focus:ring-4 focus:ring-rose-500/5 transition-all resize-none text-foreground placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all">
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={loading || !reason.trim()}
              className="flex-[2] h-12 rounded-xl font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-rose-500/20">
              {loading ? <><Icon name="spinner" className="mr-2 animate-spin" /> Processing...</> : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export default function PaymentsPage() {
  return <Suspense fallback={<div className="p-8"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
