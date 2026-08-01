import { notFound } from 'next/navigation';

/**
 * Catch-all that exists purely to route unmatched customer URLs into
 * [locale]/not-found.tsx.
 *
 * Next.js only serves a `not-found.tsx` for an unmatched URL when it is the ROOT
 * app/not-found.tsx; a segment-level one is reached only by an explicit
 * notFound() call. This app cannot have a root not-found: it has two root
 * layouts ([locale] and (operator)), which Next permits only while nothing sits
 * above them, and a root not-found.tsx demands a root layout. So /nope was
 * served by Next's unstyled built-in 404 instead of ours.
 *
 * Matching the URL here and immediately calling notFound() puts the miss inside
 * the [locale] segment, where our 404 (and the locale layout, fonts and
 * translations) applies. Catch-alls are the lowest-priority match in the App
 * Router, so this can never shadow a real page.
 */
export default function CatchAllNotFound() {
  notFound();
}
