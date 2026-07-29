import HomeClient from '@/components/HomeClient';
import { fetchPublicSlides } from '@/lib/serverSeo';

/**
 * Thin server shell around the (client) home page.
 *
 * Its only job is to resolve the hero slides before the response is sent. The
 * carousel holds the LCP element on most shops, and discovering it from the
 * browser meant the image request waited on the JS bundle: Lighthouse measured
 * 5.7s of load delay out of a 12.9s LCP. Everything else on the page is still
 * fetched client-side, because none of it is above the fold.
 */
export default async function Page() {
  const slides = await fetchPublicSlides();
  return <HomeClient initialSlides={slides} />;
}
