'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface AuditLog {
  id: number; user_id: number; action: string; target_type: string; target_id: number;
  details: string; ip_address: string; created_at: string;
  display_name: string; email: string;
}

const ACTION_MAP: Record<string, { label: string; variant: string; colorClass: string; icon: string }> = {
  wallet_credit:        { label: 'เพิ่มเงิน',      variant: 'success',     colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'fa-arrow-down' },
  wallet_debit:         { label: 'หักเงิน',        variant: 'destructive', colorClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: 'fa-arrow-up' },
  remove_subscription:  { label: 'ลบร้านค้า',     variant: 'destructive', colorClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: 'fa-trash' },
  update_settings:      { label: 'แก้ไขตั้งค่า',  variant: 'default',     colorClass: 'bg-primary/10 text-primary border-primary/20', icon: 'fa-gear' },
  verify_slip:          { label: 'ยืนยันสลิป',    variant: 'success',     colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: 'fa-circle-check' },
  reject_slip:          { label: 'ปฏิเสธสลิป',    variant: 'warning',     colorClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: 'fa-circle-xmark' },
  edit_user:            { label: 'แก้ไขผู้ใช้',   variant: 'outline',     colorClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: 'fa-user-pen' },
  update_mc_ip:         { label: 'แก้ไข MC IP',   variant: 'outline',     colorClass: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: 'fa-shield-halved' },
};

const PAGE_SIZE = 50;

function Content() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/audit-logs', { params: { page, limit: PAGE_SIZE } });
      setLogs(r.data.logs);
      setTotal(r.data.total);
    } catch { } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-4 mb-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary transition-all" asChild>
              <Link href="/admin">
                <i className="fas fa-arrow-left text-xs" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Audit Logs <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <i className="fas fa-clock-rotate-left text-primary text-xs" />
            บันทึกเหตุการณ์และกิจกรรมย้อนหลังในระบบทั้งหมด
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2.5 bg-card border border-border p-1.5 rounded-xl shadow-sm">
           <div className="px-3 py-1.5">
             <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Logs</p>
             <p className="text-lg font-bold text-foreground leading-none">{total.toLocaleString('th-TH')}</p>
           </div>
           <div className="w-px h-6 bg-border/60" />
           <Button onClick={load} variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-secondary transition-all active:scale-95">
             <i className="fas fa-arrows-rotate text-xs" />
           </Button>
        </motion.div>
      </div>

      {/* List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {loading ? (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <SkeletonTable rows={10} />
          </Card>
        ) : logs.length === 0 ? (
          <Card className="rounded-3xl border-border shadow-sm p-16 bg-white dark:bg-card">
            <EmptyState icon="fa-clock-rotate-left" title="ไม่พบประวัติการใช้งาน" description="ยังไม่มีการบันทึกกิจกรรมใดๆ ในขณะนี้" />
          </Card>
        ) : (
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-secondary/30">
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">วัน-เวลา</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">ผู้ดำเนินการ</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-center">กิจกรรม</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">รายละเอียด</th>
                    <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <AnimatePresence mode="popLayout">
                    {logs.map((log, idx) => {
                      const act = ACTION_MAP[log.action] || { label: log.action, variant: 'secondary', colorClass: 'bg-secondary text-muted-foreground', icon: 'fa-circle-info' };
                      return (
                        <motion.tr 
                          key={log.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="hover:bg-secondary/20 transition-all duration-300 group"
                        >
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-foreground tracking-tight">
                              {new Date(log.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                            </p>
                            <p className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wider">
                              {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground border border-border group-hover:border-primary/30 transition-all">
                                {log.display_name?.charAt(0) || 'S'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate max-w-[150px] tracking-tight group-hover:text-primary transition-colors">{log.display_name || 'System'}</p>
                                <p className="text-[9px] font-bold text-muted-foreground truncate max-w-[150px] mt-0.5 opacity-60">{log.email || 'auto-trigger'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest border-none rounded-md shadow-sm ${act.colorClass}`}>
                              <i className={`fas ${act.icon} mr-1.5`} />
                              {act.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[11px] text-foreground/80 leading-relaxed line-clamp-2 max-w-[350px] font-semibold tracking-tight">{log.details}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Badge variant="outline" className="font-mono text-[9px] font-bold border-border bg-secondary/30 px-2 py-0.5 rounded-lg text-muted-foreground/80">
                              {log.ip_address || '—'}
                            </Badge>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-border/60 bg-secondary/10 gap-4">
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
    </div>
  );
}

export default function AuditLogsPage() {
  return <Suspense fallback={<div className="p-8"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
