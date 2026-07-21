import { describe, expect, it } from 'vitest';
import { localeOf, localePath, hasDirectCounterpart } from '@/lib/seo/locale-path';

/**
 * Characterisation tests: these pin the behaviour that exists today so the
 * next-intl migration cannot change it silently. The switcher is the only
 * place a user can move between languages, and every failure mode here is
 * invisible until someone clicks it on the wrong page.
 */

describe('localeOf', () => {
  it('treats bare paths as Thai', () => {
    expect(localeOf('/')).toBe('th');
    expect(localeOf('/dashboard')).toBe('th');
  });

  it('detects the English tree', () => {
    expect(localeOf('/en')).toBe('en');
    expect(localeOf('/en/solutions')).toBe('en');
  });

  it('does not mistake a path merely starting with "en" for English', () => {
    expect(localeOf('/enterprise')).toBe('th');
  });
});

describe('localePath', () => {
  it('maps the homepages to each other', () => {
    expect(localePath('/', 'en')).toBe('/en');
    expect(localePath('/en', 'th')).toBe('/');
  });

  it('maps the solutions hubs to each other', () => {
    expect(localePath('/solutions', 'en')).toBe('/en/solutions');
    expect(localePath('/en/solutions', 'th')).toBe('/solutions');
  });

  it('maps a Thai landing page to its English topic counterpart', () => {
    expect(localePath('/lp/ทางเลือกแทน-tebex', 'en')).toBe('/en/lp/tebex-alternative');
  });

  it('maps an English landing page back to a Thai one', () => {
    expect(localePath('/en/lp/tebex-alternative', 'th')).toBe(
      '/lp/' + encodeURIComponent('ทางเลือกแทน-tebex'),
    );
  });

  it('falls back to the hub when a landing page has no counterpart', () => {
    expect(localePath('/lp/ไม่มีอยู่จริง', 'en')).toBe('/en/solutions');
    expect(localePath('/en/lp/does-not-exist', 'th')).toBe('/solutions');
  });

  it('falls back to home for untranslated areas', () => {
    expect(localePath('/dashboard/topup', 'en')).toBe('/en');
    expect(localePath('/terms', 'en')).toBe('/en');
  });

  it('returns the same path when the target locale already matches', () => {
    expect(localePath('/dashboard', 'th')).toBe('/dashboard');
    expect(localePath('/en/solutions', 'en')).toBe('/en/solutions');
  });

  it('strips query and hash before mapping', () => {
    expect(localePath('/solutions?utm=x', 'en')).toBe('/en/solutions');
    expect(localePath('/#pricing', 'en')).toBe('/en');
  });

  it('tolerates a trailing slash', () => {
    expect(localePath('/solutions/', 'en')).toBe('/en/solutions');
  });

  it('handles an already-encoded Thai slug', () => {
    const encoded = '/lp/' + encodeURIComponent('ทางเลือกแทน-tebex');
    expect(localePath(encoded, 'en')).toBe('/en/lp/tebex-alternative');
  });
});

describe('hasDirectCounterpart', () => {
  it('is true for pages that genuinely exist in both languages', () => {
    expect(hasDirectCounterpart('/', 'en')).toBe(true);
    expect(hasDirectCounterpart('/solutions', 'en')).toBe(true);
    expect(hasDirectCounterpart('/lp/ทางเลือกแทน-tebex', 'en')).toBe(true);
  });

  it('is false for untranslated areas', () => {
    expect(hasDirectCounterpart('/dashboard', 'en')).toBe(false);
    expect(hasDirectCounterpart('/terms', 'en')).toBe(false);
  });

  it('is false for a landing page with no counterpart', () => {
    expect(hasDirectCounterpart('/lp/ไม่มีอยู่จริง', 'en')).toBe(false);
  });
});
