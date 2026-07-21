import type { Metadata } from 'next';

/**
 * `page.tsx` here is a client component, so it cannot export metadata itself.
 * This server layout supplies the title, description and canonical.
 *
 * The canonical deliberately points at the bare `/order`: the `?kind=trial`
 * and `?kind=intro` variants are the same document with a package preselected,
 * so they should consolidate rather than compete.
 */
export const metadata: Metadata = {
  title: 'สั่งซื้อแพ็กเกจเช่าเว็บร้านค้ามายคราฟ | ทดลองฟรี 7 วัน เดือนแรก ฿99',
  description:
    'เลือกแพ็กเกจเช่าเว็บร้านค้า Minecraft ของ SIAMSITE เริ่มทดลองฟรี 7 วัน หรือเดือนแรกเพียง ฿99 ไม่ต้องผูกบัตร ติดตั้งอัตโนมัติภายใน 10 นาที',
  keywords:
    'สั่งซื้อเว็บร้านค้ามายคราฟ, ราคาเช่าเว็บมายคราฟ, แพ็กเกจเว็บร้านค้า minecraft, เช่าเว็บมายคราฟทดลองฟรี',
  alternates: { canonical: '/order' },
  openGraph: {
    title: 'สั่งซื้อแพ็กเกจเช่าเว็บร้านค้ามายคราฟ | ทดลองฟรี 7 วัน',
    description:
      'เลือกแพ็กเกจที่เหมาะกับเซิร์ฟของคุณ เริ่มทดลองฟรี 7 วัน หรือเดือนแรก ฿99 ไม่ต้องผูกบัตร',
    url: '/order',
    type: 'website',
    locale: 'th_TH',
  },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
