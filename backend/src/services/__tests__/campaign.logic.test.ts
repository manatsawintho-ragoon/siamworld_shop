import { bangkokParts, isCampaignActiveAt, CampaignWindow } from '../campaign.logic';

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
