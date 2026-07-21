import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Home_ from '@/components/marketing/ThaiHome';
import { FAQ } from '@/lib/faq';
import {
  SITE_URL,
  SITE_NAME,
  jsonLd,
  ORGANIZATION_ID,
  WEBSITE_ID,
} from '@/lib/seo/site';

/**
 * One homepage, rendered in either language. The two URLs are a genuine
 * translation pair, which is why both sides declare reciprocal hreflang.
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

  // ONE homepage for both languages.
  //
  // This previously rendered a separate, purpose-built English marketing page
  // for /en, which meant switching language replaced the whole site with a
  // different design instead of translating the page you were on. That is not
  // a language switcher, it is two websites. The owner asked for the original
  // page back, translated - so both locales render the same component and the
  // strings come from the message files.
  // These used to sit in the layout and therefore appeared on every page,
  // including /order and the English tree: a Thai FAQPage describing questions
  // the page never rendered. Google requires FAQ markup to match visible
  // content, so it belongs on the one page that actually shows the FAQ.
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description:
      'ระบบเช่าเว็บร้านค้า Minecraft สำเร็จรูป รองรับ PromptPay + EasySlip + RCON พร้อมทดลองฟรี 7 วัน',
    url: SITE_URL,
    inLanguage: locale,
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
    // No aggregateRating: Google's review snippet policy disallows self-serving
    // ratings not backed by real reviews rendered on the page.
    offers: [
      { '@type': 'Offer', name: 'ทดลองฟรี 7 วัน', price: '0', priceCurrency: 'THB', availability: 'https://schema.org/InStock', category: 'Free Trial', eligibleDuration: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' } },
      { '@type': 'Offer', name: 'ทดลองเดือนแรก ฿99', price: '99', priceCurrency: 'THB', availability: 'https://schema.org/InStock', category: 'Introductory Offer' },
      { '@type': 'Offer', name: 'แพ็กเกจ 1 เดือน', price: '249', priceCurrency: 'THB', availability: 'https://schema.org/InStock' },
      { '@type': 'Offer', name: 'แพ็กเกจ 3 เดือน', price: '599', priceCurrency: 'THB', availability: 'https://schema.org/InStock' },
      { '@type': 'Offer', name: 'แพ็กเกจ 6 เดือน', price: '1099', priceCurrency: 'THB', availability: 'https://schema.org/InStock' },
    ],
  };

  // Reads the same FAQ source the page renders, so the structured data can
  // never describe questions that are not actually visible.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }} />
      <Home_ />
    </>
  );
}
