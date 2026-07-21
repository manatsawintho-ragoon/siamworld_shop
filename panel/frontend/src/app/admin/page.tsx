'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { SkeletonStat } from '@/components/SkeletonLoader';
import AdminChart from '@/components/AdminCharts';
import { Icon } from '@/components/ui/icon';

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

/* One stat, stated plainly: label, number, one line of context. The number is
   the largest thing in the tile because it is the thing being looked up. */
function StatCard({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className={`admin-card h-full p-4 ${href ? 'hover:border-primary' : ''}`}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="admin-num text-2xl font-semibold text-foreground mt-1.5">{value}</p>
      {hint && <p className="text-[13px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <SkeletonStat /> <SkeletonStat /> <SkeletonStat /> <SkeletonStat />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">ภาพรวมระบบ</h2>
          <p className="admin-sub">สรุปสถานะร้านค้า รายได้ และงานที่ต้องตรวจสอบ</p>
        </div>
        <button onClick={load} className="admin-btn">
          <Icon name="arrows-rotate" className="text-[13px]" /> รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="ร้านค้าที่ใช้งานอยู่"
          value={stats?.active_shops ?? 0}
          hint="ร้านที่ยังไม่หมดอายุ"
          href="/admin/customers?status=active"
        />
        <StatCard
          label="รายได้ 30 วันล่าสุด"
          value={fmtBaht(stats?.revenue_30d ?? 0)}
          hint="ยอดชำระที่ยืนยันแล้ว"
          href="/admin/payments"
        />
        <StatCard
          label="ผู้ใช้งานทั้งหมด"
          value={stats?.total_users ?? 0}
          hint="บัญชีที่สมัครในระบบ"
          href="/admin/users"
        />
        <StatCard
          label="สลิปรอตรวจสอบ"
          value={stats?.pending_slips ?? 0}
          hint={stats?.pending_slips ? 'ต้องตรวจสอบ' : 'ตรวจครบแล้ว'}
          href="/admin/payments?status=pending"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-section-title">รายได้รายวัน</h3>
            <span className="admin-meta">30 วันล่าสุด</span>
          </div>
          <div className="p-2 sm:p-3">
            <AdminChart data={charts.revenue} type="revenue" />
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-section-title">ผู้ใช้งานใหม่</h3>
            <span className="admin-meta">30 วันล่าสุด</span>
          </div>
          <div className="p-2 sm:p-3">
            <AdminChart data={charts.growth} type="growth" />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
        <section className="admin-card xl:col-span-2">
          <div className="admin-card-head">
            <h3 className="admin-section-title">ร้านค้าที่ติดตั้งล่าสุด</h3>
            <Link href="/admin/customers" className="admin-meta hover:text-primary">ดูทั้งหมด</Link>
          </div>
          <div className="p-3 md:p-0">
            {subs.length === 0 ? (
              <p className="admin-meta py-8 text-center">ยังไม่มีร้านค้า</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ร้านค้า</th>
                    <th>สถานะ</th>
                    <th className="text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.slice(0, 8).map(sub => (
                    <tr key={sub.id}>
                      <td data-label="ร้านค้า">
                        <span className="block font-medium text-foreground">{sub.shop_name}</span>
                        <span className="block admin-meta break-all">{sub.domain}</span>
                      </td>
                      <td data-label="สถานะ"><StatusBadge status={sub.status} /></td>
                      <td data-label="" className="md:text-right">
                        <Link href={`/admin/customers?search=${sub.domain}`} className="admin-btn admin-btn-sm">
                          จัดการ
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-section-title">สลิปรอตรวจสอบ</h3>
            {slips.length > 0 && <span className="admin-chip">{slips.length} รายการ</span>}
          </div>
          <div className="admin-card-body space-y-2">
            {slips.length === 0 ? (
              <p className="admin-meta py-6 text-center">ไม่มีสลิปค้างตรวจสอบ</p>
            ) : (
              <>
                {slips.map(slip => (
                  <Link
                    key={slip.id}
                    href="/admin/payments?status=pending"
                    className="flex items-center justify-between gap-3 p-3 border border-border rounded-md hover:border-primary"
                  >
                    <span className="min-w-0">
                      <span className="block admin-num font-medium text-foreground">{fmtBaht(slip.amount)}</span>
                      <span className="block admin-meta truncate">{slip.display_name}</span>
                    </span>
                    <Icon name="chevron-right" className="text-muted-foreground text-xs shrink-0" />
                  </Link>
                ))}
                <Link href="/admin/payments?status=pending" className="admin-btn w-full">
                  ตรวจสอบทั้งหมด
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
