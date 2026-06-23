import { validateCustomHostname, mapCfHostnameStatus } from '../customDomain';

const opts = { siamsiteSuffix: 'siamsite.shop' };

describe('validateCustomHostname', () => {
  it('accepts a normal subdomain (lowercased, trimmed)', () => {
    expect(validateCustomHostname('  Shop.TheirStore.com ', opts)).toEqual({ ok: true, value: 'shop.theirstore.com' });
  });
  it('accepts a deep subdomain', () => {
    expect(validateCustomHostname('store.shop.theirstore.com', opts)).toEqual({ ok: true, value: 'store.shop.theirstore.com' });
  });
  it('rejects an apex domain (only one label before TLD)', () => {
    expect(validateCustomHostname('theirstore.com', opts).ok).toBe(false);
  });
  it('rejects our own siamsite suffix', () => {
    expect(validateCustomHostname('foo.siamsite.shop', opts).ok).toBe(false);
  });
  it('rejects empty / malformed input', () => {
    expect(validateCustomHostname('', opts).ok).toBe(false);
    expect(validateCustomHostname('has space.com', opts).ok).toBe(false);
    expect(validateCustomHostname('http://x.theirstore.com', opts).ok).toBe(false);
  });
});

describe('mapCfHostnameStatus', () => {
  it('active when hostname + ssl both active', () => {
    expect(mapCfHostnameStatus({ status: 'active', ssl: { status: 'active' } })).toBe('active');
  });
  it('pending_dns while ssl awaits validation', () => {
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'pending_validation' } })).toBe('pending_dns');
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'initializing' } })).toBe('pending_dns');
  });
  it('pending_ssl while cert issues/deploys', () => {
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'pending_issuance' } })).toBe('pending_ssl');
    expect(mapCfHostnameStatus({ status: 'active', ssl: { status: 'pending_deployment' } })).toBe('pending_ssl');
  });
  it('failed on blocked/moved/deleted', () => {
    expect(mapCfHostnameStatus({ status: 'blocked', ssl: { status: 'pending_validation' } })).toBe('failed');
    expect(mapCfHostnameStatus({ status: 'moved' })).toBe('failed');
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'deleted' } })).toBe('failed');
  });
  it('defaults to pending_ssl when unknown', () => {
    expect(mapCfHostnameStatus({})).toBe('pending_ssl');
  });
});
