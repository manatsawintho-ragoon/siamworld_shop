'use client';

import { useId, useRef, useState } from 'react';
import { PickerSurface } from './PickerSurface';
import { TimeSpinner } from './TimeSpinner';
import { normalizeTimeString, minutesToTime, timeToMinutes } from './thaiDate';

interface Props {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const QUICK = ['00:00', '06:00', '09:00', '12:00', '18:00', '20:00', '22:00'];

/**
 * Bare HH:MM control, for the campaign daily window.
 *
 * NO timezone conversion. `daily_start_time` is documented in
 * campaign.logic.ts as Bangkok wall clock and evaluated there against a fixed
 * BANGKOK_OFFSET_MIN, ignoring both the server's and the browser's zone -
 * whereas starts_at / ends_at on the same form are real instants rendered in
 * browser-local time. Two different time semantics inches apart, so the caller
 * labels this one "(เวลาไทย)".
 *
 * Values arrive as 'HH:MM:SS' from the MySQL TIME column, so everything is
 * normalised on the way in; a strict HH:MM parser would render every existing
 * daily window as empty.
 */
export function TimeField({ value, onChange, disabled, className = '', ...aria }: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const uid = useId();

  const norm = normalizeTimeString(value);
  const mins = timeToMinutes(norm);
  const hour = mins === null ? 0 : Math.floor(mins / 60);
  const minute = mins === null ? 0 : mins % 60;

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  return (
    <div className={className}>
      <button
        ref={el => { triggerRef.current = el; setAnchor(el); }}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={aria['aria-label']}
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm transition-colors focus:border-[#637469] focus:outline-none focus:ring-2 focus:ring-[#637469]/20 disabled:cursor-not-allowed disabled:bg-gray-50"
      >
        <i className="fas fa-clock flex-shrink-0 text-[11px] text-gray-400" />
        <span className={`flex-1 tabular-nums ${norm ? 'text-gray-800' : 'text-gray-400'}`}>
          {norm || '--:--'}
        </span>
      </button>

      <PickerSurface anchor={anchor} open={open && !disabled} onClose={close} labelledBy={`${uid}-t`}>
        <div className="w-[248px] max-w-full">
          <div id={`${uid}-t`} className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-[12px] font-bold text-gray-700">เลือกเวลา</p>
            <button type="button" onClick={close} aria-label="ปิด"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <i className="fas fa-times text-[11px]" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1 px-3 py-2">
            {QUICK.map(q => (
              <button
                key={q} type="button"
                onClick={() => { onChange(q); setOpen(false); triggerRef.current?.focus(); }}
                className={`rounded-lg px-2 py-1 text-[10.5px] font-semibold tabular-nums transition-colors ${
                  q === norm ? 'bg-[#637469] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          <TimeSpinner
            hour={hour}
            minute={minute}
            onChange={(h, m) => onChange(minutesToTime(h * 60 + m))}
          />

          <div className="flex justify-end border-t border-gray-100 px-3 py-2">
            <button type="button" onClick={close}
              className="rounded-lg bg-[#637469] px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:brightness-110">
              ตกลง
            </button>
          </div>
        </div>
      </PickerSurface>
    </div>
  );
}
