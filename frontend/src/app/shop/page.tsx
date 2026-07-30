import ShopClient from '@/components/ShopClient';
import { fetchShopPageData } from '@/lib/serverSeo';

/**
 * Server shell for /shop.
 *
 * The catalogue is resolved before the response is sent, for the same two
 * reasons as the home page: the client-side fetch made the product grid swap a
 * skeleton for real content after hydration (0.34 CLS, the largest shift left on
 * the site), and it kept every product name and price out of the HTML a crawler
 * or an agent sees on a shop's most important page.
 */
export default async function Page() {
  const initial = await fetchShopPageData();
  return <ShopClient initial={initial} />;
}
