'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import TimeRemaining from '@/components/TimeRemaining';
import { SkeletonStat, SkeletonTable } from '@/components/SkeletonLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import DomainModal from '@/components/domain/DomainModal';
import CompensationPopup from '@/components/CompensationPopup';
import { Icon, type IconName } from '@/components/ui/icon';

interface Sub {
  id: number; shop_name: string; domain: string; status: string;
  expires_at: string; package_months: number; price_paid: number;
  suspend_at?: string | null; grace_days?: number;
}

interface Promo {
  kind: 'trial' | 'intro';
  months: number;
  days?: number;
  price: number;
  label: string;
  regularPrice: number;
}

const ITEMS_PER_PAGE = 8;

const STATUS_CONFIG: Record<string, string> = {
  active: 'active',
  deploying: 'deploying',
  suspended: 'suspended',
};

function StatCard({ label, value, icon, color = 'primary', subValue }: any) {
  const colorMap: any = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border bg-card shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 group overflow-hidden">
        <CardContent className="p-6 relative">
          <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 transition-transform group-hover:scale-150 duration-700 ${colorMap[color].split(' ')[0]}`} />
          <div className="flex items-center gap-5 relative z-10">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl border shadow-sm ${colorMap[color]}`}>
              <Icon name={icon} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1">{label}</p>
              <h4 className="text-3xl font-black text-foreground tracking-tight leading-none">{value}</h4>
              {subValue && <p className="text-[10px] font-bold text-muted-foreground/80 mt-1.5">{subValue}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [usedTrial, setUsedTrial] = useState(false);
  const [usedIntro, setUsedIntro] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [domainSubId, setDomainSubId] = useState<number | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const { data } = await api.get('/api/subscriptions');
      setSubs(data.subscriptions || []);
      setUsedTrial(!!data.usedTrial);
      setUsedIntro(!!data.usedIntro);
      setPromos(data.promos || []);
    } catch { } finally { setLoadingSubs(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
    else if (user) fetchSubs();
  }, [user, authLoading, router, fetchSubs]);

  const filtered = useMemo(() => {
    return subs.filter(s => {
      const matchSearch = s.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.domain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFilter = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchFilter;
    });
  }, [subs, searchTerm, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = useMemo(() =>
    filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [searchTerm, filterStatus]);

  const activeCount = subs.filter(s => s.status === 'active').length;
  const expiringSoon = subs.filter(s => {
    const d = new Date(s.expires_at).getTime() - Date.now();
    return d < 7 * 86400000 && d > 0 && s.status !== 'suspended';
  });

  const hasActiveShop = subs.some(s => !['cancelled', 'expired'].includes(s.status));
  const trialPromo = promos.find(p => p.kind === 'trial');
  const introPromo = promos.find(p => p.kind === 'intro');
  const showPromoBanner = !hasActiveShop && (!usedTrial || !usedIntro) && (trialPromo || introPromo);

  const FILTER_TABS = [
    { value: 'all', label: 'ทั้งหมด', icon: 'layer-group' },
    { value: 'active', label: 'ออนไลน์', icon: 'circle-check' },
    { value: 'deploying', label: 'กำลังติดตั้ง', icon: 'rocket' },
    { value: 'suspended', label: 'ถูกระงับ', icon: 'circle-pause' },
  ];

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <CompensationPopup />
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">

        {/* Hero Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-1"
          >
            <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
              Dashboard <span className="text-primary text-2xl opacity-20">/</span>
            </h1>
            <p className="text-muted-foreground font-semibold flex items-center gap-2">
              <Icon name="sparkles" className="text-amber-500 text-xs" />
              ยินดีต้อนรับกลับมา, คุณ {user?.displayName}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap gap-4"
          >
             <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-card border border-border shadow-sm">
                <Button variant="ghost" size="lg" asChild className="h-12 px-6 rounded-xl font-bold gap-2 hover:bg-secondary">
                  <Link href="/dashboard/topup">
                    <Icon name="plus-circle" className="text-primary" /> เติมเงิน
                  </Link>
                </Button>
                <div className="h-6 w-px bg-border mx-1" />
                <div className="px-5 py-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">คงเหลือ</p>
                  <p className="text-lg font-black text-foreground">฿{(Number(user?.walletBalance) || 0).toLocaleString()}</p>
                </div>
             </div>

             {!hasActiveShop && !usedTrial && trialPromo ? (
               <Button size="lg" asChild className="h-14 px-8 rounded-2xl font-black gap-3 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 transition-transform active:scale-95">
                 <Link href="/order?kind=trial">
                   <Icon name="rocket" /> ทดลองฟรี {trialPromo.days} วัน
                 </Link>
               </Button>
             ) : !usedIntro && introPromo ? (
               <Button size="lg" asChild className="h-14 px-8 rounded-2xl font-black gap-3 shadow-lg shadow-primary/20 transition-transform active:scale-95">
                 <Link href="/order?kind=intro">
                   <Icon name="tag" /> เดือนแรก ฿{introPromo.price}
                 </Link>
               </Button>
             ) : (
               <Button size="lg" asChild className="h-14 px-8 rounded-2xl font-black gap-3 shadow-lg shadow-primary/20 transition-transform active:scale-95">
                 <Link href="/order">
                   <Icon name="store-medical" /> สร้างร้านค้าใหม่
                 </Link>
               </Button>
             )}
          </motion.div>
        </div>

        {/* Promo Banner */}
        {showPromoBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {trialPromo && !usedTrial && (
              <Link href="/order?kind=trial" className="group block">
                <div className="flex items-center gap-5 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm shadow-emerald-500/30">
                    <Icon name="rocket" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-0.5">สิทธิ์ที่คุณได้รับ</p>
                    <p className="text-sm font-black text-foreground">ทดลองฟรี {trialPromo.days} วัน</p>
                    <p className="text-xs font-semibold text-muted-foreground">ไม่ต้องชำระเงิน · เริ่มได้เลย</p>
                  </div>
                  <div className="flex-shrink-0 text-emerald-600 group-hover:translate-x-1 transition-transform">
                    <Icon name="arrow-right" />
                  </div>
                </div>
              </Link>
            )}
            {introPromo && !usedIntro && (
              <Link href="/order?kind=intro" className="group block">
                <div className="flex items-center gap-5 p-5 rounded-2xl bg-primary/10 border border-primary/30 hover:border-primary/60 hover:bg-primary/15 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl flex-shrink-0 shadow-sm shadow-primary/30">
                    <Icon name="tag" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">โปรโมชั่นพิเศษ</p>
                    <p className="text-sm font-black text-foreground">เดือนแรก ฿{introPromo.price} <span className="font-semibold text-muted-foreground line-through text-xs">฿{introPromo.regularPrice}</span></p>
                    <p className="text-xs font-semibold text-muted-foreground">ประหยัด ฿{introPromo.regularPrice - introPromo.price} · เฉพาะครั้งแรก</p>
                  </div>
                  <div className="flex-shrink-0 text-primary group-hover:translate-x-1 transition-transform">
                    <Icon name="arrow-right" />
                  </div>
                </div>
              </Link>
            )}
            {usedTrial && trialPromo && (
              <div className="flex items-center gap-5 p-5 rounded-2xl bg-secondary border border-border opacity-60">
                <div className="w-12 h-12 rounded-xl bg-secondary border border-border text-muted-foreground flex items-center justify-center text-xl flex-shrink-0">
                  <Icon name="check" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">ใช้สิทธิ์แล้ว</p>
                  <p className="text-sm font-black text-muted-foreground">ทดลองฟรี {trialPromo.days} วัน</p>
                  <p className="text-xs font-semibold text-muted-foreground">คุณเคยใช้สิทธิ์นี้ไปแล้ว</p>
                </div>
              </div>
            )}
            {usedIntro && introPromo && (
              <div className="flex items-center gap-5 p-5 rounded-2xl bg-secondary border border-border opacity-60">
                <div className="w-12 h-12 rounded-xl bg-secondary border border-border text-muted-foreground flex items-center justify-center text-xl flex-shrink-0">
                  <Icon name="check" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">ใช้สิทธิ์แล้ว</p>
                  <p className="text-sm font-black text-muted-foreground">ทดลองเดือนแรก ฿{introPromo.price}</p>
                  <p className="text-xs font-semibold text-muted-foreground">คุณเคยใช้สิทธิ์นี้ไปแล้ว</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Dynamic Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatCard 
             label="ยอดเงินคงเหลือ" 
             value={`฿${(Number(user?.walletBalance) || 0).toLocaleString()}`} 
             icon="wallet" 
             color="emerald"
             subValue="พร้อมใช้งานสำหรับแพ็กเกจ"
           />
           <StatCard 
             label="ร้านที่ออนไลน์" 
             value={activeCount} 
             icon="signal" 
             color="primary"
             subValue="เซิร์ฟเวอร์เปิดใช้งานปกติ"
           />
           <StatCard 
             label="จำนวนร้านทั้งหมด" 
             value={subs.length} 
             icon="cubes" 
             color="blue"
             subValue="รวมแพ็กเกจที่หมดอายุ"
           />
           <a href="https://www.facebook.com/siamsitestore" target="_blank" rel="noopener noreferrer" className="block h-full">
             <StatCard 
               label="ศูนย์ซัพพอร์ต" 
               value="ติดต่อ" 
               icon="headset" 
               color="amber"
               subValue="ทีมงานดูแลตลอด 24 ชม."
             />
           </a>
        </div>

        {/* Main Section Layout */}
        <div className="grid grid-cols-1 gap-8">
           
           {/* Section Header */}
           <div className="flex flex-col md:flex-row gap-6 justify-between items-end">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-foreground tracking-tight">การจัดการร้านค้า</h3>
                <div className="flex bg-white dark:bg-card p-1.5 rounded-[1.25rem] border border-border shadow-sm overflow-x-auto hide-scrollbar">
                  {FILTER_TABS.map(tab => (
                    <button key={tab.value} onClick={() => { setFilterStatus(tab.value); setPage(1); }}
                      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all duration-300 ${
                        filterStatus === tab.value
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}>
                      <Icon name={tab.icon as IconName} className="text-[11px]" /> {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Icon name="search" className="text-muted-foreground/60 text-sm" />
                </div>
                <input 
                  type="text" 
                  placeholder="ค้นหาชื่อร้านหรือโดเมน..."
                  className="w-full pl-11 pr-4 h-12 bg-white dark:bg-card border border-border rounded-2xl text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary placeholder:text-muted-foreground/50 shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
           </div>

           {/* Results Table */}
           {loadingSubs ? (
              <Card className="rounded-[2.5rem] overflow-hidden border-border"><CardContent className="p-0"><SkeletonTable rows={5} /></CardContent></Card>
           ) : subs.length > 0 ? (
              <AnimatePresence mode="wait">
                {filtered.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-card border-2 border-dashed border-border rounded-[2.5rem] p-20 text-center space-y-4"
                  >
                    <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto text-muted-foreground/30 text-3xl">
                       <Icon name="search" />
                    </div>
                    <p className="text-lg font-bold text-muted-foreground">ไม่พบร้านค้าที่ตรงตามการค้นหา</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-card border border-border rounded-[2.5rem] shadow-sm overflow-hidden"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[900px]">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">ข้อมูลร้านค้า</th>
                            <th className="px-6 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] text-center">สถานะปัจจุบัน</th>
                            <th className="px-6 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">รายละเอียดแพ็กเกจ</th>
                            <th className="px-6 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">อายุการใช้งาน</th>
                            <th className="px-8 py-6 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] text-right">แอคชั่น</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {paged.map(sub => {
                            const diff = new Date(sub.expires_at).getTime() - Date.now();
                            const d = Math.floor(diff / 86400000);
                            const isExpiringSoon = d < 7 && d >= 0 && sub.status !== 'suspended';

                            return (
                              <tr key={sub.id} className="group hover:bg-secondary/20 transition-all duration-300">
                                <td className="px-8 py-6">
                                  <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500 border-2 ${
                                      isExpiringSoon 
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' 
                                      : 'bg-secondary border-transparent text-muted-foreground group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary'
                                    }`}>
                                      <Icon name="cube" className="text-lg" />
                                    </div>
                                    <div>
                                      <p className="font-black text-foreground text-base tracking-tight leading-tight group-hover:text-primary transition-colors">{sub.shop_name}</p>
                                      <a href={`https://${sub.domain}`} target="_blank" rel="noopener noreferrer"
                                        className="text-[13px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 mt-1 opacity-80">
                                        {sub.domain} <Icon name="arrow-up-right-from-square" className="text-[9px]" />
                                      </a>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                  <div className="inline-flex scale-110"><StatusBadge status={STATUS_CONFIG[sub.status] || 'expired'} /></div>
                                </td>
                                <td className="px-6 py-6">
                                  <div className="space-y-1">
                                    <div className="text-sm font-black text-foreground">{sub.package_months} เดือน</div>
                                    <div className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                                       ฿{Number(sub.price_paid).toLocaleString()}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-6">
                                  <div className="p-3 bg-secondary/50 rounded-2xl border border-border/50 inline-block min-w-[140px]">
                                    <TimeRemaining
                                      date={sub.expires_at}
                                      suspendAt={sub.suspend_at}
                                      suspended={sub.status === 'suspended'}
                                    />
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                  <div className="flex justify-end items-center gap-3">
                                    <Button variant="outline" size="sm" onClick={() => setDomainSubId(sub.id)} className="h-10 px-5 rounded-xl font-bold border-border shadow-sm hover:border-primary/40 hover:bg-white cursor-pointer transition-all">
                                      <Icon name="globe" className="mr-2 opacity-60" /> โดเมน
                                    </Button>
                                    <Button variant="outline" size="sm" asChild className="h-10 px-5 rounded-xl font-bold border-border shadow-sm hover:border-primary/40 hover:bg-white cursor-pointer transition-all">
                                      <Link href={`/dashboard/credentials?id=${sub.id}`} data-track="dashboard_manage_shop">
                                        จัดการ <Icon name="angle-right" className="ml-2 opacity-50" />
                                      </Link>
                                    </Button>
                                    <Button 
                                      variant={isExpiringSoon ? 'destructive' : 'default'} 
                                      size="sm" asChild 
                                      className={`h-10 px-5 rounded-xl font-black transition-all active:scale-95 cursor-pointer ${!isExpiringSoon ? 'bg-foreground hover:bg-foreground/90' : ''}`}
                                    >
                                      <Link href={`/dashboard/renew?id=${sub.id}`}>
                                        <Icon name="bolt" className="mr-2 text-[10px]" /> ต่ออายุ
                                      </Link>
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-6 border-t border-border/60 bg-secondary/10 gap-4">
                        <p className="text-[13px] font-bold text-muted-foreground">
                          แสดง {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} จาก {filtered.length} ร้านค้า
                        </p>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={page <= 1} 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="rounded-xl w-10 h-10 border-border hover:bg-white transition-all shadow-sm"
                          >
                            <Icon name="chevron-left" className="text-[10px]" />
                          </Button>
                          <div className="bg-white border border-border rounded-xl px-4 h-10 flex items-center font-black text-xs min-w-[80px] justify-center shadow-sm">
                            {page} / {totalPages}
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            disabled={page >= totalPages} 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="rounded-xl w-10 h-10 border-border hover:bg-white transition-all shadow-sm"
                          >
                            <Icon name="chevron-right" className="text-[10px]" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
           ) : (
             /* Empty State / Onboarding */
             <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="border-border border-2 bg-white rounded-[3rem] shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-primary/5 p-12 text-center border-b border-border">
                       <div className="w-20 h-20 rounded-[2rem] bg-primary text-white flex items-center justify-center mx-auto text-3xl shadow-xl shadow-primary/20 mb-8">
                          <Icon name="rocket" />
                       </div>
                       <h3 className="text-3xl font-black text-foreground tracking-tight mb-2">ยินดีต้อนรับสู่ SIAMSITE SHOP</h3>
                       <p className="text-muted-foreground font-semibold max-w-lg mx-auto">เริ่มต้นธุรกิจ Minecraft ของคุณด้วย 3 ขั้นตอนง่ายๆ เพื่อเตรียมตัวรับยอดขายแบบมืออาชีพ</p>
                    </div>
                    
                    <div className="p-12 grid grid-cols-1 md:grid-cols-3 gap-10 bg-white">
                      {[
                        {
                          step: 1, title: 'เติมเงินเข้ากระเป๋า', icon: 'wallet',
                          desc: 'รองรับการเติมเงินผ่าน PromptPay ตรวจสลิปไวใน 1 วินาที เพื่อเตรียมซื้อแพ็กเกจร้านค้า',
                          done: (user?.walletBalance ?? 0) > 0,
                          action: '/dashboard/topup', actionLabel: 'ไปหน้าเติมเงิน',
                        },
                        {
                          step: 2, title: 'เปิดร้านค้า', icon: 'shop',
                          desc: 'เลือกชื่อร้านและโดเมนที่ต้องการ ระบบจะทำการติดตั้ง (Deploy) ร้านค้าของคุณให้อัตโนมัติ',
                          done: false,
                          action: null, actionLabel: null,
                        },
                        {
                          step: 3, title: 'เชื่อมต่อเซิร์ฟเวอร์', icon: 'link',
                          desc: 'นำรหัส RCON ไปใส่ใน Plugin AuthMe ของคุณ เพื่อเริ่มต้นการส่งไอเท็มเข้าตัวผู้เล่นทันที',
                          done: false, action: null, actionLabel: null,
                        },
                      ].map((s) => (
                        <div key={s.step} className="space-y-6 group">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm border-2 transition-all duration-500 ${s.done ? 'bg-emerald-500 border-emerald-500 text-white rotate-[360deg]' : 'bg-secondary border-border text-muted-foreground group-hover:border-primary/30 group-hover:text-primary'}`}>
                              <Icon name={(s.done ? 'check' : s.icon) as IconName} />
                            </div>
                            <div>
                              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${s.done ? 'text-emerald-600' : 'text-primary'}`}>Step {s.step}</span>
                              <h4 className="text-base font-black text-foreground tracking-tight">{s.title}</h4>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-muted-foreground leading-relaxed h-12">{s.desc}</p>
                          <div className="pt-2 space-y-2">
                            {s.step === 2 ? (
                              <>
                                {trialPromo && !usedTrial && (
                                  <Button asChild className="rounded-xl w-full h-11 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 transition-all">
                                    <Link href="/order?kind=trial">
                                      <Icon name="rocket" className="mr-2" /> ทดลองฟรี {trialPromo.days} วัน
                                    </Link>
                                  </Button>
                                )}
                                {introPromo && !usedIntro && (
                                  <Button variant={usedTrial || !trialPromo ? 'default' : 'secondary'} asChild className="rounded-xl w-full h-11 font-bold border border-border shadow-sm active:scale-95 transition-all">
                                    <Link href="/order?kind=intro">
                                      <Icon name="tag" className="mr-2" /> เดือนแรก ฿{introPromo.price}
                                    </Link>
                                  </Button>
                                )}
                                <Button variant="secondary" asChild className="rounded-xl w-full h-11 font-bold border border-border shadow-sm active:scale-95 transition-all">
                                  <Link href="/order">
                                    <Icon name="store" className="mr-2" /> ซื้อแพ็กเกจปกติ
                                  </Link>
                                </Button>
                              </>
                            ) : s.action && !s.done ? (
                              <Button variant="secondary" asChild className="rounded-xl w-full h-11 font-bold border border-border shadow-sm active:scale-95 transition-all">
                                <Link href={s.action}>{s.actionLabel}</Link>
                              </Button>
                            ) : s.done ? (
                              <div className="h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-sm font-black border border-emerald-500/20">
                                <Icon name="check-circle" /> เสร็จสมบูรณ์
                              </div>
                            ) : (
                              <div className="h-11 flex items-center justify-center gap-2 rounded-xl bg-secondary text-muted-foreground/50 text-xs font-black border border-border border-dashed">
                                รอทำขั้นตอนก่อนหน้า
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
             </motion.div>
           )}
        </div>
      </div>

      <DomainModal subId={domainSubId} isOpen={domainSubId !== null} onClose={() => setDomainSubId(null)} />
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
