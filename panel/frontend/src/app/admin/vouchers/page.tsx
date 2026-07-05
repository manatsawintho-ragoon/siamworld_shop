'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/icon';

interface Voucher {
  id: number;
  code: string;
  amount: string;
  max_uses: number;
  current_uses: number;
  creator_name: string | null;
  created_at: string;
}

interface Redemption {
  id: number;
  voucher_id: number;
  user_id: number;
  email: string;
  display_name: string;
  redeemed_at: string;
}

const fmtBaht = (n: number | string) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

const PAGE_SIZE = 20;

function Content() {
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [createForm, setCreateForm] = useState({ code: '', amount: '', maxUses: '1' });
  const [creating, setCreating] = useState(false);

  const [viewRedemptions, setViewRedemptions] = useState<Voucher | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/vouchers', { params: { page, limit: PAGE_SIZE } });
      setVouchers(data.data);
      setTotal(data.total);
    } catch {
      toast.error('โหลดข้อมูลล้มเหลว', 'ไม่สามารถดึงข้อมูล Voucher ได้');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { if (user?.role === 'admin') load(); }, [load, user]);

  const handleCreate = async () => {
    const amt = parseFloat(createForm.amount);
    const uses = parseInt(createForm.maxUses);
    if (!amt || amt <= 0) return toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินมากกว่า 0');
    if (!uses || uses <= 0) return toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนครั้งอย่างน้อย 1');

    setCreating(true);
    try {
      await api.post('/api/vouchers', {
        code: createForm.code.trim().toUpperCase(),
        amount: amt,
        maxUses: uses,
      });
      toast.success('สร้าง Voucher สำเร็จ', 'โค้ดใหม่พร้อมใช้งานแล้ว');
      setCreateForm({ code: '', amount: '', maxUses: '1' });
      load();
    } catch (e: any) {
      toast.error('สร้างไม่สำเร็จ', e.response?.data?.error || 'ไม่สามารถสร้างโค้ดได้');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบ Voucher นี้?')) return;
    try {
      await api.delete(`/api/vouchers/${id}`);
      toast.success('ลบสำเร็จ', 'Voucher ถูกลบแล้ว');
      load();
    } catch {
      toast.error('ลบไม่สำเร็จ', 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const openRedemptions = async (v: Voucher) => {
    setViewRedemptions(v);
    setLoadingRedemptions(true);
    setRedemptions([]);
    try {
      const { data } = await api.get(`/api/vouchers/${v.id}/redemptions`);
      setRedemptions(data.data);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ที่แลกโค้ดได้');
    } finally {
      setLoadingRedemptions(false);
    }
  };

  if (authLoading || (user && user.role !== 'admin')) return null;

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
              Vouchers <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <Icon name="ticket" className="text-primary text-xs" />
            สร้างและจัดการโค้ดโปรโมชั่นเพิ่มเงินสำหรับลูกค้า
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
           <Button size="default" onClick={load} className="rounded-xl font-bold gap-2 h-11 px-6 shadow-md shadow-primary/10 active:scale-95 transition-all">
             <Icon name="arrows-rotate" className={`${loading ? 'animate-spin' : ''}`} /> รีเฟรชโค้ด
           </Button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Create Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-3xl border-border shadow-sm bg-white dark:bg-card overflow-hidden sticky top-24">
            <CardHeader className="px-6 py-6 border-b border-border/60 bg-secondary/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                  <Icon name="plus-circle" className="text-sm" />
                </div>
                <CardTitle className="text-base font-bold tracking-tight uppercase">Generate New</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Voucher Code (Optional)</label>
                <input type="text" placeholder="Randomly generated" className="w-full px-4 py-2.5 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground uppercase placeholder:normal-case"
                  value={createForm.code} onChange={e => setCreateForm({...createForm, code: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Amount (฿)</label>
                <div className="relative group">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground/40 transition-colors group-focus-within:text-primary">฿</span>
                   <input type="number" placeholder="0.00" className="w-full pl-9 pr-4 py-2.5 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                    value={createForm.amount} onChange={e => setCreateForm({...createForm, amount: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Max Redemptions</label>
                <input type="number" placeholder="1" className="w-full px-4 py-2.5 bg-secondary/30 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                  value={createForm.maxUses} onChange={e => setCreateForm({...createForm, maxUses: e.target.value})} />
              </div>
              <Button className="w-full h-12 rounded-xl font-bold text-[10px] uppercase tracking-wider mt-2 shadow-md shadow-primary/20 active:scale-95 transition-all" onClick={handleCreate} disabled={creating}>
                {creating ? <Icon name="spinner" className="mr-2 animate-spin" /> : <Icon name="magic" className="mr-2" />}
                Create Voucher
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* List Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2">
          {loading && !vouchers.length ? (
            <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
              <SkeletonTable rows={10} />
            </Card>
          ) : vouchers.length === 0 ? (
            <Card className="rounded-3xl border-border shadow-sm p-16 bg-white dark:bg-card">
              <EmptyState icon="ticket" title="ยังไม่มี Voucher" description="เริ่มต้นด้วยการสร้างโค้ดโปรโมชั่นใหม่จากฟอร์มด้านซ้าย" />
            </Card>
          ) : (
            <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-secondary/30">
                      <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60">โค้ด Voucher</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">จำนวนเงิน</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-center">สิทธิ์การใช้</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <AnimatePresence mode="popLayout">
                      {vouchers.map((v, idx) => (
                        <motion.tr 
                          key={v.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="hover:bg-secondary/20 transition-all duration-300 group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center group-hover:rotate-12 transition-transform duration-500 shadow-sm">
                                <Icon name="ticket" className="text-base" />
                              </div>
                              <div>
                                <p className="font-bold text-foreground text-xs tracking-[0.1em] uppercase group-hover:text-primary transition-colors">{v.code}</p>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5 opacity-40">Created by {v.creator_name || 'System'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-bold text-emerald-600 text-xs">{fmtBaht(v.amount)}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="scale-90">
                              <Badge className={`px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider rounded-lg border-none shadow-sm ${v.current_uses >= v.max_uses ? "bg-slate-500 text-white" : "bg-emerald-500 text-white"}`}>
                                {v.current_uses} / {v.max_uses}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider bg-white border-2 hover:bg-slate-50 active:scale-95 transition-all shadow-sm gap-2" onClick={() => openRedemptions(v)}>
                                <Icon name="users-viewfinder" className="text-primary" /> Redemptions
                              </Button>
                              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-rose-500 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all active:scale-90 shadow-sm" onClick={() => handleDelete(v.id)}>
                                <Icon name="trash" className="text-[10px]" />
                              </Button>
                            </div>
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
      </div>

      {/* Redemptions Modal */}
      <AnimatePresence>
        {viewRedemptions && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md" 
              onClick={() => setViewRedemptions(null)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl flex flex-col bg-background border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <CardHeader className="flex flex-row items-center justify-between px-8 py-8 border-b border-border/60 bg-secondary/10">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-lg shadow-primary/5">
                    <Icon name="users" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black tracking-tight leading-tight">Redemption History</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">Code: <span className="text-primary">{viewRedemptions.code}</span> • {fmtBaht(viewRedemptions.amount)}</CardDescription>
                  </div>
                </div>
                <button 
                  onClick={() => setViewRedemptions(null)} 
                  className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-90"
                >
                  <Icon name="times" />
                </button>
              </CardHeader>
              <CardContent className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                {loadingRedemptions ? (
                  <div className="p-20 text-center flex flex-col items-center gap-4">
                    <Icon name="circle-notch" className="text-primary text-3xl animate-spin" />
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Accessing records...</p>
                  </div>
                ) : redemptions.length === 0 ? (
                  <div className="p-20 text-center space-y-4">
                    <div className="w-16 h-16 rounded-[2rem] bg-secondary flex items-center justify-center mx-auto text-muted-foreground/30 text-2xl">
                      <Icon name="ghost" />
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No redemptions found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    <AnimatePresence>
                      {redemptions.map((r, idx) => (
                        <motion.div 
                          key={r.id} 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="px-8 py-6 flex items-center justify-between hover:bg-secondary/10 transition-colors group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-foreground text-sm truncate tracking-tight group-hover:text-primary transition-colors">{r.display_name}</p>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mt-1 opacity-50 truncate">{r.email}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-6">
                            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">Timestamp</p>
                            <p className="text-[11px] font-black text-foreground uppercase tracking-wider bg-secondary/50 px-2 py-0.5 rounded-lg border border-border/50">{fmtDateTime(r.redeemed_at)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VouchersPage() {
  return <Suspense fallback={<div className="p-8"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
