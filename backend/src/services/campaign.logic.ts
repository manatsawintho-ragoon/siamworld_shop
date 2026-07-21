/**
 * Pure campaign decision logic. No DB, no ambient clock, no I/O.
 *
 * Everything here is a function of its arguments so it can be unit-tested the
 * same way computeTopupCredit / resolveTopupBonus are. The DB layer lives in
 * campaign.service.ts and calls into this module.
 *
 * TIME MODEL: all Date values are absolute instants (stored UTC in MySQL).
 * Thailand is a fixed UTC+7 with no DST, so Bangkok wall-clock parts are
 * derived by shifting the instant and reading UTC fields. No tz library needed.
 */

const BANGKOK_OFFSET_MIN = 7 * 60;

export interface CampaignWindow {
  starts_at: Date;
  ends_at: Date;
  daily_start_time: string | null;   // 'HH:MM:SS' Bangkok wall clock
  daily_end_time: string | null;     // exclusive
  weekday_mask: number | null;       // bit0=Mon .. bit6=Sun; null = every day
  paused: number;
  active: number;
  deleted_at: Date | null;
}

/** Bangkok wall-clock parts of an instant: weekday (0=Mon..6=Sun) and minutes since midnight. */
export function bangkokParts(d: Date): { weekdayMon0: number; minutesOfDay: number } {
  const shifted = new Date(d.getTime() + BANGKOK_OFFSET_MIN * 60_000);
  // getUTCDay(): 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
  const weekdayMon0 = (shifted.getUTCDay() + 6) % 7;
  const minutesOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { weekdayMon0, minutesOfDay };
}

/** 'HH:MM:SS' -> minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Is this campaign granting points at instant `when`?
 *
 * Order matters: cheap flag checks first, then the absolute range, then the
 * Bangkok-local masks.
 */
export function isCampaignActiveAt(c: CampaignWindow, when: Date): boolean {
  if (c.active !== 1) return false;
  if (c.paused === 1) return false;
  if (c.deleted_at !== null) return false;

  const t = when.getTime();
  if (t < c.starts_at.getTime()) return false;
  if (t > c.ends_at.getTime()) return false;

  const { weekdayMon0, minutesOfDay } = bangkokParts(when);

  if (c.weekday_mask !== null && c.weekday_mask !== undefined) {
    if ((c.weekday_mask & (1 << weekdayMon0)) === 0) return false;
  }

  if (c.daily_start_time && c.daily_end_time) {
    const start = timeToMinutes(c.daily_start_time);
    const end   = timeToMinutes(c.daily_end_time);
    if (start === end) return false;             // zero-width window
    const inWindow = start < end
      ? (minutesOfDay >= start && minutesOfDay < end)          // same-day
      : (minutesOfDay >= start || minutesOfDay < end);         // crosses midnight
    if (!inWindow) return false;
  }

  return true;
}

export interface CampaignRule extends CampaignWindow {
  id: number;
  points_per_baht: number;
  min_topup_amount: number;
  max_points_per_user: number | null;
  max_points_budget: number | null;
  points_expire_days: number;
}

/**
 * The single campaign that applies at `when`.
 *
 * Overlapping campaigns do NOT stack: the highest rate wins, ties broken by
 * lowest id so the choice is deterministic and reproducible in support tickets.
 */
export function selectCampaignAt(list: CampaignRule[], when: Date): CampaignRule | null {
  const active = list.filter(c => isCampaignActiveAt(c, when));
  if (active.length === 0) return null;
  return active.reduce((best, c) => {
    if (c.points_per_baht > best.points_per_baht) return c;
    if (c.points_per_baht === best.points_per_baht && c.id < best.id) return c;
    return best;
  });
}

/**
 * Points earned by a qualifying top-up, after both caps.
 *
 * A partially-available cap grants the remainder rather than zero: the player
 * gets what is left and is told honestly, which beats silently zeroing them.
 */
export function computeGrant(args: {
  amountBaht: number;
  campaign: CampaignRule;
  userAlreadyGranted: number;
  campaignAlreadyGranted: number;
}): { points: number; capped: 'none' | 'user' | 'budget' } {
  const { amountBaht, campaign, userAlreadyGranted, campaignAlreadyGranted } = args;

  if (amountBaht < campaign.min_topup_amount) return { points: 0, capped: 'none' };

  let points = Math.floor(amountBaht * campaign.points_per_baht);
  let capped: 'none' | 'user' | 'budget' = 'none';

  if (campaign.max_points_budget !== null) {
    const room = Math.max(0, campaign.max_points_budget - campaignAlreadyGranted);
    if (room < points) { points = room; capped = 'budget'; }
  }
  if (campaign.max_points_per_user !== null) {
    const room = Math.max(0, campaign.max_points_per_user - userAlreadyGranted);
    if (room < points) { points = room; capped = 'user'; }
  }

  return { points: Math.max(0, points), capped };
}

/** Frozen onto the lot at grant time. Later campaign edits never change it. */
export function computeExpiry(campaign: CampaignRule): Date {
  return new Date(campaign.ends_at.getTime() + campaign.points_expire_days * 86_400_000);
}

/**
 * Reversing a top-up must reverse its points, otherwise
 * "top up, take points, redeem, dispute the payment" is free money.
 *
 * Unspent points are simply removed. Points already spent cannot be un-spent
 * (the reward is already in the player's inventory), so the shortfall is
 * recorded as debt: a negative lot that future earnings must repay first.
 */
export function planClawback(lot: { points_granted: number; points_remaining: number }):
  { reduceRemainingBy: number; debtToRecord: number } {
  const granted = Math.max(0, lot.points_granted);
  const remaining = Math.max(0, lot.points_remaining);
  const reduceRemainingBy = Math.min(granted, remaining);
  return { reduceRemainingBy, debtToRecord: granted - reduceRemainingBy };
}
