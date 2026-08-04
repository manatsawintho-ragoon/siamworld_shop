/**
 * Pure scale/formatting helpers for the admin charts.
 *
 * Kept free of React and of any DOM access so they can be reasoned about (and
 * tested) on their own - every geometry bug in the old inline chart came from
 * arithmetic tangled up with rendering.
 */

/**
 * Axis ticks that land on round numbers.
 *
 * The old chart labelled its axis with `max`, `max/2` and `0`, which produced
 * ticks like "4837" and "2418" - technically correct and unreadable. This walks
 * up to a 1/2/2.5/5/10 step instead, so the axis reads 0 / 2k / 4k / 6k.
 *
 * Returns ascending values starting at 0. The last entry is the value the axis
 * should top out at, which is >= max.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];

  const rawStep = max / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / magnitude;
  const niceStep =
    magnitude * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10);

  const ticks: number[] = [];
  const top = Math.ceil(max / niceStep) * niceStep;
  // Accumulate by index rather than by repeated addition: 0.1-style steps drift
  // badly when added in a loop and produce ticks like 0.30000000000000004.
  for (let i = 0; i * niceStep <= top + niceStep / 1e6; i++) {
    ticks.push(Math.round(i * niceStep * 1e6) / 1e6);
  }
  return ticks.length >= 2 ? ticks : [0, top || 1];
}

/**
 * Which label indices to actually draw.
 *
 * The old chart drew all 30 daily labels into a 700px viewBox, so they
 * overlapped into an unreadable smear. This keeps roughly `budget` of them,
 * always including the first and the last (the range endpoints are the two a
 * reader looks for).
 */
export function thinTicks(count: number, budget = 7): number[] {
  if (count <= 0) return [];
  if (count <= budget) return Array.from({ length: count }, (_, i) => i);

  const step = Math.ceil((count - 1) / (budget - 1));
  const out: number[] = [];
  for (let i = 0; i < count - 1; i += step) out.push(i);

  const last = count - 1;
  // Drop the previous tick if the final one would crowd it - a label pair
  // 1px apart is worse than one label.
  if (out.length && last - out[out.length - 1] < step / 2) out.pop();
  out.push(last);
  return out;
}

/** Axis-tick form: compact, never more than one decimal. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}k`;
  return trim(n);
}

/** Tooltip form: full precision with thousand separators. */
export function formatFull(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function trim(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Map a value into pixel space, with a zero-range guard. */
export function project(value: number, maxValue: number, pixels: number): number {
  if (!(maxValue > 0)) return 0;
  return (value / maxValue) * pixels;
}

/**
 * The x centre of bucket `i`.
 *
 * `inset` pushes the first and last points off the panel edges so a marker or a
 * bar at either end is not clipped in half.
 */
export function bandX(i: number, count: number, width: number, inset: number): number {
  if (count <= 1) return width / 2;
  return inset + (i / (count - 1)) * (width - inset * 2);
}
