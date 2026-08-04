/**
 * Shared helpers for the product / loot-box "sale window" admin controls.
 *
 * Both admin screens let an owner release an item for a duration (value + unit)
 * or until an end date. Two bugs lived in the duplicated copies of this logic:
 *
 *  1. Opening the modal hard-reset the controls to a fixed default instead of
 *     deriving them from the item's real sale window. An owner who had set
 *     "60 days" reopened to read "60 นาที", and pressing release again wrote a
 *     genuine 60-minute sale over their 60-day one. Seen in production.
 *
 *  2. The datetime-local input was seeded from toISOString() (UTC) but is read
 *     back as LOCAL wall clock, so every end-date sale lost the local UTC
 *     offset: a "7 day" sale stored 9659 minutes instead of 10080 in
 *     Asia/Bangkok.
 *
 * Keeping them here means the two screens cannot drift apart again.
 */

export type SaleDurUnit = 'minutes' | 'hours' | 'days';

export interface SaleDuration {
  value: number;
  unit: SaleDurUnit;
}

/**
 * Format a Date/ISO string for a `datetime-local` input.
 *
 * datetime-local carries no timezone: it reads and writes local wall clock, so
 * the value must be shifted by the local offset first. Do NOT "simplify" this
 * back to toISOString() — that is UTC and silently shortens every sale.
 * Mirrors the helper already used by admin/rewards and admin/news.
 */
/**
 * Re-export, not a fourth implementation.
 *
 * This function existed independently here and in three admin pages. The copies
 * drifted - one emitted UTC into a control that reads local wall clock - and
 * that is what produced the sale-duration bug. The single implementation now
 * lives in components/admin/datetime/thaiDate.ts.
 *
 * Still needed here: products/page.tsx and lootboxes/page.tsx call it to seed
 * their sale-end state (`hasLiveSale(...) ? toLocalInput(...) : defaultSaleEndInput()`),
 * independently of any input element.
 */
import { toLocalInput } from '@/components/admin/datetime/thaiDate';
export { toLocalInput };

/** Seven days out, formatted for a datetime-local input, in local time. */
export function defaultSaleEndInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalInput(d);
}

/**
 * Rebuild the duration controls from an item's actual sale window.
 *
 * Picks the coarsest unit that divides exactly, so the number the owner typed is
 * the number they see when they reopen: 86400 minutes reads back as "60 days",
 * not "86400 minutes". Falls back to `fallback` when there is no live sale, so
 * a finished sale offers a fresh default rather than resurrecting an old window.
 */
export function deriveSaleDuration(
  saleStart: string | null | undefined,
  saleEnd: string | null | undefined,
  fallback: SaleDuration = { value: 60, unit: 'minutes' },
  now: number = Date.now(),
): SaleDuration {
  if (!saleStart || !saleEnd) return fallback;
  const startMs = new Date(saleStart).getTime();
  const endMs = new Date(saleEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return fallback;
  if (endMs <= now) return fallback;
  const total = Math.round((endMs - startMs) / 60_000);
  if (total <= 0) return fallback;
  if (total % 1440 === 0) return { value: total / 1440, unit: 'days' };
  if (total % 60 === 0) return { value: total / 60, unit: 'hours' };
  return { value: total, unit: 'minutes' };
}

/** Convert the duration controls to the `duration_minutes` the API expects. */
export function toDurationMinutes(value: number, unit: SaleDurUnit): number {
  if (unit === 'hours') return value * 60;
  if (unit === 'days') return value * 60 * 24;
  return value;
}

/** True when the item currently has a sale window that has not elapsed. */
export function hasLiveSale(saleEnd: string | null | undefined, now: number = Date.now()): boolean {
  if (!saleEnd) return false;
  const ms = new Date(saleEnd).getTime();
  return Number.isFinite(ms) && ms > now;
}
