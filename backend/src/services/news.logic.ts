/**
 * Pure news decision logic. No DB, no ambient clock, no I/O.
 *
 * Same split as campaign.logic.ts: the predicate lives here so it can be unit
 * tested directly, the DB layer lives in news.service.ts.
 *
 * TIME MODEL: stored UTC in MySQL, compared as absolute instants. A news
 * window is absolute-only - no daily hours, no weekday mask - so this stays a
 * two-sided range check.
 */

export interface NewsWindow {
  active: number;
  starts_at: Date | null;
  ends_at: Date | null;
}

/**
 * Is this item publishable at instant `when`? NULL on either bound means
 * unbounded on that side.
 *
 * The NaN guards are deliberate: an unparseable DATETIME yields a Date whose
 * getTime() is NaN, and every comparison against NaN is false, so a naive
 * range check would *pass* an item with a garbage window. Campaigns shipped
 * with exactly that bug once - do not remove these.
 */
export function isNewsPublishedAt(n: NewsWindow, when: Date): boolean {
  if (n.active !== 1) return false;

  const t = when.getTime();
  if (Number.isNaN(t)) return false;

  if (n.starts_at !== null) {
    const start = n.starts_at.getTime();
    if (Number.isNaN(start) || t < start) return false;
  }
  if (n.ends_at !== null) {
    const end = n.ends_at.getTime();
    if (Number.isNaN(end) || t > end) return false;
  }
  return true;
}
