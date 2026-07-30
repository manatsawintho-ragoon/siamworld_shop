import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchShopSeo, isFeatureEnabled } from '@/lib/serverSeo';

export const metadata: Metadata = {
  title: 'แลกของรางวัล',
  description: 'นำแต้มสะสมจากการเติมเงินมาแลกของรางวัลในเซิร์ฟเวอร์ ตรวจสอบแต้มคงเหลือและของรางวัลที่แลกได้',
};

/**
 * Turning the Reward Shop off in the admin panel hid its nav links but left the
 * page itself reachable by URL, so a disabled feature was still one typed path
 * away (and still indexable). The check belongs here rather than in the page:
 * the settings fetch is already cached and shared with the layout above, so it
 * costs nothing, and a signed-out visitor never sees a flash of the shop first.
 */
export default async function RewardsLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await fetchShopSeo();
  if (!isFeatureEnabled(settings, 'show_rewards_nav')) redirect('/');
  return <>{children}</>;
}
