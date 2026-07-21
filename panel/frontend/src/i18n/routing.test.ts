import { describe, expect, it } from 'vitest';
import { routing } from './routing';
import th from '../../messages/th.json';
import en from '../../messages/en.json';

/** Flattens {a: {b: 'x'}} to ['a.b'] so a missing nested key is visible. */
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, path)
      : [path];
  });
}

function values(obj: Record<string, unknown>): string[] {
  return Object.values(obj).flatMap((v) =>
    v !== null && typeof v === 'object' ? values(v as Record<string, unknown>) : [String(v)],
  );
}

describe('routing config', () => {
  it('keeps Thai as the unprefixed default', () => {
    // These three values ARE the guarantee that indexed Thai URLs do not move.
    expect(routing.defaultLocale).toBe('th');
    expect(routing.localePrefix).toBe('as-needed');
    expect(routing.locales).toEqual(['th', 'en']);
  });
});

describe('messages', () => {
  it('defines exactly the same keys in both locales', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(th).sort());
  });

  it('has no empty strings', () => {
    expect(values(th).filter((v) => !v.trim())).toEqual([]);
    expect(values(en).filter((v) => !v.trim())).toEqual([]);
  });

  it('uses no em dashes in user-facing copy', () => {
    // House rule: em dashes read as unprofessional in this product's copy.
    expect(values(th).filter((v) => v.includes('—'))).toEqual([]);
    expect(values(en).filter((v) => v.includes('—'))).toEqual([]);
  });
});
