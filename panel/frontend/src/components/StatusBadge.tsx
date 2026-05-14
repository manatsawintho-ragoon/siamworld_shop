const STATUS_MAP: Record<string, { bg: string; label: string; dot?: boolean; pulse?: boolean; dotColor?: string }> = {
  active:    { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100', label: 'เปิดใช้งาน', dot: true, dotColor: 'bg-emerald-500' },
  deploying: { bg: 'bg-amber-50 text-amber-700 border border-amber-100', label: 'กำลังติดตั้ง', pulse: true, dotColor: 'bg-amber-500' },
  pending:   { bg: 'bg-blue-50 text-blue-700 border border-blue-100', label: 'รอดำเนินการ', dot: true, dotColor: 'bg-blue-500' },
  suspended: { bg: 'bg-red-50 text-red-700 border border-red-100', label: 'ระงับการใช้งาน', dot: true, dotColor: 'bg-red-500' },
  expired:   { bg: 'bg-gray-50 text-gray-700 border border-gray-200', label: 'หมดอายุ' },
  cancelled: { bg: 'bg-gray-50 text-gray-700 border border-gray-200', label: 'ยกเลิก' },
  verified:  { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100', label: 'ตรวจสอบแล้ว', dot: true, dotColor: 'bg-emerald-500' },
  rejected:  { bg: 'bg-red-50 text-red-700 border border-red-100', label: 'ปฏิเสธแล้ว', dot: true, dotColor: 'bg-red-500' },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] || { bg: 'bg-gray-50 text-gray-700 border border-gray-200', label: status };
  return (
    <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${cfg.bg}`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />}
      {cfg.pulse && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.dotColor}`} />}
      {cfg.label}
    </span>
  );
}
