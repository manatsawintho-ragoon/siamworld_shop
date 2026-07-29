import { defineRouting } from 'next-intl/routing';

/**
 * Thai is the default locale and renders WITHOUT a prefix, which is the whole
 * point of 'as-needed': every existing Thai URL (/, /solutions, /order,
 * /lp/<thai-slug>) stays exactly as it is today. English gets the /en prefix,
 * which is where the English marketing pages already live.
 *
 * Changing defaultLocale or localePrefix changes indexed URLs. Do not.
 */
export const routing = defineRouting({
  locales: ['th', 'en'],
  defaultLocale: 'th',
  localePrefix: 'as-needed',
  /**
   * The URL decides the language, nothing else.
   *
   * With detection on, visiting /en made the middleware remember English in a
   * NEXT_LOCALE cookie, and Thai lives on the unprefixed '/'. So every later
   * request for '/' was answered with 307 -> /en: once a reader switched to
   * English they could never get back to Thai, and the language switcher looked
   * broken. Accept-Language detection has the same effect for anyone whose
   * browser prefers English.
   *
   * Turning detection off also keeps '/' cacheable, since it no longer varies
   * per visitor.
   */
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
