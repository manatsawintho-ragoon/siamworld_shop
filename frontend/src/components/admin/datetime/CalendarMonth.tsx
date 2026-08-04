'use client';

import { useMemo } from 'react';
import {
  THAI_WEEKDAYS_MON_FIRST, formatThaiMonthYear, daysInMonth, leadingBlanks,
  isSameDay, startOfDay,
} from './thaiDate';
import { ResolvedBounds, isDayDisabled } from './constraints';

interface Props {
  /** Month being displayed (any day within it). */
  viewDate: Date;
  selected: Date | null;
  bounds: ResolvedBounds;
  onPick: (day: Date) => void;
  onViewChange: (d: Date) => void;
}

/**
 * A month grid, MONDAY FIRST.
 *
 * Thai calendars usually start Sunday; this deliberately does not, because
 * admin/campaigns renders its weekday selector as ['จ','อ','พ','พฤ','ศ','ส','อา']
 * and both that page and campaign.logic.ts compute weekdayMon0. A Sunday-first
 * calendar would sit directly above a Monday-first selector in the same modal.
 *
 * Disabled days are visually distinct rather than merely inert: a day you
 * cannot click and cannot tell apart from one you can reads as a broken
 * calendar.
 */
export function CalendarMonth({ viewDate, selected, bounds, onPick, onViewChange }: Props) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = useMemo(() => startOfDay(new Date()), []);

  const cells = useMemo(() => {
    const blanks = leadingBlanks(year, month);
    const total = daysInMonth(year, month);
    const out: (Date | null)[] = Array(blanks).fill(null);
    for (let d = 1; d <= total; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  // A month is unreachable if every one of its days is out of bounds.
  const stepMonth = (delta: number) => onViewChange(new Date(year, month + delta, 1));
  const prevBlocked = useMemo(() => {
    const last = new Date(year, month, 0);
    return isDayDisabled(last, bounds) && !!bounds.min && last.getTime() < bounds.min.getTime();
  }, [year, month, bounds]);
  const nextBlocked = useMemo(() => {
    const first = new Date(year, month + 1, 1);
    return isDayDisabled(first, bounds) && !!bounds.max && first.getTime() > bounds.max.getTime();
  }, [year, month, bounds]);

  return (
    <div className="px-3 pb-2">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button" onClick={() => stepMonth(-1)} disabled={prevBlocked}
          aria-label="เดือนก่อนหน้า"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <i className="fas fa-chevron-left text-[10px]" />
        </button>
        <p className="text-[13px] font-bold text-gray-800">{formatThaiMonthYear(year, month)}</p>
        <button
          type="button" onClick={() => stepMonth(1)} disabled={nextBlocked}
          aria-label="เดือนถัดไป"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <i className="fas fa-chevron-right text-[10px]" />
        </button>
      </div>

      <table role="grid" className="w-full border-collapse">
        <thead>
          <tr>
            {THAI_WEEKDAYS_MON_FIRST.map(d => (
              <th key={d} scope="col" className="pb-1 text-[10px] font-semibold text-gray-400">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
                if (!day) return <td key={i} className="p-0.5" />;
                const disabled = isDayDisabled(day, bounds);
                const isSel = isSameDay(day, selected);
                const isToday = isSameDay(day, today);
                return (
                  <td key={i} className="p-0.5">
                    <button
                      type="button"
                      disabled={disabled}
                      aria-disabled={disabled}
                      aria-selected={isSel}
                      aria-label={`${day.getDate()} ${formatThaiMonthYear(year, month)}`}
                      onClick={() => onPick(day)}
                      className={[
                        'flex h-8 w-full items-center justify-center rounded-lg text-[12px] font-medium tabular-nums transition-colors',
                        disabled
                          ? 'cursor-not-allowed text-gray-300 line-through decoration-gray-200'
                          : isSel
                            ? 'bg-[#637469] text-white'
                            : isToday
                              ? 'bg-orange-50 text-[#f97316] ring-1 ring-orange-200'
                              : 'text-gray-700 hover:bg-gray-100',
                      ].join(' ')}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
