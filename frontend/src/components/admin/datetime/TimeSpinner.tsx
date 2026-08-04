'use client';

interface Props {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  /** Selectable minute-of-day range on the chosen day. Defaults to the whole day. */
  allowed?: { from: number; to: number };
  minuteStep?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * HH:MM stepper.
 *
 * Arrows step 5 minutes (friendly for a daily bonus window) but the fields
 * accept any typed value, so an exact sale end is still reachable.
 *
 * `allowed` is the boundary-day clamp. Without it the headline rule leaks:
 * with the floor at 14:00 today, today is correctly selectable and the owner
 * then spins the time back to 09:00 and saves a past timestamp.
 */
export function TimeSpinner({ hour, minute, onChange, allowed, minuteStep = 5 }: Props) {
  const from = allowed?.from ?? 0;
  const to = allowed?.to ?? 1439;

  const commit = (total: number) => {
    const clamped = Math.min(to, Math.max(from, total));
    onChange(Math.floor(clamped / 60), clamped % 60);
  };

  const current = hour * 60 + minute;
  const step = (delta: number) => commit(current + delta);

  const Field = ({ value, onType, label }: { value: number; onType: (v: number) => void; label: string }) => (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={pad(value)}
      onChange={e => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
        if (digits === '') return;
        onType(Number(digits));
      }}
      onFocus={e => e.currentTarget.select()}
      className="w-11 rounded-lg border border-gray-200 bg-white py-1 text-center text-[15px] font-bold tabular-nums text-gray-800 focus:border-[#637469] focus:outline-none focus:ring-2 focus:ring-[#637469]/20"
    />
  );

  return (
    <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-3 py-2.5">
      <span className="text-[11px] font-medium text-gray-500">เวลา</span>

      <div className="flex items-center gap-1">
        <Field value={hour} label="ชั่วโมง" onType={h => commit(Math.min(23, h) * 60 + minute)} />
        <span className="text-[15px] font-bold text-gray-400">:</span>
        <Field value={minute} label="นาที" onType={m => commit(hour * 60 + Math.min(59, m))} />
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          type="button" onClick={() => step(minuteStep)} aria-label={`เพิ่ม ${minuteStep} นาที`}
          disabled={current >= to}
          className="flex h-4 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <i className="fas fa-chevron-up text-[8px]" />
        </button>
        <button
          type="button" onClick={() => step(-minuteStep)} aria-label={`ลด ${minuteStep} นาที`}
          disabled={current <= from}
          className="flex h-4 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <i className="fas fa-chevron-down text-[8px]" />
        </button>
      </div>

      {(from > 0 || to < 1439) && (
        <span className="text-[9.5px] text-amber-600">
          เลือกได้ {pad(Math.floor(from / 60))}:{pad(from % 60)} - {pad(Math.floor(to / 60))}:{pad(to % 60)}
        </span>
      )}
    </div>
  );
}
