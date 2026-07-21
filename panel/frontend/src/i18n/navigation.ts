import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and next/navigation. Using these
 * instead of the raw Next equivalents is what keeps a link on an English page
 * pointing at the English route without every call site hardcoding '/en'.
 *
 * usePathname here returns the path WITHOUT the locale prefix, which is what
 * lib/seo/locale-path.ts expects for Thai paths.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
