'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import Sparkline from '@/components/Sparkline';
import { Icon } from '@/components/ui/icon';
import { fmtBytes, fmtNum, pct, STATUS_LABELS } from '@/lib/trafficFormat';

interface ShopRow {
  shopName: string;
  domain: string | null;
  status: string | null;
  requests: number;
  bytesSent: number;
  s4xx: number;
  s5xx: number;
  botRequests: number;
  series: { day: string; requests: number }[];
}
interface Overview {
  days: number;
  shops: ShopRow[];
  totals: { requests: number; bytesSent: number; s4xx: number; s5xx: number; botRequests: number };
  generatedAt: string;
}

const RANGES = [
  { days: 1, label: '24 ชม.' },
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
];

type SortKey = 'requests' | 'bytesSent' | 's5xx' | 's4xx' | 'botRequests' | 'shopName';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'shopName', label: 'ร้านค้า', numeric: false },
  { key: 'requests', label: 'คำขอ', numeric: true },
  { key: 'bytesSent', label: 'ส่งออก', numeric: true },
  { key: 's4xx', label: '4xx', numeric: true },
  { key: 's5xx', label: '5xx', numeric: true },
  { key: 'botRequests', label: 'บอท', numeric: true },
];

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

export default function TrafficPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'requests', dir: 'desc' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/admin/traffic/overview?days=${days}`);
      setData(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.shops].sort((a, b) => {
      if (sort.key === 'shopName') return a.shopName.localeCompare(b.shopName);
      return (b[sort.key] as number) - (a[sort.key] as number);
    });
    return sort.dir === 'desc' ? sorted : sorted.reverse();
  }, [data, sort]);

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

  const t = data?.totals;
  const errRate = t ? pct(t.s5xx, t.requests) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Icon name="chart-area" className="w-4 h-4" aria-hidden="true" />
            ปริมาณทราฟฟิกร้านค้า
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            นับจาก access log ของ proxy แต่ละร้าน อัพเดททุก 10 นาที
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden" role="group" aria-label="ช่วงเวลา">
            {RANGES.map(r => (
              <button
                key={r.days}
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
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="admin-btn inline-flex items-center gap-1.5 text-[13px] disabled:opacity-60"
          >
            <Icon name="arrows-rotate" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            โหลดใหม่
          </button>
        </div>
      </div>

      {/* What these numbers are, and are not. A traffic figure that quietly means
          something other than what it says is worse than no figure at all. */}
      <div className="admin-card p-3 flex gap-2.5 items-start">
        <Icon name="circle-info" className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          ตัวเลขนี้คือภาระที่มาถึงเซิร์ฟเวอร์จริง คำขอที่ Cloudflare ตอบจากแคชแล้วจะไม่ถูกนับ
          และ &quot;ส่งออก&quot; นับเฉพาะข้อมูลขาออก ไม่รวมไฟล์ที่ผู้ใช้อัพโหลดเข้ามา
          ทั้งนี้ยังไม่สามารถนับผู้เข้าชมรายคนได้ เพราะ IP ที่บันทึกเป็นของ Cloudflare
        </p>
      </div>

      {loading && !data ? (
        <SkeletonTable />
      ) : error ? (
        <div className="admin-card p-6 text-center">
          <p className="text-[14px] text-destructive">{error}</p>
          <button type="button" onClick={load} className="admin-btn mt-3 text-[13px]">ลองอีกครั้ง</button>
        </div>
      ) : !data || data.shops.length === 0 ? (
        <EmptyState
          icon="chart-area"
          title="ยังไม่มีข้อมูลทราฟฟิก"
          description="ระบบจะเริ่มเก็บข้อมูลภายใน 10 นาทีหลังติดตั้ง หากผ่านไปนานแล้วให้ตรวจสอบว่า panel-backend mount โวลุ่ม npm_data แล้วหรือยัง"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="คำขอทั้งหมด" value={fmtNum(t!.requests)} hint={`${data.shops.length} ร้าน`} />
            <StatCard label="ข้อมูลส่งออก" value={fmtBytes(t!.bytesSent)} />
            <StatCard
              label="อัตราข้อผิดพลาด 5xx"
              value={`${errRate}%`}
              hint={`${fmtNum(t!.s5xx)} คำขอ`}
              tone={errRate >= 5 ? 'bad' : errRate >= 1 ? 'warn' : undefined}
            />
            <StatCard
              label="สัดส่วนบอท"
              value={`${pct(t!.botRequests, t!.requests)}%`}
              hint={`${fmtNum(t!.botRequests)} คำขอ`}
            />
          </div>

          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    {COLUMNS.map(c => (
                      <th
                        key={c.key}
                        scope="col"
                        className={`px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap ${
                          c.numeric ? 'text-right' : 'text-left'
                        }`}
                      >
                        <button
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {c.label}
                          {sort.key === c.key && (
                            <Icon
                              name={sort.dir === 'desc' ? 'arrow-down' : 'arrow-up'}
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 text-right font-medium text-muted-foreground">แนวโน้ม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(s => {
                    const err = pct(s.s5xx, s.requests);
                    return (
                      <tr key={s.shopName} className="hover:bg-secondary">
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/traffic/${s.shopName}`} className="block min-w-0">
                            <span className="block font-medium text-foreground truncate">{s.shopName}</span>
                            <span className="block admin-meta truncate">
                              {s.domain ?? 'ไม่มีโดเมน'}
                              {s.status === null
                                ? ' : ลบแล้ว'
                                : s.status !== 'active'
                                  ? ` : ${STATUS_LABELS[s.status] ?? s.status}`
                                  : ''}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right admin-num font-semibold text-foreground">
                          {fmtNum(s.requests)}
                        </td>
                        <td className="px-3 py-2.5 text-right admin-num">{fmtBytes(s.bytesSent)}</td>
                        <td className="px-3 py-2.5 text-right admin-num">{fmtNum(s.s4xx)}</td>
                        <td className={`px-3 py-2.5 text-right admin-num ${err >= 5 ? 'text-destructive font-semibold' : ''}`}>
                          {fmtNum(s.s5xx)}
                          {err >= 1 && <span className="admin-meta ml-1">({err}%)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right admin-num">{pct(s.botRequests, s.requests)}%</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end">
                            <Sparkline points={s.series.map(p => p.requests)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
