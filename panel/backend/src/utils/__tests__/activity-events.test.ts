import { normalizePath, sanitizeEvents } from '../activity-events';

describe('normalizePath', () => {
  it('keeps in-scope dashboard/admin paths', () => {
    expect(normalizePath('/dashboard')).toBe('/dashboard');
    expect(normalizePath('/dashboard/renew')).toBe('/dashboard/renew');
    expect(normalizePath('/admin/customers')).toBe('/admin/customers');
  });
  it('strips query string and hash', () => {
    expect(normalizePath('/dashboard/topup?method=promptpay#x')).toBe('/dashboard/topup');
  });
  it('collapses numeric id segments to :id', () => {
    expect(normalizePath('/admin/customers/123')).toBe('/admin/customers/:id');
    expect(normalizePath('/admin/customers/123/history')).toBe('/admin/customers/:id/history');
  });
  it('strips a trailing slash', () => {
    expect(normalizePath('/dashboard/profile/')).toBe('/dashboard/profile');
  });
  it('rejects out-of-scope and malformed paths', () => {
    expect(normalizePath('/')).toBeNull();
    expect(normalizePath('/lp/foo')).toBeNull();
    expect(normalizePath('/solutions')).toBeNull();
    expect(normalizePath('dashboard')).toBeNull();
    expect(normalizePath('https://evil.com')).toBeNull();
    expect(normalizePath('/dashboardish')).toBeNull();
  });
});

describe('sanitizeEvents', () => {
  it('keeps in-scope page views', () => {
    expect(sanitizeEvents([{ type: 'page_view', value: '/dashboard/renew' }]))
      .toEqual([{ action: 'page_view', details: '/dashboard/renew' }]);
  });
  it('drops out-of-scope page views', () => {
    expect(sanitizeEvents([{ type: 'page_view', value: '/lp/promo' }])).toEqual([]);
  });
  it('keeps allowlisted feature clicks and drops unknown ones', () => {
    expect(sanitizeEvents([
      { type: 'feature_click', value: 'renew_submit' },
      { type: 'feature_click', value: 'not_a_real_feature' },
    ])).toEqual([{ action: 'feature_click', details: 'renew_submit' }]);
  });
  it('ignores malformed entries without throwing', () => {
    expect(sanitizeEvents([
      { type: 'page_view', value: '' as any },
      { type: 'feature_click', value: '  topup_submit  ' },
    ])).toEqual([{ action: 'feature_click', details: 'topup_submit' }]);
  });
});
