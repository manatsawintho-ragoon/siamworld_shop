'use client';

import { SERIES, SeriesKey, INK } from './palette';
import { formatFull } from './scale';

export interface TooltipRow {
  key: SeriesKey;
  value: number;
  unit: 'baht' | 'count';
}

interface Props {
  /** Pointer x within the chart box, in px. */
  x: number;
  label: string;
  rows: TooltipRow[];
  /** Chart box width, used to flip the card before it runs off the edge. */
  containerWidth: number;
  hiddenSeries: Set<SeriesKey>;
}

const CARD_W = 190;

/**
 * The hover card.
 *
 * Plain HTML positioned over the SVG, not SVG <text>. The old chart hand-placed
 * <rect> + <text> at fixed offsets inside a viewBox with
 * preserveAspectRatio="none", so the whole card stretched with the card width
 * and the text sheared. HTML gets the real font and real layout for free.
 */
export function Crosshair({ x, label, rows, containerWidth, hiddenSeries }: Props) {
  const visible = rows.filter(r => !hiddenSeries.has(r.key));
  if (visible.length === 0) return null;

  // Flip to the left of the pointer once the card would overflow the right edge.
  const flip = x + 12 + CARD_W > containerWidth;
  const left = flip ? x - CARD_W - 12 : x + 12;

  return (
    <div
      className="pointer-events-none absolute top-0 z-10 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
      style={{ left: Math.max(0, left), width: CARD_W }}
    >
      <p className="mb-2 border-b border-gray-100 pb-1.5 text-[11px] font-bold" style={{ color: INK.primary }}>
        {label}
      </p>
      <div className="space-y-1.5">
        {visible.map(row => (
          <div key={row.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: SERIES[row.key].color }}
              aria-hidden
            />
            <span className="flex-1 text-[10.5px]" style={{ color: INK.secondary }}>
              {SERIES[row.key].label}
            </span>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: INK.primary }}
            >
              {formatFull(row.value)}{row.unit === 'baht' ? ' ฿' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
