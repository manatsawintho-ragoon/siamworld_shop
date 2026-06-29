import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ร้านค้า',
  description: 'เลือกซื้อไอเทม ยศ และสิทธิพิเศษในเซิร์ฟเวอร์ Minecraft รับของอัตโนมัติทันทีหลังชำระเงิน',
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
