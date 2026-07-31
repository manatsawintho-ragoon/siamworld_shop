/** Formatting shared by the traffic overview and the per-shop drill-down. */

/**
 * Decimal units, matching how `docker system df` and the storage page report
 * size, so the two admin pages do not disagree about what "GB" means.
 */
export function fmtBytes(n: number): string {
  if (!n) return '0';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log10(n) / 3), units.length - 1);
  const v = n / Math.pow(1000, i);
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString('th-TH');
}

/** Compact form for axis ticks, where a full thousands-separated number is too wide. */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Buckets arrive as Bangkok wall-clock strings ("2026-08-01 14:00:00") and are
 * rendered as-is. Passing them through Date would re-interpret them in the
 * browser's zone and shift every label for anyone not sitting in Thailand.
 */
export function bucketLabel(bucket: string, granularity: 'hour' | 'day'): string {
  const [date, time] = bucket.split(' ');
  const [, m, d] = date.split('-');
  if (granularity === 'day') return `${d}/${m}`;
  return `${d}/${m} ${time?.slice(0, 5) ?? ''}`;
}

export function dayLabel(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

export const STATUS_LABELS: Record<string, string> = {
  active: 'ใช้งาน',
  suspended: 'ระงับ',
  pending: 'รอดำเนินการ',
  deploying: 'กำลังติดตั้ง',
  expired: 'หมดอายุ',
  cancelled: 'ยกเลิก',
};
