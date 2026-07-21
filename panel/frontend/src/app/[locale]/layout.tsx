import type { Metadata, Viewport } from 'next';
import { kanitLatin, kanitThai } from '@/lib/fonts';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import AppProviders from '@/components/AppProviders';
import '../globals.css';
import FacebookFab from '@/components/FacebookFab';
import { FAQ } from '@/lib/faq';
import {
  SITE_URL,
  SITE_NAME,
  jsonLd,
  organizationSchema,
  websiteSchema,
  ORGANIZATION_ID,
  WEBSITE_ID,
} from '@/lib/seo/site';

/**
 * Self-hosted Kanit. `display: 'swap'` keeps text painted during font load
 * (no invisible-text period) and `preload` on the latin+thai subsets removes
 * the render-blocking round trip to fonts.googleapis.com that the old
 * <link> + CSS @import pair cost us on every page.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Keyword-led, brand last: Google already renders the site name above the
  // title in the SERP, so spending the first 14 characters on "SIAMSITE STORE"
  // pushed the actual keyword past the ~60-char truncation point.
  title: 'เช่าเว็บร้านค้ามายคราฟ ทดลองฟรี 7 วัน เดือนแรก ฿99 | SIAMSITE',
  description: 'บริการเช่าเว็บร้านค้า Minecraft สำเร็จรูปสำหรับเซิร์ฟเวอร์ไทย เริ่มทดลองฟรี 7 วัน หรือเดือนแรกเพียง ฿99 รองรับ PromptPay ตรวจสลิปอัตโนมัติ และ TrueMoney อั่งเปา ใช้ฟรีไม่มีค่าธรรมเนียม เชื่อม RCON ตรงด้วย Bridge Plugin ไม่ต้องตั้ง VPN ติดตั้งจบใน 10 นาที',
  keywords: [
    'เช่าเว็บมายคราฟ',
    'เช่าเว็บมายคราฟราคาถูก',
    'เช่าเว็บมายคราฟทดลองฟรี',
    'ระบบร้านค้ามายคราฟ',
    'เปิดร้านค้ามายคราฟ',
    'เว็บไซต์ Minecraft สำเร็จรูป',
    'ระบบเติมเงิน Minecraft อัตโนมัติ',
    'รับทำเว็บมายคราฟ',
    'Minecraft Store SaaS Thailand',
    'PromptPay Minecraft Shop',
    'EasySlip Minecraft',
    'เว็บมายคราฟเดือนแรก 99',
    'ระบบ Loot Box มายคราฟ',
    'เว็บ RCON มายคราฟ',
    'AuthMe Web Shop Thailand',
    'Minecraft hosting Thailand',
    'เว็บมายคราฟไม่ใช้ VPN',
    'SIAMSITE',
  ].join(', '),
  authors: [{ name: 'SIAMSITE' }],
  // NO `alternates` here. Metadata inherits down the tree, so a canonical set
  // on the layout was being applied to every page that did not override it:
  // /terms, /privacy and /contact were all telling Google they were duplicates
  // of the homepage, which suppresses them from the index. Verified live on
  // production before this change.
  //
  // The homepage declares its own canonical and hreflang pair in
  // app/[locale]/page.tsx. Pages without an explicit canonical now emit none,
  // and Google self-canonicalises, which is the correct default.
  openGraph: {
    title: 'SIAMSITE STORE | ทดลองฟรี 7 วัน · เดือนแรก ฿99 · ระบบเช่าร้านค้า Minecraft ครบวงจร',
    description: 'ยกระดับเซิร์ฟเวอร์มายคราฟสู่ธุรกิจระดับมืออาชีพ เริ่มทดลองฟรี 7 วัน ไม่ต้องผูกบัตร PromptPay + TrueMoney อั่งเปา + RCON ติดตั้งจบใน 10 นาที',
    url: 'https://panel.siamsite.shop',
    siteName: 'SIAMSITE STORE',
    images: [
      {
        url: 'https://panel.siamsite.shop/dashboard-admin.png',
        width: 1200,
        height: 630,
        alt: 'SIAMSITE Admin Dashboard - ระบบจัดการร้านค้ามายคราฟ ทดลองฟรี 7 วัน',
      },
    ],
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIAMSITE STORE | ทดลองฟรี 7 วัน · เดือนแรก ฿99',
    description: 'ระบบร้านค้า Minecraft ที่คนไทยไว้วางใจที่สุด เริ่มฟรี 7 วัน รองรับการเติมเงินอัตโนมัติ 24 ชม.',
    images: ['https://panel.siamsite.shop/dashboard-admin.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Pre-renders both locales at build time. Without this the whole [locale]
 * subtree becomes dynamic and the panel loses its static pages.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleRootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as never)) notFound();

  // Required for static rendering: at build time there is no request for
  // next-intl to infer the locale from.
  setRequestLocale(locale);
  const messages = await getMessages();

  // English pages render no Thai glyphs, so they only apply the Latin variable.
  //
  // NOTE: this does NOT reduce preloading, which was the original hope.
  // next/font emits a <link rel="preload"> for every font instance imported
  // into a route's module graph, regardless of whether its CSS variable is
  // applied. Because this layout imports both instances, all 10 files preload
  // on both locales (measured: 10 on /en and 10 on /). Making preloading
  // locale-aware would require the two locales to resolve different layout
  // modules, which the App Router does not offer.
  //
  // The alternative is preload: false in lib/fonts.ts, letting the
  // unicode-range on each instance pull only the subsets a page actually
  // renders. That genuinely would cut English pages to the Latin files, at the
  // cost of discovering fonts during CSS parse rather than up front, which
  // hurts the Thai-speaking majority. Left as-is deliberately; it is a real
  // tradeoff, not an oversight.
  const fontClass =
    locale === 'en' ? kanitLatin.variable : `${kanitLatin.variable} ${kanitThai.variable}`;

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SIAMSITE STORE",
    "operatingSystem": "Web",
    "applicationCategory": "BusinessApplication",
    "description": "ระบบเช่าเว็บร้านค้า Minecraft สำเร็จรูป รองรับ PromptPay + EasySlip + RCON พร้อมทดลองฟรี 7 วัน",
    "url": "https://panel.siamsite.shop",
    "offers": [
      {
        "@type": "Offer",
        "name": "ทดลองฟรี 7 วัน",
        "price": "0",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock",
        "category": "Free Trial",
        "eligibleDuration": { "@type": "QuantitativeValue", "value": 7, "unitCode": "DAY" }
      },
      {
        "@type": "Offer",
        "name": "ทดลองเดือนแรก ฿99",
        "price": "99",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock",
        "category": "Introductory Offer"
      },
      {
        "@type": "Offer",
        "name": "แพ็กเกจ 1 เดือน",
        "price": "249",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "แพ็กเกจ 3 เดือน",
        "price": "599",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "แพ็กเกจ 6 เดือน",
        "price": "1099",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock"
      }
    ]
    // NOTE: no aggregateRating here. Google's review snippet policy disallows
    // self-serving ratings that aren't backed by real, user-submitted reviews
    // shown on the page. Re-add only when genuine reviews are collected and
    // rendered.
  };

  // Mirrors the FAQ rendered on the landing page. Both read FAQ from
  // lib/faq.ts so the structured data can never describe questions that
  // aren't actually visible on the page.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQ.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": { "@type": "Answer", "text": item.a },
    })),
  };

  // Organization and WebSite now come from lib/seo/site.ts with stable @id values,
  // so every other page's JSON-LD can reference the same entity by @id instead of
  // restating a slightly different copy of the publisher on each URL.
  return (
    <html lang={locale} className={fontClass}>
      <head>
        {/* Icons are inline SVG via components/ui/icon.tsx (lucide-react) - no icon webfont.
            Kanit is self-hosted by next/font, so there are no font CDN preconnects either. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd({ ...softwareSchema, publisher: { '@id': ORGANIZATION_ID }, isPartOf: { '@id': WEBSITE_ID } }) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }}
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AppProviders>
            {children}
            <FacebookFab />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
