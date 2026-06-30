'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { PATH_LABELS, FEATURE_LABELS } from '@/lib/activityLabels';

interface PageRow { path: string; views: number; users: number; }
interface FeatureRow { feature: string; clicks: number; users: number; }
interface Hotspots {
  pages: PageRow[];
  features: FeatureRow[];
  totals: { totalViews: number; totalClicks: number; activeUsers: number };
}

// Deep-link a hotspot row into the audit log, filtered to that page/feature, so the
// admin can see exactly who used it and when (latest first).
const detailLink = (detail: string) => `/admin/audit-logs?category=activity&q=${encodeURIComponent(detail)}`;

const RANGES = [
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
];

function fromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-secondary/60 overflow-hidden">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <Card className="rounded-2xl border-border shadow-sm p-5 bg-white dark:bg-card flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <i className={`fas ${icon}`} />
      </div>
      <div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-none">{value.toLocaleString('th-TH')}</p>
      </div>
    </Card>
  );
}

function Content() {
  const [data, setData] = useState<Hotspots | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/activity-hotspots', { params: { from: fromDays(days) } });
      setData(r.data);
    } catch { } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const maxViews = data?.pages?.[0]?.views || 0;
  const maxClicks = data?.features?.[0]?.clicks || 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-4 mb-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary transition-all" asChild>
              <Link href="/admin"><i className="fas fa-arrow-left text-xs" /></Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              พฤติกรรมการใช้งาน <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <i className="fas fa-fire text-primary text-xs" />
            หน้าและฟีเจอร์ที่ลูกค้าใช้งานมากที่สุด (hotspots) ในแผงควบคุม
          </p>
        </motion.div>

        <div className="flex items-center gap-1.5 bg-card border border-border p-1.5 rounded-xl shadow-sm">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              onClick={() => setDays(r.days)}
              variant={days === r.days ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-lg text-xs font-bold"
            >
              {r.label}
            </Button>
          ))}
          <div className="w-px h-6 bg-border/60" />
          <Button onClick={load} variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-secondary transition-all active:scale-95">
            <i className="fas fa-arrows-rotate text-xs" />
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="fa-eye" label="Page Views" value={data?.totals.totalViews || 0} />
        <StatCard icon="fa-hand-pointer" label="Feature Clicks" value={data?.totals.totalClicks || 0} />
        <StatCard icon="fa-users" label="ผู้ใช้ที่ active" value={data?.totals.activeUsers || 0} />
      </div>

      {loading ? (
        <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card"><SkeletonTable rows={8} /></Card>
      ) : !data || (data.pages.length === 0 && data.features.length === 0) ? (
        <Card className="rounded-3xl border-border shadow-sm p-16 bg-white dark:bg-card">
          <EmptyState icon="fa-fire" title="ยังไม่มีข้อมูลการใช้งาน" description="ยังไม่มีการบันทึกการเคลื่อนไหวในช่วงเวลานี้" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top pages */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
              <div className="px-6 py-4 border-b border-border/60 bg-secondary/20 flex items-center gap-2.5">
                <i className="fas fa-eye text-primary text-sm" />
                <h2 className="text-sm font-bold text-foreground tracking-tight">หน้าที่เข้าชมมากที่สุด</h2>
              </div>
              <div className="divide-y divide-border/60">
                {data.pages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">ไม่มีข้อมูล</div>
                ) : data.pages.map((p) => (
                  <Link key={p.path} href={detailLink(p.path)} className="block px-6 py-3.5 hover:bg-secondary/20 transition-colors group/row">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate tracking-tight group-hover/row:text-primary transition-colors">{PATH_LABELS[p.path] || p.path}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/70 truncate mt-0.5">{p.path}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[9px] font-bold text-primary opacity-0 group-hover/row:opacity-100 transition-opacity whitespace-nowrap">ดูล่าสุด <i className="fas fa-arrow-right text-[8px]" /></span>
                        <Badge variant="outline" className="text-[9px] font-bold border-border bg-secondary/30 rounded-lg">
                          <i className="fas fa-user mr-1 opacity-60" />{p.users}
                        </Badge>
                        <span className="text-sm font-bold text-foreground tabular-nums">{p.views.toLocaleString('th-TH')}</span>
                      </div>
                    </div>
                    <Bar value={p.views} max={maxViews} />
                  </Link>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Top features */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card">
              <div className="px-6 py-4 border-b border-border/60 bg-secondary/20 flex items-center gap-2.5">
                <i className="fas fa-hand-pointer text-primary text-sm" />
                <h2 className="text-sm font-bold text-foreground tracking-tight">ฟีเจอร์ที่ใช้มากที่สุด</h2>
              </div>
              <div className="divide-y divide-border/60">
                {data.features.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">ยังไม่มีการกดปุ่มที่ติดตาม</div>
                ) : data.features.map((f) => (
                  <Link key={f.feature} href={detailLink(f.feature)} className="block px-6 py-3.5 hover:bg-secondary/20 transition-colors group/row">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate tracking-tight group-hover/row:text-primary transition-colors">{FEATURE_LABELS[f.feature] || f.feature}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/70 truncate mt-0.5">{f.feature}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[9px] font-bold text-primary opacity-0 group-hover/row:opacity-100 transition-opacity whitespace-nowrap">ดูล่าสุด <i className="fas fa-arrow-right text-[8px]" /></span>
                        <Badge variant="outline" className="text-[9px] font-bold border-border bg-secondary/30 rounded-lg">
                          <i className="fas fa-user mr-1 opacity-60" />{f.users}
                        </Badge>
                        <span className="text-sm font-bold text-foreground tabular-nums">{f.clicks.toLocaleString('th-TH')}</span>
                      </div>
                    </div>
                    <Bar value={f.clicks} max={maxClicks} />
                  </Link>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return <Suspense fallback={<div className="p-8"><SkeletonTable rows={8} /></div>}><Content /></Suspense>;
}
