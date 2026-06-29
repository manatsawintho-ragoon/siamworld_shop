import {
  generateSeed,
  deriveRotatingPassword,
  windowIndexAt,
  msUntilNextWindow,
  currentRotatingPassword,
  WINDOW_SECONDS,
} from '../rotatingPassword';

describe('rotatingPassword', () => {
  const seed = 'a'.repeat(64); // deterministic 32-byte seed

  it('is deterministic for the same seed + window', () => {
    expect(deriveRotatingPassword(seed, 100)).toBe(deriveRotatingPassword(seed, 100));
  });

  it('changes between adjacent windows', () => {
    expect(deriveRotatingPassword(seed, 100)).not.toBe(deriveRotatingPassword(seed, 101));
  });

  it('differs per seed', () => {
    expect(deriveRotatingPassword('b'.repeat(64), 100)).not.toBe(deriveRotatingPassword(seed, 100));
  });

  it('produces a 10-char password from the unambiguous alphabet (no O/0/I/l/1)', () => {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const pw = deriveRotatingPassword(seed, 100);
    expect(pw).toHaveLength(10);
    expect([...pw].every((c) => ALPHABET.includes(c))).toBe(true);
    expect(pw).not.toMatch(/[O0Il1]/);
  });

  it('generateSeed yields 64 hex chars', () => {
    expect(generateSeed()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('windowIndexAt advances every WINDOW_SECONDS', () => {
    const windowMs = WINDOW_SECONDS * 1000;
    const t = Math.floor(1_700_000_000_000 / windowMs) * windowMs; // aligned to a window start
    expect(windowIndexAt(t)).toBe(windowIndexAt(t + windowMs - 1));
    expect(windowIndexAt(t + windowMs)).toBe(windowIndexAt(t) + 1);
  });

  it('msUntilNextWindow is within (0, 60000]', () => {
    const ms = msUntilNextWindow(1_700_000_000_123);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(WINDOW_SECONDS * 1000);
  });

  it('currentRotatingPassword matches deriveRotatingPassword at the current window', () => {
    const now = 1_700_000_012_345;
    expect(currentRotatingPassword(seed, now)).toBe(deriveRotatingPassword(seed, windowIndexAt(now)));
  });
});
