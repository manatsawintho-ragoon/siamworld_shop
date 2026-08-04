'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AreaSeries } from './AreaSeries';
import { BarSeries } from './BarSeries';
import { Crosshair, TooltipRow } from './Crosshair';
import { INK, SERIES, SeriesKey } from './palette';
import { bandX, formatCompact, formatFull, niceTicks, project, thinTicks } from './scale';

export interface SeriesPoint {
  key: string;
  label: string;
  newUsers: number;
  topupAmount: number;
  revenueAmount: number;
}

interface Props {
  points: SeriesPoint[];
  /** Shown above the plot so "30 days" is never ambiguous about WHICH 30 days. */
  rangeCaption: string;
  loading?: boolean;
}

/* Geometry. Two panels, one x scale, one crosshair. */
const GUTTER = 52;   // left, for y labels
const PAD_R = 14;
const MONEY_H = 176;
const GAP = 30;
const COUNT_H = 62;
const XAXIS_H = 24;
const INSET = 10;    // keeps end markers/bars off the panel edges
const TOTAL_H = MONEY_H + GAP + COUNT_H + XAXIS_H;

/**
 * The dashboard timeline.
 *
 * Two stacked panels sharing one x axis: Baht above, people below. They are NOT
 * a dual-axis chart - that was the previous bug in a different form. The old
 * version put member counts and Baht on one shared y scale, so with any real
 * data (5 members, 5,000 Baht) the member line sat flat on zero and carried no
 * information. A second y axis on the same plot would have been worse: the
 * crossings it produces are an artifact of how the two scales were aligned, not
 * a relationship in the data. Separate panels give each measure an honest scale
 * and still let you read a spike against the day it happened.
 */
export function TimelineChart({ points, rangeCaption, loading }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const uid = useId().replace(/:/g, '');

  // Measure instead of stretching. The old chart used
  // preserveAspectRatio="none", which scaled strokes, dots and text by whatever
  // the card's aspect ratio happened to be - a "2px" line was never 2px.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(120, width - GUTTER - PAD_R);

  const { moneyTicks, moneyMax, countTicks, countMax, labelIdx } = useMemo(() => {
    const moneyVals = points.flatMap(p => [
      hidden.has('revenue') ? 0 : p.revenueAmount,
      hidden.has('topups') ? 0 : p.topupAmount,
    ]);
    const countVals = points.map(p => (hidden.has('users') ? 0 : p.newUsers));
    const mt = niceTicks(Math.max(...moneyVals, 0), 4);
    const ct = niceTicks(Math.max(...countVals, 0), 2);
    return {
      moneyTicks: mt,
      moneyMax: mt[mt.length - 1],
      countTicks: ct,
      countMax: ct[ct.length - 1],
      labelIdx: thinTicks(points.length, 7),
    };
  }, [points, hidden]);

  const toggle = useCallback((k: SeriesKey) => {
    setHidden(prev => {
      const next = new Set(prev);
      // Never let the last visible series be switched off - an empty plot is
      // indistinguishable from a broken one.
      if (next.has(k)) next.delete(k);
      else if (next.size < 2) next.add(k);
      return next;
    });
  }, []);

  const indexFromX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el || points.length === 0) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left - GUTTER;
    const span = plotW - INSET * 2;
    const raw = span > 0 ? ((x - INSET) / span) * (points.length - 1) : 0;
    return Math.max(0, Math.min(points.length - 1, Math.round(raw)));
  }, [points.length, plotW]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (points.length === 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      setActive(prev => {
        const start = prev ?? (dir > 0 ? -1 : points.length);
        return Math.max(0, Math.min(points.length - 1, start + dir));
      });
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const empty = points.length === 0 || points.every(
    p => p.revenueAmount === 0 && p.topupAmount === 0 && p.newUsers === 0
  );

  const activePoint = active !== null ? points[active] : null;
  const activeX = active !== null ? GUTTER + bandX(active, points.length, plotW, INSET) : 0;

  const tooltipRows: TooltipRow[] = activePoint ? [
    { key: 'revenue', value: activePoint.revenueAmount, unit: 'baht' },
    { key: 'topups', value: activePoint.topupAmount, unit: 'baht' },
    { key: 'users', value: activePoint.newUsers, unit: 'count' },
  ] : [];

  const summary = `กราฟช่วง ${rangeCaption}: ${points.length} จุดข้อมูล`;

  return (
    <div>
      {/* Legend + range caption. The legend is always present: with three series
          identity must never rest on colour alone. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium" style={{ color: INK.muted }}>{rangeCaption}</p>
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(SERIES) as SeriesKey[]).map(k => {
            const off = hidden.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                aria-pressed={!off}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  off ? 'text-gray-300 hover:bg-gray-50' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: off ? '#d1d5db' : SERIES[k].color }}
                  aria-hidden
                />
                {SERIES[k].label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative"
        tabIndex={0}
        role="img"
        aria-label={summary}
        onKeyDown={onKeyDown}
        onMouseMove={e => setActive(indexFromX(e.clientX))}
        onMouseLeave={() => setActive(null)}
        style={{ outline: 'none' }}
      >
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: TOTAL_H }}>
            <span className="text-xs" style={{ color: INK.muted }}>กำลังโหลด...</span>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-1" style={{ height: TOTAL_H }}>
            <i className="fas fa-chart-line text-2xl" style={{ color: INK.grid }} aria-hidden></i>
            <p className="text-xs font-medium" style={{ color: INK.muted }}>ยังไม่มีข้อมูลในช่วงนี้</p>
            <p className="text-[10.5px]" style={{ color: INK.grid }}>ลองเลือกช่วงเวลาที่กว้างขึ้น</p>
          </div>
        ) : (
          <>
            <svg width={width} height={TOTAL_H} className="block" aria-hidden>
              {/* ── Money panel ── */}
              <g transform={`translate(${GUTTER},0)`}>
                {moneyTicks.map(t => {
                  const y = MONEY_H - project(t, moneyMax, MONEY_H);
                  return (
                    <g key={`m${t}`}>
                      {/* Solid hairline. Dashed gridlines read as a threshold. */}
                      <line x1={0} y1={y} x2={plotW} y2={y} stroke={INK.grid} strokeWidth={1} />
                      <text
                        x={-8} y={y + 3.5} textAnchor="end" fontSize={10}
                        fill={INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatCompact(t)}
                      </text>
                    </g>
                  );
                })}
                <AreaSeries
                  values={points.map(p => p.topupAmount)} maxValue={moneyMax}
                  width={plotW} height={MONEY_H} inset={INSET}
                  color={SERIES.topups.color} gradientId={`g-topups-${uid}`}
                  hidden={hidden.has('topups')}
                />
                <AreaSeries
                  values={points.map(p => p.revenueAmount)} maxValue={moneyMax}
                  width={plotW} height={MONEY_H} inset={INSET}
                  color={SERIES.revenue.color} gradientId={`g-revenue-${uid}`}
                  hidden={hidden.has('revenue')}
                />
                <line x1={0} y1={MONEY_H} x2={plotW} y2={MONEY_H} stroke={INK.axis} strokeWidth={1} />
              </g>

              {/* ── Count panel ── */}
              <g transform={`translate(${GUTTER},${MONEY_H + GAP})`}>
                <text x={-8} y={9} textAnchor="end" fontSize={10} fill={INK.muted}
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatCompact(countMax)}
                </text>
                <text x={-8} y={COUNT_H + 3.5} textAnchor="end" fontSize={10} fill={INK.muted}>0</text>
                <BarSeries
                  values={points.map(p => p.newUsers)} maxValue={countMax}
                  width={plotW} height={COUNT_H} inset={INSET}
                  color={SERIES.users.color} activeIndex={active}
                />
                <line x1={0} y1={COUNT_H} x2={plotW} y2={COUNT_H} stroke={INK.axis} strokeWidth={1} />
              </g>

              {/* ── Shared x labels ── */}
              <g transform={`translate(${GUTTER},${MONEY_H + GAP + COUNT_H})`}>
                {labelIdx.map(i => (
                  <text
                    key={i}
                    x={bandX(i, points.length, plotW, INSET)}
                    y={16}
                    textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                    fontSize={10}
                    fill={INK.muted}
                  >
                    {points[i].label}
                  </text>
                ))}
              </g>

              {/* ── Crosshair guide + markers ── */}
              {active !== null && (
                <g>
                  <line
                    x1={activeX} y1={0} x2={activeX} y2={MONEY_H + GAP + COUNT_H}
                    stroke={INK.axis} strokeWidth={1}
                  />
                  {(['topups', 'revenue'] as const).map(k => {
                    if (hidden.has(k)) return null;
                    const v = k === 'topups' ? points[active].topupAmount : points[active].revenueAmount;
                    return (
                      <circle
                        key={k}
                        cx={activeX}
                        cy={MONEY_H - project(v, moneyMax, MONEY_H)}
                        r={4.5}
                        fill={SERIES[k].color}
                        /* 2px surface ring, not a border: separates overlapping marks. */
                        stroke={INK.surface}
                        strokeWidth={2}
                      />
                    );
                  })}
                </g>
              )}
            </svg>

            {activePoint && (
              <Crosshair
                x={activeX}
                label={activePoint.label}
                rows={tooltipRows}
                containerWidth={width}
                hiddenSeries={hidden}
              />
            )}
          </>
        )}

        {/* Table view: the non-visual path to the same numbers, and the relief
            the palette's contrast WARN requires. */}
        <table className="sr-only">
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">ช่วงเวลา</th>
              <th scope="col">{SERIES.revenue.label}</th>
              <th scope="col">{SERIES.topups.label}</th>
              <th scope="col">{SERIES.users.label}</th>
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.key}>
                <th scope="row">{p.label}</th>
                <td>{formatFull(p.revenueAmount)} บาท</td>
                <td>{formatFull(p.topupAmount)} บาท</td>
                <td>{formatFull(p.newUsers)} คน</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
