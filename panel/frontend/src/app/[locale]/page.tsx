import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ThaiHome from '@/components/marketing/ThaiHome';
import EnglishHome from '@/components/marketing/EnglishHome';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The Thai and English homepages are different documents, not translations:
 * the Thai page is the long-form sales page, the English one is purpose-built
 * for the English keyword set. So this route dispatches on locale rather than
 * rendering one body with swapped strings.
 *
 * These two ARE a genuine translation pair for hreflang purposes (unlike the
 * landing pages), which is why both sides declare the reciprocal alternates.
 */
export function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Metadata {
  const alternates = {
    canonical: locale === 'en' ? '/en' : '/',
    languages: {
      'th-TH': `${SITE_URL}/`,
      en: `${SITE_URL}/en`,
      'x-default': `${SITE_URL}/`,
    },
  };

  if (locale === 'en') {
    return {
      title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
      description:
        'Hosted Minecraft webshop for Thai and SEA servers. AuthMe login, PromptPay and TrueMoney top-ups with automatic slip verification, and instant RCON item delivery. Free 7-day trial, no card required.',
      keywords: [
        'minecraft webshop',
        'minecraft webstore',
        'minecraft server webshop',
        'minecraft donation store',
        'hosted minecraft webshop',
        'tebex alternative',
        'minecraft server monetization',
      ].join(', '),
      alternates,
      openGraph: {
        title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
        description:
          'AuthMe login, PromptPay and TrueMoney top-ups, and instant RCON delivery. A hosted Minecraft webshop built for Thai and Southeast Asian servers.',
        url: '/en',
        type: 'website',
        locale: 'en_US',
        images: [
          {
            url: `${SITE_URL}/dashboard-admin.png`,
            width: 1200,
            height: 630,
            alt: 'SIAMSITE admin dashboard showing Minecraft webshop sales and orders',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
        description:
          'Hosted Minecraft webshop with AuthMe login, PromptPay top-ups and instant RCON delivery.',
        images: [`${SITE_URL}/dashboard-admin.png`],
      },
    };
  }

  return { alternates };
}

export default function Home({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return locale === 'en' ? <EnglishHome /> : <ThaiHome />;
}
