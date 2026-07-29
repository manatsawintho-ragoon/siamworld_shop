import { describe, expect, it } from 'vitest';
import { routing } from './routing';
import { MOCK_SLIDES } from '@/components/landing/UiMocks';
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

  it('never infers the locale from cookie or Accept-Language', () => {
    // Thai is the unprefixed '/', so a remembered "en" turns every later
    // request for '/' into a 307 to /en and strands the reader in English with
    // no way back. The URL is the only thing allowed to choose the language.
    expect(routing.localeDetection).toBe(false);
  });
});

describe('showcase slides', () => {
  it('names a real message in both locales for every slide', () => {
    // MOCK_SLIDES stores message keys, not text. A key with no message renders
    // as itself, which is how "topupAuto" and "payDesc" reached the page.
    const missing = MOCK_SLIDES.flatMap((slide) =>
      [slide.title, slide.desc].flatMap((key) => [
        ...(key in th.home ? [] : [`th.home.${key}`]),
        ...(key in en.home ? [] : [`en.home.${key}`]),
      ]),
    );
    expect(missing).toEqual([]);
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
