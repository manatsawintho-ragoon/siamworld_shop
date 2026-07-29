import { planBurn, isRewardVisibleAt, checkRedeemable, RewardVisibility } from '../reward.logic';

const lot = (id: number, points_remaining: number) => ({ id, points_remaining });

describe('planBurn', () => {
  it('takes from a single lot when it covers the cost', () => {
    expect(planBurn([lot(1, 100)], 30)).toEqual([{ lotId: 1, points: 30 }]);
  });

  it('drains lots in the order given (caller sorts by expiry)', () => {
    expect(planBurn([lot(1, 20), lot(2, 50)], 60)).toEqual([
      { lotId: 1, points: 20 },
      { lotId: 2, points: 40 },
    ]);
  });

  it('handles an exact fit across several lots', () => {
    expect(planBurn([lot(1, 20), lot(2, 30)], 50)).toEqual([
      { lotId: 1, points: 20 },
      { lotId: 2, points: 30 },
    ]);
  });

  it('stops as soon as the cost is covered', () => {
    expect(planBurn([lot(1, 100), lot(2, 100)], 10)).toEqual([{ lotId: 1, points: 10 }]);
  });

  // A partial burn would charge for a reward the player cannot afford.
  it('refuses rather than partially burning when the balance is short', () => {
    expect(planBurn([lot(1, 20), lot(2, 10)], 50)).toBeNull();
    expect(planBurn([], 1)).toBeNull();
  });

  // Debt rows are a liability repaid by future grants. If they could be burned
  // they would effectively "pay" for a reward.
  it('never draws from negative clawback-debt lots', () => {
    expect(planBurn([lot(1, -100), lot(2, 30)], 30)).toEqual([{ lotId: 2, points: 30 }]);
    expect(planBurn([lot(1, -100)], 10)).toBeNull();
  });

  it('skips drained lots', () => {
    expect(planBurn([lot(1, 0), lot(2, 5)], 5)).toEqual([{ lotId: 2, points: 5 }]);
  });

  it('rejects a nonsensical cost', () => {
    expect(planBurn([lot(1, 100)], 0)).toBeNull();
    expect(planBurn([lot(1, 100)], -5)).toBeNull();
    expect(planBurn([lot(1, 100)], NaN)).toBeNull();
  });
});

describe('isRewardVisibleAt', () => {
  const now = new Date('2026-07-22T12:00:00Z');
  const reward = (o: Partial<RewardVisibility> = {}): RewardVisibility => ({
    active: 1, deleted_at: null, visible_from: null, visible_until: null, ...o,
  });

  it('shows an active reward with no window', () => {
    expect(isRewardVisibleAt(reward(), now)).toBe(true);
  });

  it('hides inactive and soft-deleted rewards', () => {
    expect(isRewardVisibleAt(reward({ active: 0 }), now)).toBe(false);
    expect(isRewardVisibleAt(reward({ deleted_at: now }), now)).toBe(false);
  });

  it('respects both window bounds', () => {
    expect(isRewardVisibleAt(reward({ visible_from: new Date('2099-01-01') }), now)).toBe(false);
    expect(isRewardVisibleAt(reward({ visible_until: new Date('2000-01-01') }), now)).toBe(false);
  });

  it('hides a reward with an unparseable window instead of showing it', () => {
    expect(isRewardVisibleAt(reward({ visible_from: new Date('nonsense') }), now)).toBe(false);
    expect(isRewardVisibleAt(reward({ visible_until: new Date('nonsense') }), now)).toBe(false);
  });
});

describe('checkRedeemable', () => {
  const base = {
    visible: true, stock: null as number | null, perUserLimit: null as number | null,
    alreadyRedeemed: 0, balance: 100, pointCost: 50,
    requiresCampaignId: null as number | null, activeCampaignId: null as number | null,
  };

  it('allows a straightforward redeem', () => {
    expect(checkRedeemable(base)).toBeNull();
  });

  it('blocks an invisible reward', () => {
    expect(checkRedeemable({ ...base, visible: false })).toBe('not_visible');
  });

  it('blocks when sold out', () => {
    expect(checkRedeemable({ ...base, stock: 0 })).toBe('sold_out');
  });

  it('allows the last unit', () => {
    expect(checkRedeemable({ ...base, stock: 1 })).toBeNull();
  });

  it('blocks at the per-user limit', () => {
    expect(checkRedeemable({ ...base, perUserLimit: 2, alreadyRedeemed: 2 })).toBe('per_user_limit');
    expect(checkRedeemable({ ...base, perUserLimit: 2, alreadyRedeemed: 1 })).toBeNull();
  });

  it('blocks when points are short, including exact-cost as allowed', () => {
    expect(checkRedeemable({ ...base, balance: 49 })).toBe('insufficient_points');
    expect(checkRedeemable({ ...base, balance: 50 })).toBeNull();
  });

  // A negative balance means outstanding clawback debt.
  it('blocks a player carrying clawback debt', () => {
    expect(checkRedeemable({ ...base, balance: -10 })).toBe('insufficient_points');
  });

  it('enforces campaign exclusivity', () => {
    expect(checkRedeemable({ ...base, requiresCampaignId: 7, activeCampaignId: null })).toBe('campaign_required');
    expect(checkRedeemable({ ...base, requiresCampaignId: 7, activeCampaignId: 8 })).toBe('campaign_required');
    expect(checkRedeemable({ ...base, requiresCampaignId: 7, activeCampaignId: 7 })).toBeNull();
  });
});
