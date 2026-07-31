'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import { HardDrive, RefreshCw, Trash2, Package, Archive, Download } from 'lucide-react';

interface OrphanImage { repository: string; sizeBytes: number; }
interface ShopRow { shopName: string; status: string; volumeBytes: number; }
interface Report {
  disk: { totalBytes: number; usedBytes: number; availBytes: number; usedPercent: number };
  docker: { imagesBytes: number; volumesBytes: number; buildCacheBytes: number; reclaimableBytes: number };
  archivesBytes: number;
  orphanImages: OrphanImage[];
  shops: ShopRow[];
  level: 'ok' | 'warn' | 'critical';
  generatedAt: string;
}
interface ArchiveRow {
  shop_name: string; domain: string; file_name: string;
  size_bytes: number; reason: string; created_at: string; expires_at: string;
}

/** Bytes are reported by docker/df in wildly different magnitudes; one formatter keeps
 *  the columns readable instead of mixing "938000000" with "1.2GB". */
function fmtBytes(n: number): string {
  if (!n) return '0';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log10(n) / 3), units.length - 1);
  const v = n / Math.pow(1000, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const LEVEL_TEXT: Record<Report['level'], string> = {
  ok: 'ปกติ',
  warn: 'ควรเฝ้าระวัง',
  critical: 'ต้องจัดการ',
};

/** Usage bar. Colour is carried by an adjacent text label too, so the state is not
 *  communicated by hue alone. */
function DiskBar({ pct, level }: { pct: number; level: Report['level'] }) {
  const tone =
    level === 'critical' ? 'bg-destructive'
    : level === 'warn' ? 'bg-amber-500'
    : 'bg-primary';
  return (
    <div
      className="w-full h-2 rounded-full bg-secondary overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`พื้นที่ดิสก์ที่ใช้ไป ${pct}%`}
    >
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-card p-3.5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="admin-num text-xl font-semibold text-foreground mt-1">{value}</p>
      {hint && <p className="text-[12px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function AdminStoragePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [r, a] = await Promise.all([
        api.get(`/admin/storage${refresh ? '?refresh=1' : ''}`),
        api.get('/admin/archives'),
      ]);
      setReport(r.data.data);
      setArchives(a.data.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const prune = async () => {
    setPruning(true);
    setNotice('');
    try {
      const res = await api.post('/admin/archives/prune');
      const { rows, orphanFiles } = res.data.data ?? {};
      setNotice(`ลบไฟล์สำรองที่หมดอายุ ${rows ?? 0} รายการ และไฟล์ตกค้าง ${orphanFiles ?? 0} ไฟล์`);
      await load(true);
    } finally {
      setPruning(false);
    }
  };

  if (loading) return <SkeletonTable rows={6} />;
  if (!report) return null;

  const orphanBytes = report.orphanImages.reduce((n, i) => n + i.sizeBytes, 0);

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="w-4 h-4" aria-hidden="true" />
            พื้นที่จัดเก็บข้อมูล
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            อัพเดทล่าสุด {new Date(report.generatedAt).toLocaleString('th-TH')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="admin-btn inline-flex items-center gap-1.5 text-[13px] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'กำลังอ่านค่า' : 'อ่านค่าใหม่'}
        </button>
      </div>

      {/* Disk headline */}
      <div className="admin-card p-4 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="admin-num text-2xl font-semibold text-foreground">
            {report.disk.usedPercent}%
            <span className="text-[13px] font-normal text-muted-foreground ms-2">
              ({fmtBytes(report.disk.usedBytes)} จาก {fmtBytes(report.disk.totalBytes)})
            </span>
          </p>
          <p className={`text-[13px] font-medium ${
            report.level === 'critical' ? 'text-destructive'
            : report.level === 'warn' ? 'text-amber-600 dark:text-amber-500'
            : 'text-muted-foreground'
          }`}>
            {LEVEL_TEXT[report.level]}
          </p>
        </div>
        <DiskBar pct={report.disk.usedPercent} level={report.level} />
        <p className="text-[13px] text-muted-foreground">
          เหลือพื้นที่ว่าง {fmtBytes(report.disk.availBytes)}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="อิมเมจ" value={fmtBytes(report.docker.imagesBytes)} />
        <StatCard label="ข้อมูลร้านค้า" value={fmtBytes(report.docker.volumesBytes)} />
        <StatCard label="แคชการ build" value={fmtBytes(report.docker.buildCacheBytes)} />
        <StatCard label="ไฟล์สำรองข้อมูล" value={fmtBytes(report.archivesBytes)} hint={`${archives.length} รายการ`} />
      </div>

      {/* Orphans: the leak that filled the disk, called out rather than buried. */}
      <section className="admin-card">
        <div className="admin-card-head flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <Package className="w-3.5 h-3.5" aria-hidden="true" />
            อิมเมจที่ไม่มีร้านค้าใช้งาน
          </h2>
          {report.orphanImages.length > 0 && (
            <span className="admin-num text-[13px] text-destructive font-medium">
              {report.orphanImages.length} รายการ / {fmtBytes(orphanBytes)}
            </span>
          )}
        </div>
        <div className="admin-card-body">
          {report.orphanImages.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              ไม่มีอิมเมจตกค้าง ระบบจะลบให้อัตโนมัติเมื่อปิดร้าน และมีตัวตรวจซ้ำรายสัปดาห์
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {report.orphanImages.map(img => (
                  <li key={img.repository} className="flex items-center justify-between py-1.5 text-[13px]">
                    <span className="text-foreground truncate">{img.repository}</span>
                    <span className="admin-num text-muted-foreground shrink-0 ms-3">{fmtBytes(img.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-muted-foreground mt-2.5">
                ลบได้ด้วยคำสั่ง <code className="admin-num">deploy/sw-gc.sh --apply</code> บนเซิร์ฟเวอร์
              </p>
            </>
          )}
        </div>
      </section>

      {/* Per-shop footprint */}
      <section className="admin-card">
        <div className="admin-card-head">
          <h2 className="text-[14px] font-semibold text-foreground">พื้นที่ต่อร้านค้า</h2>
        </div>
        <div className="admin-card-body overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-muted-foreground text-start">
                <th className="text-start font-medium pb-2">ร้านค้า</th>
                <th className="text-start font-medium pb-2">สถานะ</th>
                <th className="text-end font-medium pb-2">ขนาด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.shops.map(s => (
                <tr key={s.shopName}>
                  <td className="py-1.5 text-foreground">{s.shopName}</td>
                  <td className="py-1.5 text-muted-foreground">{s.status}</td>
                  <td className="py-1.5 text-end admin-num text-muted-foreground">{fmtBytes(s.volumeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Archives */}
      <section className="admin-card">
        <div className="admin-card-head flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
            ไฟล์สำรองข้อมูลก่อนปิดร้าน
          </h2>
          <button
            type="button"
            onClick={prune}
            disabled={pruning}
            className="admin-btn inline-flex items-center gap-1.5 text-[13px] disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            {pruning ? 'กำลังลบ' : 'ลบไฟล์ที่หมดอายุ'}
          </button>
        </div>
        <div className="admin-card-body">
          {notice && <p className="text-[13px] text-foreground mb-2">{notice}</p>}
          {archives.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              ยังไม่มีไฟล์สำรอง ระบบจะสำรองข้อมูลอัตโนมัติก่อนลบร้านค้าทุกครั้ง
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {archives.map(a => (
                <li key={a.file_name} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <div className="min-w-0">
                    <p className="text-foreground truncate">{a.shop_name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      สร้าง {new Date(a.created_at).toLocaleDateString('th-TH')} :
                      หมดอายุ {new Date(a.expires_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="admin-num text-muted-foreground">{fmtBytes(a.size_bytes)}</span>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}/admin/archives/${a.file_name}/download`}
                      className="admin-btn inline-flex items-center gap-1 text-[13px]"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      ดาวน์โหลด
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  );
}
