import { validateCustomHostname } from '../customDomain';

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
