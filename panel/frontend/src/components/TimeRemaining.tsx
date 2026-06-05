import { useMemo, useState, useEffect } from 'react';

interface Props {
  date: string;
  /** Grace deadline — when the shop is actually suspended (expires_at + grace days). */
  suspendAt?: string | null;
  /** True once the shop has already been suspended (containers stopped, data kept). */
  suspended?: boolean;
  className?: string;
  showExactDate?: boolean;
}

/** Format milliseconds into a compact Thai "X วัน Y ชม. Z นาที" string. */
function fmtDuration(ms: number): string {
  const total = Math.max(0, ms);
  const d = Math.floor(total / 86400000);
  const h = Math.floor((total / 3600000) % 24);
  const m = Math.floor((total / 60000) % 60);
  const s = Math.floor((total / 1000) % 60);
  if (d > 0) return `${d} วัน ${h} ชม. ${m} นาที`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  if (m > 0) return `${m} นาที ${s} วิ`;
  return `${s} วิ`;
}

export default function TimeRemaining({ date, suspendAt = null, suspended = false, className = '', showExactDate = true }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const view = useMemo(() => {
    const dDate = new Date(date);
    const exactDate = dDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const total = dDate.getTime() - now;

    // Already suspended → reassure that data is kept and renewal restores it.
    if (suspended) {
      return {
        phase: 'suspended' as const,
        text: 'ระบบถูกปิดแล้ว',
        sub: 'ข้อมูลของคุณถูกเก็บไว้ครบ ต่ออายุเพื่อกลับมาใช้งานได้ทันที',
        exactDate,
      };
    }

    // Past expiry but still within the grace window → overdue counter + shutdown countdown.
    if (total <= 0) {
      const suspendMs = suspendAt ? new Date(suspendAt).getTime() - now : null;
      if (suspendMs !== null && suspendMs > 0) {
        return {
          phase: 'grace' as const,
          text: `หมดอายุแล้ว · เกินมา ${fmtDuration(-total)}`,
          sub: `ระบบจะปิดใน ${fmtDuration(suspendMs)} ต่ออายุก่อนเพื่อไม่ให้ร้านถูกปิด (ข้อมูลยังอยู่ครบ)`,
          exactDate,
        };
      }
      // Grace elapsed but cron hasn't suspended yet (runs hourly).
      return {
        phase: 'grace' as const,
        text: `หมดอายุแล้ว · เกินมา ${fmtDuration(-total)}`,
        sub: 'กำลังจะปิดระบบ ต่ออายุเพื่อใช้งานต่อ (ข้อมูลยังอยู่ครบ)',
        exactDate,
      };
    }

    // Still active.
    const d = Math.floor(total / 86400000);
    return { phase: 'active' as const, text: fmtDuration(total), sub: '', isExpiringSoon: d < 7, exactDate };
  }, [date, suspendAt, suspended, now]);

  const colorClass =
    view.phase === 'suspended' ? 'text-gray-500 dark:text-slate-400'
    : view.phase === 'grace' ? 'text-red-600 dark:text-red-400'
    : (view as { isExpiringSoon?: boolean }).isExpiringSoon ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const icon = view.phase === 'suspended' ? 'fa-circle-pause'
    : view.phase === 'grace' ? 'fa-triangle-exclamation'
    : 'fa-clock';

  return (
    <div className={`flex flex-col ${className}`}>
      <div className={`flex items-center gap-1.5 text-xs font-bold ${colorClass}`}>
        <i className={`fas ${icon} text-[10px] opacity-70`} />
        <span className="font-semibold">{view.text}</span>
      </div>
      {view.sub && (
        <p className={`text-[10px] font-semibold mt-0.5 leading-snug ${view.phase === 'grace' ? 'text-red-500/90 dark:text-red-400/80' : 'text-gray-400 dark:text-slate-500'}`}>
          {view.sub}
        </p>
      )}
      {showExactDate && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">
          ({view.exactDate})
        </p>
      )}
    </div>
  );
}
