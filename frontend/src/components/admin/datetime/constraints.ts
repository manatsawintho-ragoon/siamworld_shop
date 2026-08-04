/**
 * Bound resolution for the admin date/time fields.
 *
 * A bound has two possible sources and they behave differently:
 *
 *   pair*   comes from the companion field and encodes an invariant the backend
 *           also enforces (endsAt > startsAt, expires_at > published_at,
 *           visible_until > visible_from). Never loosened.
 *   policy* is a cap this design introduces (the 1-year ceiling). May be
 *           extended so an existing record's stored value stays reachable.
 *
 * Collapsing the two lets reachability negotiate away the invariant: pulling
 * endsAt back would raise startsAt's ceiling and allow saving start-after-end.
 */

import { startOfDay, isSameDay } from './thaiDate';

export interface FieldBounds {
  /** From the companion field. EXCLUSIVE - the backend refines all use `>`. */
  pairMin?: Date | null;
  pairMax?: Date | null;
  /** This design's caps. Inclusive. */
  policyMin?: Date | null;
  policyMax?: Date | null;
  /** Block dates before now. Inclusive of now. */
  disablePast?: boolean;
  /**
   * The value stored on the record, captured when the modal opened.
   * MUST be null when creating - these pages share one modal and one form
   * object between create and edit, so a stale ref would let a new record
   * inherit the edited one's floor.
   */
  originalValue?: Date | null;
}

export interface ResolvedBounds {
  min: Date | null;
  max: Date | null;
  /** True when max < min: nothing is selectable and the field must say why. */
  impossible: boolean;
}

const latest = (...ds: (Date | null | undefined)[]): Date | null => {
  const real = ds.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (real.length === 0) return null;
  return real.reduce((a, b) => (b.getTime() > a.getTime() ? b : a));
};

const earliest = (...ds: (Date | null | undefined)[]): Date | null => {
  const real = ds.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (real.length === 0) return null;
  return real.reduce((a, b) => (b.getTime() < a.getTime() ? b : a));
};

/** One millisecond, used to turn an exclusive pair bound into an inclusive one. */
const MS = 1;

export function resolveBounds(b: FieldBounds, now: Date = new Date()): ResolvedBounds {
  // Floor: the explicit min and the past-block COMBINE, they are not
  // alternatives. campaigns.endsAt carries disablePast AND pairMin=startsAt;
  // taking only the past-block would floor it at `now` and let the owner end a
  // future campaign before it starts.
  const pastFloor = b.disablePast
    ? earliest(now, b.originalValue ?? now)
    : null;

  // pairMin is exclusive (backend uses `>`), so shift it by a millisecond.
  const pairFloor = b.pairMin ? new Date(b.pairMin.getTime() + MS) : null;

  const min = latest(pairFloor, b.policyMin, pastFloor);

  // Ceiling: reachability extends the POLICY cap only, never the pair bound.
  const policyCeil = b.originalValue
    ? latest(b.policyMax, b.originalValue)
    : (b.policyMax ?? null);
  const pairCeil = b.pairMax ? new Date(b.pairMax.getTime() - MS) : null;

  const max = earliest(pairCeil, policyCeil);

  return {
    min,
    max,
    impossible: !!(min && max && max.getTime() < min.getTime()),
  };
}

/**
 * Is this calendar day entirely outside the bounds?
 *
 * Day-level only. A day that merely CONTAINS the boundary stays enabled - the
 * time half is what narrows it, via `clampTime` / `isTimeDisabled`. Without
 * that pairing the headline rule leaks: with min at 14:00 today, today is
 * correctly selectable and the owner then spins the time back to 09:00.
 */
export function isDayDisabled(day: Date, bounds: ResolvedBounds): boolean {
  if (bounds.impossible) return true;
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  if (bounds.min && dayEnd.getTime() < bounds.min.getTime()) return true;
  if (bounds.max && dayStart.getTime() > bounds.max.getTime()) return true;
  return false;
}

/** Minute-of-day range still selectable on `day`. */
export function allowedMinutes(day: Date, bounds: ResolvedBounds): { from: number; to: number } {
  let from = 0, to = 1439;
  if (bounds.min && isSameDay(day, bounds.min)) {
    from = bounds.min.getHours() * 60 + bounds.min.getMinutes();
  }
  if (bounds.max && isSameDay(day, bounds.max)) {
    to = bounds.max.getHours() * 60 + bounds.max.getMinutes();
  }
  return { from, to };
}

export function isTimeDisabled(day: Date, minuteOfDay: number, bounds: ResolvedBounds): boolean {
  const { from, to } = allowedMinutes(day, bounds);
  return minuteOfDay < from || minuteOfDay > to;
}

/**
 * Pull a candidate instant inside the bounds.
 *
 * Used when the owner picks a boundary day: rather than leaving an
 * out-of-range time on screen, the time snaps to the nearest legal minute.
 */
export function clampToBounds(value: Date, bounds: ResolvedBounds): Date {
  if (bounds.impossible) return value;
  if (bounds.min && value.getTime() < bounds.min.getTime()) return new Date(bounds.min);
  if (bounds.max && value.getTime() > bounds.max.getTime()) return new Date(bounds.max);
  return value;
}

export function isWithinBounds(value: Date, bounds: ResolvedBounds): boolean {
  if (bounds.impossible) return false;
  if (bounds.min && value.getTime() < bounds.min.getTime()) return false;
  if (bounds.max && value.getTime() > bounds.max.getTime()) return false;
  return true;
}

/**
 * Daily window rule for campaigns.
 *
 * The ONLY invalid case is start === end. `campaign.logic.ts` deliberately
 * supports start > end as a window that crosses midnight
 * (`minutesOfDay >= start || minutesOfDay < end`), which is how a 22:00-02:00
 * night-bonus campaign works. Forbidding it would break a live configuration.
 */
export function checkDailyWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): { ok: boolean; crossesMidnight: boolean; error: string | null } {
  if (!start || !end) return { ok: true, crossesMidnight: false, error: null };
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  if (s === e) {
    return { ok: false, crossesMidnight: false, error: 'เวลาเริ่มและสิ้นสุดต้องไม่เท่ากัน' };
  }
  return { ok: true, crossesMidnight: e < s, error: null };
}
