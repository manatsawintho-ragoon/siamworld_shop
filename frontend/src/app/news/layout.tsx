import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchShopSeo, isFeatureEnabled } from '@/lib/serverSeo';

export const metadata: Metadata = {
  title: 'ข่าวสาร',
  description: 'ข่าวสาร แพตช์โน้ต กิจกรรม และประกาศอัปเดตล่าสุดของเซิร์ฟเวอร์ อ่านรายละเอียดพร้อมรูปภาพและวิดีโอ',
};

/**
 * Same reason as the Reward Shop: switching News off used to hide the nav entry
 * and nothing else, leaving /news and every article live for anyone with the
 * link. This covers /news/[slug] too, since that route nests under here.
 */
export default async function NewsLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await fetchShopSeo();
  if (!isFeatureEnabled(settings, 'show_news_nav')) redirect('/');
  return <>{children}</>;
}
