'use client';

/**
 * Tiny trend line for a table row.
 *
 * Deliberately hand-drawn SVG rather than recharts: the overview renders one of
 * these per shop, and mounting a dozen ResponsiveContainers to draw a dozen
 * polylines costs far more than it returns. The full charts on the drill-down
 * still use recharts.
 *
 * Presentational only, so it is hidden from assistive tech. The row always
 * carries the same information as a number.
 */
export default function Sparkline({
  points,
  width = 96,
  height = 24,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length === 0) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const max = Math.max(...points, 1);
  const pad = 2;
  const usableH = height - pad * 2;

  // A single sample has no line to draw; centre a dot instead of dividing by zero.
  const x = (i: number) =>
    points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
  const y = (v: number) => height - pad - (v / max) * usableH;

  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} className="fill-primary/10" />
      <path
        d={d}
        fill="none"
        className="stroke-primary"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.length === 1 && <circle cx={width / 2} cy={y(points[0])} r={2} className="fill-primary" />}
    </svg>
  );
}
