'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { PATH_LABELS, FEATURE_LABELS } from '@/lib/activityLabels';
import { Icon } from '@/components/ui/icon';

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

/** Proportion bar. Static width, no transition: it is a reading aid for
 *  ranking rows against each other, not an effect. */
function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full h-1 rounded-full bg-secondary overflow-hidden" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-card p-3.5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="admin-num text-xl font-semibold text-foreground mt-1">{value.toLocaleString('th-TH')}</p>
    </div>
  );
}

/** One ranked list. Pages and features differ only in their labels, so they
 *  share this component rather than duplicating the row markup. */
function HotspotList({
  title, rows, emptyText,
}: {
  title: string;
  rows: { key: string; label: string; raw: string; count: number; users: number }[];
  emptyText: string;
}) {
  const max = rows[0]?.count || 0;
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h3 className="admin-section-title">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="admin-meta text-center py-8">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.key}>
              <Link href={detailLink(r.raw)} className="block px-4 py-3 hover:bg-secondary">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-foreground truncate">{r.label}</span>
                    <span className="block admin-meta font-mono truncate">{r.raw}</span>
                  </span>
                  <span className="flex items-baseline gap-2.5 shrink-0">
                    <span className="admin-meta admin-num">{r.users} คน</span>
                    <span className="admin-num text-[15px] font-semibold text-foreground">
                      {r.count.toLocaleString('th-TH')}
                    </span>
                  </span>
                </div>
                <Bar value={r.count} max={max} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">พฤติกรรมการใช้งาน</h2>
          <p className="admin-sub">หน้าและฟีเจอร์ที่ลูกค้าใช้มากที่สุดในแผงควบคุม</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`admin-btn admin-btn-sm ${days === r.days ? 'admin-btn-primary' : ''}`}
            >
              {r.label}
            </button>
          ))}
          <button onClick={load} className="admin-btn admin-btn-sm" disabled={loading} aria-label="รีเฟรช">
            <Icon name="arrows-rotate" className={loading ? 'animate-spin text-[13px]' : 'text-[13px]'} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="จำนวนการเปิดหน้า" value={data?.totals.totalViews || 0} />
        <StatCard label="จำนวนการกดใช้ฟีเจอร์" value={data?.totals.totalClicks || 0} />
        <StatCard label="ผู้ใช้ที่มีการเคลื่อนไหว" value={data?.totals.activeUsers || 0} />
      </div>

      {loading ? (
        <div className="admin-card"><SkeletonTable rows={8} /></div>
      ) : !data || (data.pages.length === 0 && data.features.length === 0) ? (
        <div className="admin-card p-10">
          <EmptyState icon="fire" title="ยังไม่มีข้อมูลการใช้งาน" description="ยังไม่มีการบันทึกการเคลื่อนไหวในช่วงเวลานี้" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          <HotspotList
            title="หน้าที่เข้าชมมากที่สุด"
            emptyText="ไม่มีข้อมูล"
            rows={data.pages.map(p => ({
              key: p.path,
              label: PATH_LABELS[p.path] || p.path,
              raw: p.path,
              count: p.views,
              users: p.users,
            }))}
          />
          <HotspotList
            title="ฟีเจอร์ที่ใช้มากที่สุด"
            emptyText="ยังไม่มีการกดปุ่มที่ติดตาม"
            rows={data.features.map(f => ({
              key: f.feature,
              label: FEATURE_LABELS[f.feature] || f.feature,
              raw: f.feature,
              count: f.clicks,
              users: f.users,
            }))}
          />
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return <Suspense fallback={<div className="p-4"><SkeletonTable rows={8} /></div>}><Content /></Suspense>;
}
