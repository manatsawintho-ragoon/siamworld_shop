/**
 * Chart palette for the admin dashboard.
 *
 * Slots come from a categorical palette validated against this card's actual
 * surface (#ffffff) rather than picked by eye:
 *
 *   node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a" \
 *        --mode light --surface "#ffffff"
 *   lightness band PASS · chroma floor PASS
 *   CVD separation PASS (worst adjacent aqua<->orange dE 9.2 deutan)
 *   normal-vision  PASS (worst adjacent dE 27.6)
 *   contrast       WARN aqua 2.82:1
 *
 * The aqua WARN is covered by the relief rule: this chart always ships a legend
 * with text labels, a tooltip carrying the values, and a screen-reader table, so
 * no series is identified by hue alone.
 *
 * A darker green (#008300) was tried for the members panel to clear 3:1 and was
 * rejected - it FAILs CVD separation against the orange slot (dE 3.2, protan).
 *
 * The admin panel keeps its own neutral palette and deliberately does not follow
 * the customer theme (see .agents/context/THEME.md), so there is no dark variant.
 */
export const SERIES = {
  revenue: { color: '#2a78d6', label: 'ยอดขาย Item' },
  topups:  { color: '#eb6834', label: 'ยอดเติมเงิน' },
  users:   { color: '#1baf7a', label: 'สมาชิกใหม่' },
} as const;

export type SeriesKey = keyof typeof SERIES;

/** Chart chrome. Grid and axis are solid hairlines - dashed rules read as noise. */
export const INK = {
  surface: '#ffffff',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  secondary: '#52514e',
  primary: '#0b0b0b',
} as const;
