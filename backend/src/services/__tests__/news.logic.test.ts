import { isNewsPublishedAt, NewsWindow } from '../news.logic';

const at = (iso: string) => new Date(iso);

const item = (over: Partial<NewsWindow> = {}): NewsWindow => ({
  active: 1,
  starts_at: null,
  ends_at: null,
  ...over,
});

describe('isNewsPublishedAt', () => {
  const now = at('2026-07-22T12:00:00Z');

  it('publishes an active item with no window at all', () => {
    expect(isNewsPublishedAt(item(), now)).toBe(true);
  });

  it('never publishes an inactive item, even inside its window', () => {
    expect(isNewsPublishedAt(item({
      active: 0,
      starts_at: at('2026-07-01T00:00:00Z'),
      ends_at: at('2026-08-01T00:00:00Z'),
    }), now)).toBe(false);
  });

  describe('open-ended windows', () => {
    it('treats a null start as unbounded on the left', () => {
      expect(isNewsPublishedAt(item({ ends_at: at('2026-08-01T00:00:00Z') }), now)).toBe(true);
    });

    it('treats a null end as unbounded on the right', () => {
      expect(isNewsPublishedAt(item({ starts_at: at('2026-07-01T00:00:00Z') }), now)).toBe(true);
    });
  });

  describe('bounded windows', () => {
    const bounded = item({
      starts_at: at('2026-07-20T00:00:00Z'),
      ends_at: at('2026-07-25T00:00:00Z'),
    });

    it('publishes inside the window', () => {
      expect(isNewsPublishedAt(bounded, now)).toBe(true);
    });

    it('hides before it starts', () => {
      expect(isNewsPublishedAt(bounded, at('2026-07-19T23:59:59Z'))).toBe(false);
    });

    it('hides after it ends', () => {
      expect(isNewsPublishedAt(bounded, at('2026-07-25T00:00:01Z'))).toBe(false);
    });

    it('is inclusive on both bounds', () => {
      expect(isNewsPublishedAt(bounded, at('2026-07-20T00:00:00Z'))).toBe(true);
      expect(isNewsPublishedAt(bounded, at('2026-07-25T00:00:00Z'))).toBe(true);
    });
  });

  // Regression: NaN comparisons are always false, so a naive range check would
  // let a garbage window through instead of rejecting it. Campaigns shipped
  // this bug once.
  describe('unparseable dates never sneak through', () => {
    it('rejects a NaN evaluation instant', () => {
      expect(isNewsPublishedAt(item(), new Date('nonsense'))).toBe(false);
    });

    it('rejects a NaN start bound', () => {
      expect(isNewsPublishedAt(item({ starts_at: new Date('nonsense') }), now)).toBe(false);
    });

    it('rejects a NaN end bound', () => {
      expect(isNewsPublishedAt(item({ ends_at: new Date('nonsense') }), now)).toBe(false);
    });
  });
});
