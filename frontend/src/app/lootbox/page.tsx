import LootBoxListClient from '@/components/LootBoxListClient';
import { fetchLootBoxes } from '@/lib/serverSeo';

/** Server shell for /lootbox - see app/shop/page.tsx for the reasoning. */
export default async function Page() {
  const boxes = await fetchLootBoxes();
  return <LootBoxListClient initial={boxes as never} />;
}
