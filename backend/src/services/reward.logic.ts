/**
 * Pure Reward Shop logic. No DB, no ambient clock, no I/O.
 *
 * Same split as campaign.logic.ts / news.logic.ts: decisions live here so they
 * can be unit tested directly, the locking and SQL live in reward.service.ts.
 */

export interface BurnableLot {
  id: number;
  points_remaining: number;
}

export interface BurnStep {
  lotId: number;
  points: number;
}

/**
 * Plan a FIFO burn across lots, oldest-expiring first.
 *
 * `lots` MUST already be ordered by expires_at ASC by the caller (the service
 * selects them that way under FOR UPDATE). Negative lots - clawback debt - are
 * deliberately NOT burnable: they are a liability that future grants repay, so
 * they only ever reduce the *balance*, never supply points to a redemption.
 * Passing them here would otherwise let a debt row "pay" for a reward.
 */
export function planBurn(lots: BurnableLot[], cost: number): BurnStep[] | null {
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const steps: BurnStep[] = [];
  let remaining = cost;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = lot.points_remaining;
    if (available <= 0) continue;          // skips debt rows and drained lots

    const take = Math.min(available, remaining);
    steps.push({ lotId: lot.id, points: take });
    remaining -= take;
  }

  // Partial burns are never acceptable: the caller would charge for a reward
  // the player cannot afford.
  return remaining > 0 ? null : steps;
}

export interface RewardVisibility {
  active: number;
  deleted_at: Date | null;
  visible_from: Date | null;
  visible_until: Date | null;
}

/**
 * Is this reward purchasable at `when`?
 *
 * NaN guards for the same reason as news.logic.ts: an unparseable DATETIME
 * compares false against everything, so a naive range check would *show* a
 * reward with a garbage window rather than hide it.
 */
export function isRewardVisibleAt(r: RewardVisibility, when: Date): boolean {
  if (r.active !== 1) return false;
  if (r.deleted_at !== null) return false;

  const t = when.getTime();
  if (Number.isNaN(t)) return false;

  if (r.visible_from !== null) {
    const from = r.visible_from.getTime();
    if (Number.isNaN(from) || t < from) return false;
  }
  if (r.visible_until !== null) {
    const until = r.visible_until.getTime();
    if (Number.isNaN(until) || t > until) return false;
  }
  return true;
}

/** Why a redemption was refused, so the API can say something specific. */
export type RedeemBlock =
  | 'not_found' | 'not_visible' | 'sold_out'
  | 'per_user_limit' | 'insufficient_points' | 'campaign_required';

export interface RedeemCheck {
  visible: boolean;
  stock: number | null;
  perUserLimit: number | null;
  alreadyRedeemed: number;
  balance: number;
  pointCost: number;
  requiresCampaignId: number | null;
  activeCampaignId: number | null;
}

/**
 * Every pre-flight refusal in one place, ordered cheapest-first, so the route
 * and the service cannot disagree about what is allowed.
 */
export function checkRedeemable(c: RedeemCheck): RedeemBlock | null {
  if (!c.visible) return 'not_visible';
  if (c.requiresCampaignId !== null && c.requiresCampaignId !== c.activeCampaignId) return 'campaign_required';
  if (c.stock !== null && c.stock <= 0) return 'sold_out';
  if (c.perUserLimit !== null && c.alreadyRedeemed >= c.perUserLimit) return 'per_user_limit';
  if (c.balance < c.pointCost) return 'insufficient_points';
  return null;
}
