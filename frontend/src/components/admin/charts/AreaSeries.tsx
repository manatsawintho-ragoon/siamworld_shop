'use client';

import { bandX, project } from './scale';

interface Props {
  values: number[];
  maxValue: number;
  width: number;
  height: number;
  inset: number;
  color: string;
  /** Unique per series - two gradients with the same id would collide. */
  gradientId: string;
  /** Hidden via the legend: keep the slot but draw nothing. */
  hidden?: boolean;
}

/**
 * One gradient-filled area with its line on top.
 *
 * 2px stroke, no per-point dots: a dot on every bucket is noise at 90 days, and
 * the crosshair already marks the bucket under the pointer. Single points (a
 * 1-bucket range) still get a marker, or they would be invisible.
 */
export function AreaSeries({
  values, maxValue, width, height, inset, color, gradientId, hidden,
}: Props) {
  if (hidden || values.length === 0) return null;

  const pt = (v: number, i: number) => ({
    x: bandX(i, values.length, width, inset),
    y: height - project(v, maxValue, height),
  });

  const points = values.map(pt);

  if (points.length === 1) {
    return <circle cx={points[0].x} cy={points[0].y} r={4} fill={color} />;
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(2)},${height} L${points[0].x.toFixed(2)},${height} Z`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
