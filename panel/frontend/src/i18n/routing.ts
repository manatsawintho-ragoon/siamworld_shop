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
});

export type Locale = (typeof routing.locales)[number];
