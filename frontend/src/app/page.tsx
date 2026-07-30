import HomeClient from '@/components/HomeClient';
import { fetchHomeData } from '@/lib/serverSeo';

/**
 * Thin server shell around the (client) home page.
 *
 * It resolves everything the page renders before the response is sent. Two
 * separate problems drove this. The hero carousel holds the LCP element on most
 * shops, and discovering it from the browser meant the image request waited on
 * the JS bundle - Lighthouse measured 5.7s of load delay out of a 12.9s LCP. The
 * six lists below the hero then each swapped a skeleton for content of a
 * different height, which moved the footer twice and was the last remaining
 * layout shift on the site.
 *
 * Every fetch is independently cached server-side, so this does not put the
 * backend on the critical path of each request.
 */
export default async function Page() {
  const home = await fetchHomeData();
  return <HomeClient initial={home} />;
}
