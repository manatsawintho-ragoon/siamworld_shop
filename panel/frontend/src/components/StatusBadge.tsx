/* Status pill, shared by the admin tables and the customer dashboard.
 *
 * The tints are alpha values over whatever surface the badge sits on, not the
 * fixed `-50` shades this used before. A `bg-emerald-50` chip keeps its almost
 * white background when the theme flips, which is why status badges were
 * showing up as light patches on dark cards. An alpha tint picks up the card
 * behind it and stays legible in both themes.
 *
 * Every state also carries a dot or a label difference, so the meaning does not
 * rest on hue alone. */
const STATUS_MAP: Record<string, { bg: string; label: string; dot?: boolean; pulse?: boolean; dotColor?: string }> = {
  active:    { bg: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25', label: 'เปิดใช้งาน', dot: true, dotColor: 'bg-emerald-500' },
  deploying: { bg: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/25',        label: 'กำลังติดตั้ง', pulse: true, dotColor: 'bg-amber-500' },
  pending:   { bg: 'bg-blue-500/12 text-blue-700 dark:text-blue-400 border border-blue-500/25',            label: 'รอดำเนินการ', dot: true, dotColor: 'bg-blue-500' },
  suspended: { bg: 'bg-red-500/12 text-red-700 dark:text-red-400 border border-red-500/25',                label: 'ระงับการใช้งาน', dot: true, dotColor: 'bg-red-500' },
  expired:   { bg: 'bg-secondary text-muted-foreground border border-border',                              label: 'หมดอายุ' },
  cancelled: { bg: 'bg-secondary text-muted-foreground border border-border',                              label: 'ยกเลิก' },
  verified:  { bg: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25', label: 'ตรวจสอบแล้ว', dot: true, dotColor: 'bg-emerald-500' },
  rejected:  { bg: 'bg-red-500/12 text-red-700 dark:text-red-400 border border-red-500/25',                label: 'ปฏิเสธแล้ว', dot: true, dotColor: 'bg-red-500' },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] || { bg: 'bg-secondary text-muted-foreground border border-border', label: status };
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium whitespace-nowrap ${cfg.bg}`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />}
      {cfg.pulse && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.dotColor}`} />}
      {cfg.label}
    </span>
  );
}
