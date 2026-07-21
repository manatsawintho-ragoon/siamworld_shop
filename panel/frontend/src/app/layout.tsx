import type { Metadata, Viewport } from 'next';
import { Kanit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import SessionToastBridge from '@/components/SessionToastBridge';
import PageTitleManager from '@/components/PageTitle';
import ActivityTracker from '@/components/ActivityTracker';
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
const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-kanit',
  preload: true,
});

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
  alternates: {
    canonical: '/',
    languages: {
      'th-TH': `${SITE_URL}/`,
      en: `${SITE_URL}/en`,
      'x-default': `${SITE_URL}/`,
    },
  },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
    <html lang="th" className={kanit.variable}>
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
        <ToastProvider><AuthProvider><SessionToastBridge /><PageTitleManager /><ActivityTracker />{children}<FacebookFab /></AuthProvider></ToastProvider>
      </body>
    </html>
  );
}
