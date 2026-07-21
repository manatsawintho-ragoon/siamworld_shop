/**
 * Single source of truth for site-wide SEO constants.
 *
 * The base URL used to be re-declared as a `const BASE` in every page that
 * emitted JSON-LD, so a domain change meant hunting down string literals and
 * any one that was missed would ship absolute URLs pointing at the old host.
 */

export const SITE_URL = 'https://panel.siamsite.shop';
export const SITE_NAME = 'SIAMSITE STORE';
export const FACEBOOK_URL = 'https://www.facebook.com/siamsitestore';
export const DISCORD_URL = 'https://discord.gg/HysqVHra5n';

export type Locale = 'th' | 'en';

/** Absolute URL for a site-relative path. */
export function abs(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * hreflang map for a page that exists in both languages.
 *
 * `thPath` is the canonical Thai path and `enPath` its English twin. x-default
 * points at Thai: the product is Thailand-only (PromptPay / TrueMoney / THB),
 * so Thai is the correct fallback for an unmatched locale, not English.
 *
 * Google requires these to be reciprocal - if the Thai page names the English
 * one, the English page must name the Thai one back, or both are ignored.
 */
export function languageAlternates(thPath: string, enPath: string) {
  return {
    canonical: thPath,
    languages: {
      'th-TH': abs(thPath),
      en: abs(enPath),
      'x-default': abs(thPath),
    },
  };
}

/** Same map, but canonical points at the English side. */
export function languageAlternatesEn(thPath: string, enPath: string) {
  return {
    canonical: enPath,
    languages: {
      'th-TH': abs(thPath),
      en: abs(enPath),
      'x-default': abs(thPath),
    },
  };
}

/** Serialize JSON-LD safely for dangerouslySetInnerHTML. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Organization node, referenced by @id from other schema graphs so Google can
 * resolve the publisher entity instead of seeing a duplicate org per page.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/images/logosiamsite-256.png`,
    width: 256,
    height: 256,
  },
  description:
    'Hosted Minecraft webshop platform for Thai and Southeast Asian servers, with PromptPay and TrueMoney top-ups, automatic slip verification, and RCON item delivery.',
  areaServed: { '@type': 'Country', name: 'Thailand' },
  knowsLanguage: ['th', 'en'],
  sameAs: [FACEBOOK_URL, DISCORD_URL],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: `${SITE_URL}/contact`,
      availableLanguage: ['Thai', 'English'],
    },
  ],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: ['th-TH', 'en'],
  publisher: { '@id': ORGANIZATION_ID },
};
