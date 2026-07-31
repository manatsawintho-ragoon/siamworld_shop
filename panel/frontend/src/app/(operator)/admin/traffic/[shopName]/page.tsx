'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { Icon } from '@/components/ui/icon';
import { fmtBytes, fmtNum, fmtCompact, pct, bucketLabel, STATUS_LABELS } from '@/lib/trafficFormat';

interface Bucket {
  bucket: string;
  requests: number;
  bytesSent: number;
  s2xx: number; s3xx: number; s4xx: number; s5xx: number;
  botRequests: number;
}
interface PathRow { value: string; requests: number; bytesSent: number; s4xx: number; s5xx: number; }
interface RefRow { value: string; requests: number; }
interface Detail {
  shopName: string;
  domain: string | null;
  status: string | null;
  removed: boolean;
  days: number;
  series: Bucket[];
  totals: Omit<Bucket, 'bucket'>;
  peak: { bucket: string; requests: number } | null;
  topPaths: PathRow[];
  topReferrers: RefRow[];
  generatedAt: string;
}

const RANGES = [
  { days: 1, label: '24 ชม.' },
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
];

const AXIS_TICK = { fontSize: 10, fontWeight: 700, fill: '#94a3b8' } as const;
const TOOLTIP_STYLE = {
  borderRadius: '16px',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
  fontSize: '12px',
  fontWeight: 800,
} as const;

/** Above one day of data, hourly points are unreadable, so roll up to days. */
function rollToDays(series: Bucket[]): Bucket[] {
  const byDay = new Map<string, Bucket>();
  for (const b of series) {
    const day = b.bucket.split(' ')[0];
    const cur = byDay.get(day) ?? {
      bucket: `${day} 00:00:00`,
      requests: 0, bytesSent: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, botRequests: 0,
    };
    cur.requests += b.requests;
    cur.bytesSent += b.bytesSent;
    cur.s2xx += b.s2xx; cur.s3xx += b.s3xx; cur.s4xx += b.s4xx; cur.s5xx += b.s5xx;
    cur.botRequests += b.botRequests;
    byDay.set(day, cur);
  }
  return Array.from(byDay.values());
}

function StatCard({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-amber-500' : 'text-foreground';
  return (
    <div className="admin-card p-3.5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`admin-num text-xl font-semibold mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="admin-meta mt-0.5">{hint}</p>}
    </div>
  );
}

export default function TrafficDetailPage() {
  const params = useParams();
  const shopName = String(params.shopName);

  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState<'hour' | 'day'>('day');
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/admin/traffic/${shopName}?days=${days}`);
      // See the overview page: a missing /api prefix resolves to this very page
      // as HTML, so an unexpected shape must surface as an error rather than as
      // an empty chart.
      if (!res.data?.data?.series) throw new Error('รูปแบบข้อมูลจาก API ไม่ถูกต้อง');
      setData(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [shopName, days]);

  useEffect(() => { load(); }, [load]);

  // A 24h window only ever has hourly detail worth showing.
  useEffect(() => { setGranularity(days === 1 ? 'hour' : 'day'); }, [days]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const src = granularity === 'day' ? rollToDays(data.series) : data.series;
    return src.map(b => ({ ...b, label: bucketLabel(b.bucket, granularity) }));
  }, [data, granularity]);

  const t = data?.totals;
  const errRate = t ? pct(t.s5xx, t.requests) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/traffic" className="admin-meta inline-flex items-center gap-1 hover:text-foreground">
            <Icon name="arrow-left" className="w-3 h-3" aria-hidden="true" />
            กลับไปภาพรวมทราฟฟิก
          </Link>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2 mt-1">
            <Icon name="chart-area" className="w-4 h-4" aria-hidden="true" />
            {shopName}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {data?.domain ?? 'ไม่มีโดเมน'}
            {data?.removed
              ? ' : ลบแล้ว (เก็บสถิติย้อนหลังไว้)'
              : data?.status && data.status !== 'active'
                ? ` : ${STATUS_LABELS[data.status] ?? data.status}`
                : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden" role="group" aria-label="ช่วงเวลา">
            {RANGES.map(r => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                aria-pressed={days === r.days}
                className={`px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  days === r.days ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {days > 1 && (
            <button
              type="button"
              onClick={() => setGranularity(g => (g === 'day' ? 'hour' : 'day'))}
              className="admin-btn text-[13px]"
            >
              {granularity === 'day' ? 'รายวัน' : 'รายชั่วโมง'}
            </button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <SkeletonTable />
      ) : error ? (
        <div className="admin-card p-6 text-center">
          <p className="text-[14px] text-destructive">{error}</p>
          <button type="button" onClick={load} className="admin-btn mt-3 text-[13px]">ลองอีกครั้ง</button>
        </div>
      ) : !data || data.series.length === 0 ? (
        <EmptyState
          icon="chart-area"
          title="ยังไม่มีข้อมูลในช่วงนี้"
          description="ลองขยายช่วงเวลา หรือรอรอบเก็บข้อมูลถัดไป"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="คำขอทั้งหมด" value={fmtNum(t!.requests)} />
            <StatCard label="ข้อมูลส่งออก" value={fmtBytes(t!.bytesSent)} />
            <StatCard
              label="ข้อผิดพลาด 5xx"
              value={`${errRate}%`}
              hint={`${fmtNum(t!.s5xx)} คำขอ`}
              tone={errRate >= 5 ? 'bad' : errRate >= 1 ? 'warn' : undefined}
            />
            <StatCard
              label="ช่วงที่มีคนใช้มากที่สุด"
              value={data.peak ? fmtNum(data.peak.requests) : '0'}
              hint={data.peak ? bucketLabel(data.peak.bucket, 'hour') : undefined}
            />
          </div>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2 className="admin-section-title">คำขอตามช่วงเวลา</h2>
            </div>
            <div className="h-64 w-full p-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="trafficReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} minTickGap={24} />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={fmtCompact} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: any) => [fmtNum(Number(v)), 'คำขอ']}
                  />
                  <Area
                    type="monotone" dataKey="requests" stroke="#3b82f6"
                    strokeWidth={2.5} fillOpacity={1} fill="url(#trafficReq)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-card-head">
              <h2 className="admin-section-title">สัดส่วนสถานะการตอบกลับ</h2>
            </div>
            <div className="h-56 w-full p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} minTickGap={24} />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={fmtCompact} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => fmtNum(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Bar dataKey="s2xx" name="สำเร็จ" stackId="s" fill="#22c55e" />
                  <Bar dataKey="s3xx" name="เปลี่ยนเส้นทาง" stackId="s" fill="#94a3b8" />
                  <Bar dataKey="s4xx" name="ไม่พบ/ปฏิเสธ" stackId="s" fill="#f59e0b" />
                  <Bar dataKey="s5xx" name="ผิดพลาด" stackId="s" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="admin-card overflow-hidden">
              <div className="admin-card-head">
                <h2 className="admin-section-title">หน้าที่ถูกเรียกมากที่สุด</h2>
              </div>
              {data.topPaths.length === 0 ? (
                <p className="admin-meta text-center py-8">ยังไม่มีข้อมูล</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">เส้นทาง</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">คำขอ</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">ส่งออก</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">ผิดพลาด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.topPaths.map(p => (
                        <tr key={p.value} className="hover:bg-secondary">
                          <td className="px-3 py-2 font-mono text-[12px] text-foreground max-w-[240px] truncate" title={p.value}>
                            {p.value}
                          </td>
                          <td className="px-3 py-2 text-right admin-num">{fmtNum(p.requests)}</td>
                          <td className="px-3 py-2 text-right admin-num">{fmtBytes(p.bytesSent)}</td>
                          <td className="px-3 py-2 text-right admin-num">
                            {p.s5xx > 0 ? (
                              <span className="text-destructive font-semibold">{fmtNum(p.s5xx)}</span>
                            ) : p.s4xx > 0 ? (
                              <span className="text-amber-500">{fmtNum(p.s4xx)}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="admin-card overflow-hidden">
              <div className="admin-card-head">
                <h2 className="admin-section-title">ที่มาของผู้เข้าชม</h2>
              </div>
              {data.topReferrers.length === 0 ? (
                <p className="admin-meta text-center py-8">ยังไม่มีข้อมูล</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.topReferrers.map(r => (
                    <li key={r.value} className="px-3 py-2 flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-foreground truncate">{r.value}</span>
                      <span className="admin-num text-[13px] shrink-0">{fmtNum(r.requests)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className="admin-meta">
            บอท {pct(t!.botRequests, t!.requests)}% ของคำขอทั้งหมด ({fmtNum(t!.botRequests)} คำขอ)
            อัพเดทล่าสุด {new Date(data.generatedAt).toLocaleString('th-TH')}
          </p>
        </>
      )}
    </div>
  );
}
