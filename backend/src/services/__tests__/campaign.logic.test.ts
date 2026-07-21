import { bangkokParts, isCampaignActiveAt, CampaignWindow, selectCampaignAt, computeGrant, computeExpiry, CampaignRule } from '../campaign.logic';

// Base: a campaign running all of August 2026 UTC, no masks.
const base: CampaignWindow = {
  starts_at: new Date('2026-08-01T00:00:00Z'),
  ends_at:   new Date('2026-08-31T23:59:59Z'),
  daily_start_time: null,
  daily_end_time: null,
  weekday_mask: null,
  paused: 0,
  active: 1,
  deleted_at: null,
};

const rule = (over: Partial<CampaignRule> = {}): CampaignRule => ({
  id: 1,
  starts_at: new Date('2026-08-01T00:00:00Z'),
  ends_at:   new Date('2026-08-31T23:59:59Z'),
  daily_start_time: null,
  daily_end_time: null,
  weekday_mask: null,
  paused: 0,
  active: 1,
  deleted_at: null,
  points_per_baht: 0.1,
  min_topup_amount: 0,
  max_points_per_user: null,
  max_points_budget: null,
  points_expire_days: 30,
  ...over,
});

const when = new Date('2026-08-10T10:00:00Z');

describe('bangkokParts', () => {
  it('shifts UTC to UTC+7', () => {
    // 2026-08-03 is a Monday. 00:00Z -> 07:00 Bangkok, still Monday.
    expect(bangkokParts(new Date('2026-08-03T00:00:00Z')))
      .toEqual({ weekdayMon0: 0, minutesOfDay: 7 * 60 });
  });
  it('rolls the weekday forward across the Bangkok midnight boundary', () => {
    // Monday 18:00Z -> Tuesday 01:00 Bangkok
    expect(bangkokParts(new Date('2026-08-03T18:00:00Z')))
      .toEqual({ weekdayMon0: 1, minutesOfDay: 60 });
  });
  it('treats Sunday as index 6', () => {
    // 2026-08-09 is a Sunday. 05:00Z -> 12:00 Bangkok Sunday.
    expect(bangkokParts(new Date('2026-08-09T05:00:00Z')))
      .toEqual({ weekdayMon0: 6, minutesOfDay: 12 * 60 });
  });
});

describe('isCampaignActiveAt', () => {
  it('is active inside the range', () => {
    expect(isCampaignActiveAt(base, new Date('2026-08-10T10:00:00Z'))).toBe(true);
  });
  it('is inactive before the range', () => {
    expect(isCampaignActiveAt(base, new Date('2026-07-31T10:00:00Z'))).toBe(false);
  });
  it('is inactive after the range', () => {
    expect(isCampaignActiveAt(base, new Date('2026-09-01T10:00:00Z'))).toBe(false);
  });
  it('is inactive when paused', () => {
    expect(isCampaignActiveAt({ ...base, paused: 1 }, new Date('2026-08-10T10:00:00Z'))).toBe(false);
  });
  it('is inactive when not active', () => {
    expect(isCampaignActiveAt({ ...base, active: 0 }, new Date('2026-08-10T10:00:00Z'))).toBe(false);
  });
  it('is inactive when soft-deleted', () => {
    expect(isCampaignActiveAt({ ...base, deleted_at: new Date() }, new Date('2026-08-10T10:00:00Z'))).toBe(false);
  });

  describe('daily hours mask (Bangkok)', () => {
    const evening = { ...base, daily_start_time: '18:00:00', daily_end_time: '22:00:00' };
    it('is active inside the daily window', () => {
      // 13:00Z -> 20:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T13:00:00Z'))).toBe(true);
    });
    it('is inactive outside the daily window', () => {
      // 04:00Z -> 11:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T04:00:00Z'))).toBe(false);
    });
    it('is active exactly at the start minute', () => {
      // 11:00Z -> 18:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T11:00:00Z'))).toBe(true);
    });
    it('is inactive exactly at the end minute (end is exclusive)', () => {
      // 15:00Z -> 22:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T15:00:00Z'))).toBe(false);
    });
    it('handles a window crossing Bangkok midnight', () => {
      const overnight = { ...base, daily_start_time: '22:00:00', daily_end_time: '02:00:00' };
      // 16:00Z -> 23:00 Bangkok, inside
      expect(isCampaignActiveAt(overnight, new Date('2026-08-10T16:00:00Z'))).toBe(true);
      // 18:00Z -> 01:00 Bangkok next day, inside
      expect(isCampaignActiveAt(overnight, new Date('2026-08-10T18:00:00Z'))).toBe(true);
      // 07:00Z -> 14:00 Bangkok, outside
      expect(isCampaignActiveAt(overnight, new Date('2026-08-10T07:00:00Z'))).toBe(false);
    });
  });

  describe('weekday mask', () => {
    // bit0=Mon .. bit6=Sun. Sat|Sun = bit5|bit6 = 32|64 = 96
    const weekend = { ...base, weekday_mask: 96 };
    it('is active on Saturday', () => {
      // 2026-08-08 is a Saturday. 05:00Z -> 12:00 Bangkok Sat.
      expect(isCampaignActiveAt(weekend, new Date('2026-08-08T05:00:00Z'))).toBe(true);
    });
    it('is active on Sunday', () => {
      expect(isCampaignActiveAt(weekend, new Date('2026-08-09T05:00:00Z'))).toBe(true);
    });
    it('is inactive on Monday', () => {
      expect(isCampaignActiveAt(weekend, new Date('2026-08-03T05:00:00Z'))).toBe(false);
    });
    it('a zero mask matches nothing', () => {
      expect(isCampaignActiveAt({ ...base, weekday_mask: 0 }, new Date('2026-08-08T05:00:00Z'))).toBe(false);
    });
  });
});

describe('selectCampaignAt', () => {
  it('returns null when nothing is active', () => {
    expect(selectCampaignAt([rule({ paused: 1 })], when)).toBeNull();
  });
  it('returns the only active campaign', () => {
    expect(selectCampaignAt([rule({ id: 7 })], when)?.id).toBe(7);
  });
  it('picks the highest rate when several overlap (never stacks)', () => {
    const picked = selectCampaignAt([
      rule({ id: 1, points_per_baht: 0.1 }),
      rule({ id: 2, points_per_baht: 0.5 }),
      rule({ id: 3, points_per_baht: 0.2 }),
    ], when);
    expect(picked?.id).toBe(2);
  });
  it('ignores inactive campaigns when picking the highest rate', () => {
    const picked = selectCampaignAt([
      rule({ id: 1, points_per_baht: 0.1 }),
      rule({ id: 2, points_per_baht: 9.9, paused: 1 }),
    ], when);
    expect(picked?.id).toBe(1);
  });
  it('breaks a rate tie deterministically by lowest id', () => {
    const picked = selectCampaignAt([
      rule({ id: 5, points_per_baht: 0.3 }),
      rule({ id: 2, points_per_baht: 0.3 }),
    ], when);
    expect(picked?.id).toBe(2);
  });
});

describe('computeGrant', () => {
  it('computes points at the linear rate', () => {
    expect(computeGrant({
      amountBaht: 500, campaign: rule(), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 50, capped: 'none' });
  });
  it('floors fractional points', () => {
    expect(computeGrant({
      amountBaht: 55, campaign: rule({ points_per_baht: 0.1 }), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 5, capped: 'none' });
  });
  it('grants nothing below min_topup_amount', () => {
    expect(computeGrant({
      amountBaht: 40, campaign: rule({ min_topup_amount: 50 }), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 0, capped: 'none' });
  });
  it('grants at exactly min_topup_amount', () => {
    expect(computeGrant({
      amountBaht: 50, campaign: rule({ min_topup_amount: 50 }), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 5, capped: 'none' });
  });
  it('clamps to the per-user cap and reports it', () => {
    expect(computeGrant({
      amountBaht: 1000, campaign: rule({ max_points_per_user: 60 }), userAlreadyGranted: 40, campaignAlreadyGranted: 0,
    })).toEqual({ points: 20, capped: 'user' });
  });
  it('returns zero when the per-user cap is already exhausted', () => {
    expect(computeGrant({
      amountBaht: 1000, campaign: rule({ max_points_per_user: 60 }), userAlreadyGranted: 60, campaignAlreadyGranted: 0,
    })).toEqual({ points: 0, capped: 'user' });
  });
  it('clamps to the campaign budget and reports it', () => {
    expect(computeGrant({
      amountBaht: 1000, campaign: rule({ max_points_budget: 500 }), userAlreadyGranted: 0, campaignAlreadyGranted: 480,
    })).toEqual({ points: 20, capped: 'budget' });
  });
  it('applies the tighter of the two caps', () => {
    expect(computeGrant({
      amountBaht: 1000,
      campaign: rule({ max_points_per_user: 50, max_points_budget: 500 }),
      userAlreadyGranted: 45, campaignAlreadyGranted: 490,
    })).toEqual({ points: 5, capped: 'user' });
  });
  it('never returns negative points', () => {
    expect(computeGrant({
      amountBaht: 100, campaign: rule({ max_points_per_user: 10 }), userAlreadyGranted: 999, campaignAlreadyGranted: 0,
    })).toEqual({ points: 0, capped: 'user' });
  });
});

describe('computeExpiry', () => {
  it('expires N days after the campaign ends', () => {
    expect(computeExpiry(rule({
      ends_at: new Date('2026-08-31T00:00:00Z'), points_expire_days: 30,
    }))).toEqual(new Date('2026-09-30T00:00:00Z'));
  });
  it('supports a zero grace (expires at campaign end)', () => {
    expect(computeExpiry(rule({
      ends_at: new Date('2026-08-31T00:00:00Z'), points_expire_days: 0,
    }))).toEqual(new Date('2026-08-31T00:00:00Z'));
  });
});
