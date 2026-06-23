import { isWsOriginAllowed } from '../../utils/wsOrigin';

describe('isWsOriginAllowed', () => {
  it('allows non-browser clients (no Origin header)', () => {
    expect(isWsOriginAllowed(undefined, 'name.siamsite.shop', [])).toBe(true);
  });
  it('allows same-origin custom domains not in the configured list', () => {
    expect(isWsOriginAllowed('https://shop.theirstore.com', 'shop.theirstore.com', [])).toBe(true);
  });
  it('allows an explicitly configured origin', () => {
    expect(isWsOriginAllowed('https://name.siamsite.shop', 'name.siamsite.shop', ['https://name.siamsite.shop'])).toBe(true);
  });
  it('rejects a cross-origin host that is not configured', () => {
    expect(isWsOriginAllowed('https://evil.com', 'shop.theirstore.com', [])).toBe(false);
  });
  it('honors wildcard', () => {
    expect(isWsOriginAllowed('https://evil.com', 'shop.theirstore.com', '*')).toBe(true);
  });
  it('matches host including port (dev)', () => {
    expect(isWsOriginAllowed('http://localhost:3000', 'localhost:3000', [])).toBe(true);
  });
  it('rejects a malformed origin', () => {
    expect(isWsOriginAllowed('not-a-url', 'shop.theirstore.com', [])).toBe(false);
  });
});
