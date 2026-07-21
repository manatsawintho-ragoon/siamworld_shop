import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ThaiSolutions from '@/components/marketing/ThaiSolutions';
import EnglishSolutions from '@/components/marketing/EnglishSolutions';

/**
 * Like the homepages, the two hubs list different page sets (16 Thai landing
 * pages vs 13 English ones), so they dispatch rather than share a body.
 *
 * No hreflang pair here: the hubs index non-equivalent content.
 */
export function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Metadata {
  if (locale === 'en') {
    return {
      title: 'Minecraft Webshop Guides, Features And Comparisons',
      description:
        'Every guide to running a hosted Minecraft webshop: payments, RCON delivery, loot boxes, rank shops, server compatibility, pricing and how it compares to Tebex.',
      keywords:
        'minecraft webshop, minecraft webstore, minecraft donation store, tebex alternative, minecraft rcon, minecraft lootbox, minecraft server monetization',
      alternates: { canonical: '/en/solutions' },
      openGraph: {
        title: 'Minecraft Webshop Guides, Features And Comparisons',
        description: 'Guides and feature breakdowns for running a hosted Minecraft webshop.',
        url: '/en/solutions',
        type: 'website',
        locale: 'en_US',
      },
    };
  }

  return {
    title: 'บริการเช่าเว็บร้านค้า Minecraft ทั้งหมด | คู่มือและฟีเจอร์',
    description:
      'รวมบริการและคู่มือเช่าเว็บร้านค้า Minecraft: ระบบเติมเงิน PromptPay/TrueMoney, ส่งของอัตโนมัติผ่าน RCON, กล่องสุ่ม, ตามประเภทเซิร์ฟเวอร์ และทางเลือกแทน Tebex สำหรับเซิร์ฟไทย',
    keywords:
      'เช่าเว็บร้านค้ามายคราฟ, ระบบร้านค้า minecraft, webshop minecraft, เติมเงินมายคราฟ, ทางเลือกแทน tebex, กล่องสุ่ม minecraft',
    alternates: { canonical: '/solutions' },
    openGraph: {
      title: 'บริการเช่าเว็บร้านค้า Minecraft ทั้งหมด',
      description: 'รวมบริการและคู่มือเช่าเว็บร้านค้า Minecraft สำหรับเจ้าของเซิร์ฟเวอร์ไทย',
      url: '/solutions',
      type: 'website',
      locale: 'th_TH',
    },
  };
}

export default function Solutions({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return locale === 'en' ? <EnglishSolutions /> : <ThaiSolutions />;
}
