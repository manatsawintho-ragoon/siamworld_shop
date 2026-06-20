'use client';
import { useState } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';

const LEVEL = {
  info:      { label: 'ข้อมูล',     badge: 'bg-blue-100 text-blue-700',     bar: 'bg-blue-500',   icon: 'fa-circle-info' },
  update:    { label: 'อัพเดทใหม่', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', icon: 'fa-rocket' },
  important: { label: 'สำคัญ',      badge: 'bg-red-100 text-red-700',       bar: 'bg-red-500',    icon: 'fa-triangle-exclamation' },
} as const;

/**
 * Shows operator announcements as a popup in the shop admin. Newest first; one at
 * a time. Closing with "ไม่แสดงอีก" ticked persists the dismissal for this admin
 * (server); closing without it just snoozes for the current session.
 */
export default function AnnouncementPopup() {
  const { announcements, dismiss } = useAnnouncements();
  const [snoozed, setSnoozed] = useState<Set<number>>(new Set());
  const [dontShow, setDontShow] = useState(false);

  const current = announcements.find(a => !snoozed.has(a.id));
  if (!current) return null;
  const lv = LEVEL[current.level] || LEVEL.update;

  const close = async () => {
    if (dontShow) await dismiss(current.id);
    setSnoozed(prev => new Set(prev).add(current.id));
    setDontShow(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={close}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className={`h-1.5 ${lv.bar}`} />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${lv.badge}`}>
              <i className={`fas ${lv.icon} text-[10px]`} /> {lv.label}
            </span>
            {current.published_at && (
              <span className="text-[11px] text-gray-400">
                {new Date(current.published_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-gray-800 mb-2">{current.title}</h2>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed max-h-[50vh] overflow-y-auto">{current.body}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} className="w-4 h-4 rounded accent-[#f97316]" />
              ไม่แสดงอีก
            </label>
            <button onClick={close}
              className="px-5 py-2 bg-[#1e2735] text-white rounded-lg text-sm font-bold shadow-[0_4px_0_#38404d] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_1px_0_#38404d] transition-all">
              รับทราบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
