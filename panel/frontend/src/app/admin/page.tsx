'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { SkeletonStat } from '@/components/SkeletonLoader';
import AdminChart from '@/components/AdminCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface Stats {
  active_shops: number; deploying: number; suspended: number; expiring_soon: number;
  total_users: number; revenue_30d: number; pending_slips: number;
}

interface Sub {
  id: number; shop_name: string; domain: string; status: string;
}

interface Slip {
  id: number; amount: number; display_name: string; created_at: string;
}

function StatCard({ label, value, icon, color = 'primary', subValue, href }: any) {
  const colorMap: any = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    rose: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  };

  const Content = (
    <Card className="border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-500 group overflow-hidden h-full">
      <CardContent className="p-4 relative">
        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-5 transition-transform group-hover:scale-150 duration-700 ${colorMap[color].split(' ')[0]}`} />
        <div className="flex items-center gap-4 relative z-10">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-base border shadow-sm transition-transform group-hover:rotate-12 ${colorMap[color]}`}>
            <i className={`fas ${icon}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
            <h4 className="text-2xl font-bold text-foreground tracking-tight leading-none">{value}</h4>
            {subValue && <p className="text-[9px] font-bold text-muted-foreground/80 mt-1.5">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
      {href ? <Link href={href} className="block outline-none">{Content}</Link> : Content}
    </motion.div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [charts, setCharts] = useState<{ revenue: any[], growth: any[] }>({ revenue: [], growth: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, b, l, c] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/subscriptions', { params: { limit: 8 } }),
        api.get('/api/admin/slips', { params: { status: 'pending', limit: 5 } }),
        api.get('/api/admin/stats/charts'),
      ]);
      setStats(s.data);
      setSubs(b.data.subscriptions || []);
      setSlips(l.data.slips || []);
      setCharts(c.data || { revenue: [], growth: [] });
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtBaht = (n: number) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 });

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8">
      <SkeletonStat /> <SkeletonStat /> <SkeletonStat /> <SkeletonStat />
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Admin Overview <span className="text-primary text-xl opacity-20">/</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2 mt-0.5">
            <i className="fas fa-shield-halved text-primary text-xs" />
            แผงควบคุมระบบ Siamsite SaaS
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
           <Button size="default" onClick={load} className="rounded-xl font-bold gap-2 h-11 px-6 shadow-md shadow-primary/10 active:scale-95 transition-all">
             <i className="fas fa-arrows-rotate" /> รีเฟรชข้อมูล
           </Button>
        </motion.div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Active Shops" 
          value={stats?.active_shops ?? 0} 
          icon="fa-store" 
          color="emerald" 
          href="/admin/customers?status=active"
          subValue="ร้านค้าที่กำลังออนไลน์"
        />
        <StatCard 
          label="Monthly Revenue" 
          value={fmtBaht(stats?.revenue_30d ?? 0)} 
          icon="fa-sack-dollar" 
          color="primary" 
          href="/admin/payments"
          subValue="รายได้รวม 30 วันล่าสุด"
        />
        <StatCard 
          label="Total Users" 
          value={stats?.total_users ?? 0} 
          icon="fa-user-group" 
          color="blue" 
          href="/admin/users"
          subValue="ผู้สมัครสมาชิกทั้งหมด"
        />
        <StatCard 
          label="Pending Slips" 
          value={stats?.pending_slips ?? 0} 
          icon="fa-file-circle-check" 
          color="rose" 
          href="/admin/payments?status=pending"
          subValue={stats?.pending_slips ? "ต้องการการตรวจสอบด่วน" : "ตรวจสอบครบถ้วนแล้ว"}
        />
      </div>

      {/* Analytical Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <i className="fas fa-chart-area text-sm" />
                 </div>
                 <CardTitle className="text-base font-bold tracking-tight">Revenue Trends</CardTitle>
               </div>
               <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold uppercase tracking-wider text-[9px]">Real-time</Badge>
            </CardHeader>
            <CardContent className="px-4 pb-6">
              <AdminChart data={charts.revenue} type="revenue" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <CardHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <i className="fas fa-users-line text-sm" />
                 </div>
                 <CardTitle className="text-base font-bold tracking-tight">User Growth</CardTitle>
               </div>
               <Badge variant="outline" className="text-[9px] font-bold border-blue-200">Last 30 Days</Badge>
            </CardHeader>
            <CardContent className="px-4 pb-6">
              <AdminChart data={charts.growth} type="growth" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Operational Details */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        
        {/* Recent Deployments */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-2">
          <Card className="rounded-[2.5rem] border-border shadow-sm overflow-hidden bg-white dark:bg-card h-full">
            <CardHeader className="px-8 py-8 border-b border-border/60 flex flex-row items-center justify-between bg-secondary/10">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground">
                    <i className="fas fa-clock-rotate-left text-sm" />
                  </div>
                  <CardTitle className="text-base font-black tracking-tight uppercase">Recent Installations</CardTitle>
               </div>
               <Button variant="ghost" asChild className="h-9 px-4 rounded-xl font-bold text-xs gap-2 hover:bg-white transition-all">
                 <Link href="/admin/customers">View All <i className="fas fa-arrow-right text-[10px] opacity-30" /></Link>
               </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-secondary/20">
                      <th className="px-8 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Shop Name / Domain</th>
                      <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Status</th>
                      <th className="px-8 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {subs.slice(0, 8).map(sub => (
                      <tr key={sub.id} className="hover:bg-secondary/20 transition-all duration-300 group">
                        <td className="px-8 py-5">
                          <p className="font-black text-foreground text-sm tracking-tight group-hover:text-primary transition-colors">{sub.shop_name}</p>
                          <p className="text-[11px] font-bold text-muted-foreground/70 mt-1">{sub.domain}</p>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="scale-90 inline-block"><StatusBadge status={sub.status} /></div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <Button variant="secondary" size="sm" asChild className="h-8 px-4 rounded-xl text-[10px] font-black tracking-wider uppercase border border-border shadow-sm active:scale-95 cursor-pointer">
                            <Link href={`/admin/customers?search=${sub.domain}`}>Manage</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Urgent Actions (Slips) */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="rounded-[2.5rem] border-border shadow-sm overflow-hidden bg-white dark:bg-card">
            <CardHeader className="px-8 py-8 border-b border-border/60 bg-rose-500/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <i className="fas fa-receipt text-sm" />
                </div>
                <CardTitle className="text-base font-black tracking-tight uppercase">Verification Required</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {slips.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-2xl">
                    <i className="fas fa-check-circle" />
                  </div>
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">System Clear</p>
                </div>
              ) : (
                <>
                  {slips.map(slip => (
                    <motion.div key={slip.id} whileHover={{ scale: 1.02 }}>
                      <Link 
                        href="/admin/payments?status=pending"
                        className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl hover:border-rose-500/40 transition-all shadow-sm group"
                      >
                        <div className="min-w-0">
                           <p className="font-black text-foreground text-sm">{fmtBaht(slip.amount)}</p>
                           <p className="text-[11px] font-bold text-muted-foreground truncate max-w-[140px] mt-1">{slip.display_name}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-rose-500 group-hover:text-white transition-all">
                          <i className="fas fa-magnifying-glass text-xs" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                  <Button variant="outline" size="sm" asChild className="w-full mt-4 h-11 rounded-2xl font-black text-xs uppercase tracking-wider border-border hover:bg-secondary">
                    <Link href="/admin/payments?status=pending">Review All Slips</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}
