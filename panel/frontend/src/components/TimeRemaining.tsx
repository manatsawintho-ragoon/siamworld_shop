import { useMemo, useState, useEffect } from 'react';

interface Props {
  date: string;
  className?: string;
  showExactDate?: boolean;
}

export default function TimeRemaining({ date, className = '', showExactDate = true }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { text, isExpiringSoon, isExpired, exactDate } = useMemo(() => {
    const dDate = new Date(date);
    const exactDate = dDate.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const total = dDate.getTime() - now;
    
    if (total <= 0) return { text: 'หมดอายุแล้ว', isExpiringSoon: true, isExpired: true, exactDate };
    
    const d = Math.floor(total / 86400000);
    const h = Math.floor((total / 3600000) % 24);
    const m = Math.floor((total / 60000) % 60);
    const s = Math.floor((total / 1000) % 60);
    let str = '';
    if (d > 0) {
      str += `${d} วัน ${h} ชม. ${m} นาที`;
    } else if (h > 0) {
      str += `${h} ชม. ${m} นาที`;
    } else if (m > 0) {
      str += `${m} นาที ${s} วิ`;
    } else {
      str += `${s} วิ`;
    }
    
    return { text: str.trim(), isExpiringSoon: d < 7, isExpired: false, exactDate };
  }, [date, now]);

  const colorClass = isExpired
    ? 'text-gray-400 dark:text-slate-500'
    : isExpiringSoon
    ? 'text-red-500 dark:text-red-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`flex flex-col ${className}`}>
      <div className={`flex items-center gap-1.5 text-xs font-bold ${colorClass}`}>
        <i className="fas fa-clock text-[10px] opacity-70" />
        <span className="font-semibold">{isExpired ? 'หมดอายุแล้ว' : text}</span>
      </div>
      {showExactDate && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">
          ({exactDate})
        </p>
      )}
    </div>
  );
}
