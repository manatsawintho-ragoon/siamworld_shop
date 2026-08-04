'use client';

import { useId, useMemo, useRef, useState, useEffect } from 'react';
import { PickerSurface } from './PickerSurface';
import { CalendarMonth } from './CalendarMonth';
import { TimeSpinner } from './TimeSpinner';
import {
  formatThaiDateTime, startOfDay, addDays, endOfMonth, toLocalInput, fromLocalInput,
} from './thaiDate';
import {
  FieldBounds, resolveBounds, allowedMinutes, clampToBounds, isWithinBounds, isDayDisabled,
} from './constraints';

interface Props {
  /** Local wall-clock "YYYY-MM-DDTHH:mm", matching what the pages already hold. */
  value: string;
  onChange: (value: string) => void;
  bounds?: FieldBounds;
  placeholder?: string;
  /** Optional fields need a way back to empty; required ones must not offer it. */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

interface Preset { label: string; make: (now: Date) => Date }

const PRESETS: Preset[] = [
  { label: 'วันนี้',      make: n => new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59) },
  { label: 'พรุ่งนี้',     make: n => { const d = addDays(startOfDay(n), 1); d.setHours(23, 59); return d; } },
  { label: '+7 วัน',      make: n => addDays(n, 7) },
  { label: '+30 วัน',     make: n => addDays(n, 30) },
  { label: 'สิ้นเดือนนี้', make: n => endOfMonth(n) },
];

/**
 * Date + time in one control.
 *
 * Replaces `<input type="datetime-local">`, whose rendering is entirely
 * browser-dependent, shows the Gregorian year to owners who think in พ.ศ., and
 * cannot be themed.
 */
export function DateTimeField({
  value, onChange, bounds, placeholder = 'เลือกวันและเวลา',
  clearable = false, disabled = false, id, className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const uid = useId();

  const selected = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewDate, setViewDate] = useState<Date>(() => selected ?? new Date());
  useEffect(() => { if (selected) setViewDate(selected); }, [selected]);

  const resolved = useMemo(() => resolveBounds(bounds ?? {}, new Date()), [bounds]);

  const commit = (d: Date) => {
    onChange(toLocalInput(clampToBounds(d, resolved)));
  };

  const pickDay = (day: Date) => {
    const base = selected ?? new Date();
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes());
    commit(next);
  };

  const setTime = (h: number, m: number) => {
    const base = selected ?? new Date();
    commit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m));
  };

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  // A preset that resolves outside the bounds is not offered, so a preset can
  // never produce an invalid value.
  const presets = useMemo(() => {
    const now = new Date();
    return PRESETS.filter(p => isWithinBounds(p.make(now), resolved));
  }, [resolved]);

  const outOfRange = selected ? !isWithinBounds(selected, resolved) : false;
  const allowed = selected ? allowedMinutes(selected, resolved) : { from: 0, to: 1439 };

  return (
    <div className={className}>
      <button
        ref={el => { triggerRef.current = el; setAnchor(el); }}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={[
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#637469]/20',
          disabled ? 'cursor-not-allowed bg-gray-50 text-gray-400' : 'bg-white',
          resolved.impossible || outOfRange
            ? 'border-red-300 focus:border-red-400'
            : 'border-gray-200 focus:border-[#637469]',
        ].join(' ')}
      >
        <i className="fas fa-calendar-alt flex-shrink-0 text-[11px] text-gray-400" />
        <span className={`flex-1 truncate ${value ? 'text-gray-800' : 'text-gray-400'}`}>
          {value ? formatThaiDateTime(new Date(value)) : placeholder}
        </span>
        {clearable && value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างค่า"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onChange(''); } }}
            className="flex-shrink-0 rounded p-0.5 text-gray-300 hover:text-gray-500"
          >
            <i className="fas fa-times text-[10px]" />
          </span>
        )}
      </button>

      {resolved.impossible && (
        <p className="mt-1 text-[10px] font-medium text-red-500">
          ช่วงเวลาที่กำหนดขัดกันเอง กรุณาตรวจสอบวันเริ่มและวันสิ้นสุด
        </p>
      )}

      <PickerSurface anchor={anchor} open={open && !disabled} onClose={close} labelledBy={`${uid}-t`}>
        <div className="w-[288px] max-w-full sm:w-[288px]">
          <div id={`${uid}-t`} className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-[12px] font-bold text-gray-700">เลือกวันและเวลา</p>
            <button type="button" onClick={close} aria-label="ปิด"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <i className="fas fa-times text-[11px]" />
            </button>
          </div>

          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {presets.map(p => (
                <button
                  key={p.label} type="button"
                  onClick={() => { commit(p.make(new Date())); setOpen(false); triggerRef.current?.focus(); }}
                  className="rounded-lg bg-gray-100 px-2 py-1 text-[10.5px] font-semibold text-gray-600 transition-colors hover:bg-gray-200"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <CalendarMonth
            viewDate={viewDate}
            selected={selected}
            bounds={resolved}
            onPick={pickDay}
            onViewChange={setViewDate}
          />

          <TimeSpinner
            hour={selected?.getHours() ?? 0}
            minute={selected?.getMinutes() ?? 0}
            allowed={allowed}
            onChange={setTime}
          />

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
            {clearable ? (
              <button type="button" onClick={() => { onChange(''); close(); }}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100">
                ล้างค่า
              </button>
            ) : <span />}
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

/** Re-exported so pages can keep converting at the API boundary. */
export { toLocalInput, fromLocalInput, isDayDisabled };
