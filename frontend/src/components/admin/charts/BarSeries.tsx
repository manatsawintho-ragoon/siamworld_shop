'use client';

import { bandX, project } from './scale';

interface Props {
  values: number[];
  maxValue: number;
  width: number;
  height: number;
  inset: number;
  color: string;
  /** Index under the pointer, drawn at full strength while the rest recede. */
  activeIndex: number | null;
}

/**
 * The companion count panel (new members).
 *
 * Bars, not a line: these are small whole numbers, and a line implies a
 * continuous quantity between buckets that does not exist for "people who
 * registered that day".
 *
 * A 2px gap between adjacent bars comes from the surface itself, not from a
 * stroke around each bar. Data-ends are rounded 2px (half the 4px spec, because
 * these bars are only ~6px wide - a 4px radius on a 6px bar reads as a lozenge).
 * A zero-value bucket draws nothing rather than a 0-height sliver.
 */
export function BarSeries({
  values, maxValue, width, height, inset, color, activeIndex,
}: Props) {
  if (values.length === 0) return null;

  const slot = values.length > 1
    ? (width - inset * 2) / (values.length - 1)
    : width - inset * 2;
  const barW = Math.max(2, Math.min(14, slot - 2));

  return (
    <g>
      {values.map((v, i) => {
        const h = project(v, maxValue, height);
        if (h <= 0) return null;
        const x = bandX(i, values.length, width, inset) - barW / 2;
        const dimmed = activeIndex !== null && activeIndex !== i;
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={barW}
            height={h}
            rx={Math.min(2, barW / 2)}
            fill={color}
            opacity={dimmed ? 0.35 : 1}
          />
        );
      })}
    </g>
  );
}
