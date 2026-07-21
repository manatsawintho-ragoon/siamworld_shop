import type { Metadata } from 'next';

/**
 * `page.tsx` here is a client component, so it cannot export metadata itself.
 * This server layout supplies the title, description and canonical.
 *
 * Metadata is per locale. Static metadata here meant /en/order rendered an
 * English page under a Thai title and description: wrong in the browser tab,
 * wrong in the SERP, and a language mismatch signal to Google.
 *
 * The canonical deliberately points at the bare order path: the `?kind=trial`
 * and `?kind=intro` variants are the same document with a package preselected,
 * so they should consolidate rather than compete.
 */
export function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Metadata {
  if (locale === 'en') {
    return {
      title: 'Order a Minecraft Webshop Plan | 7-Day Free Trial',
      description:
        'Choose a SIAMSITE Minecraft webshop plan. Start a 7-day free trial with no card required, or take the first month at 99 THB. Your shop is set up automatically in about 10 minutes.',
      keywords:
        'minecraft webshop pricing, minecraft webshop free trial, buy minecraft webshop, minecraft store plan',
      alternates: { canonical: '/en/order' },
      openGraph: {
        title: 'Order a Minecraft Webshop Plan | 7-Day Free Trial',
        description:
          'Pick the plan that fits your server. Free for 7 days, no card required, or first month at 99 THB.',
        url: '/en/order',
        type: 'website',
        locale: 'en_US',
      },
    };
  }

  return {
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
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
