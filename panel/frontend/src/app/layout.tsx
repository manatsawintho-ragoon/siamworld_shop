import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import SessionToastBridge from '@/components/SessionToastBridge';
import PageTitleManager from '@/components/PageTitle';

export const metadata: Metadata = {
  metadataBase: new URL('https://panel.siamsite.shop'),
  title: 'SIAMSITE STORE | เช่าเว็บร้านค้ามายคราฟ ทดลองฟรี 7 วัน เดือนแรก ฿99',
  description: 'บริการเช่าเว็บร้านค้า Minecraft สำเร็จรูปที่ดีที่สุดในไทย เริ่มทดลองฟรี 7 วัน หรือเดือนแรกเพียง ฿99 รองรับ PromptPay + EasySlip ตรวจสลิปอัตโนมัติ เชื่อม RCON ตรงด้วย Bridge Plugin ไม่ต้องตั้ง VPN ติดตั้งจบใน 10 นาที',
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
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SIAMSITE STORE | ทดลองฟรี 7 วัน · เดือนแรก ฿99 · ระบบเช่าร้านค้า Minecraft ครบวงจร',
    description: 'ยกระดับเซิร์ฟเวอร์มายคราฟสู่ธุรกิจระดับมืออาชีพ เริ่มทดลองฟรี 7 วัน ไม่ต้องผูกบัตร PromptPay + EasySlip + RCON ติดตั้งจบใน 10 นาที',
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
        "name": "เดือนแรกพิเศษ ฿99",
        "price": "99",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock",
        "category": "Introductory Offer"
      },
      {
        "@type": "Offer",
        "name": "แพ็กเกจ 1 เดือน",
        "price": "350",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "แพ็กเกจ 3 เดือน",
        "price": "945",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "แพ็กเกจ 6 เดือน",
        "price": "1785",
        "priceCurrency": "THB",
        "availability": "https://schema.org/InStock"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "20"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "ทดลองฟรี 7 วัน ใช้ได้จริงไหม ต้องผูกบัตรหรือเปล่า?",
        "acceptedAnswer": { "@type": "Answer", "text": "ใช้ได้จริงและไม่ต้องผูกบัตรใดๆ สมัครด้วยอีเมลแล้วเริ่มสร้างร้านได้เลย จำกัด 1 สิทธิ์ต่อบัญชีและต่อ IP เพื่อป้องกันการใช้ซ้ำ ครบ 7 วันระบบจะปิดร้านอัตโนมัติหากไม่อัปเกรด" }
      },
      {
        "@type": "Question",
        "name": "โปรเดือนแรก ฿99 หมดเขตเมื่อไหร่ และเดือนถัดไปคิดเท่าไหร่?",
        "acceptedAnswer": { "@type": "Answer", "text": "โปรเดือนแรก ฿99 ใช้ได้กับลูกค้าใหม่ จำกัด 1 สิทธิ์ต่อบัญชี เดือนถัดไปคิดราคาปกติ ฿350 ต่อเดือน ยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัด" }
      },
      {
        "@type": "Question",
        "name": "ต้องตั้ง VPN เพื่อเชื่อมเซิร์ฟเวอร์มายคราฟไหม?",
        "acceptedAnswer": { "@type": "Answer", "text": "ไม่จำเป็น แนะนำใช้ Bridge Plugin ของเรา วางไฟล์ .jar ลงใน /plugins ใส่ token แล้วปลั๊กอินจะเชื่อมต่อกลับมาเองอัตโนมัติ ไม่ต้องเปิด port ไม่ต้องตั้ง VPN ใช้ได้กับเซิร์ฟเวอร์หลัง NAT หรือ ISP ทั่วไปได้เลย" }
      },
      {
        "@type": "Question",
        "name": "ราคารวมค่าธรรมเนียม EasySlip API ไหม?",
        "acceptedAnswer": { "@type": "Answer", "text": "ราคาแพ็กเกจรายเดือนไม่รวมค่าธรรมเนียม EasySlip API ซึ่งคิดสูงสุด ฿0.396 ต่อรายการตรวจสลิป โดยจะหักจากยอดเติมเงินของลูกค้าเท่านั้น ไม่กระทบยอดค่าเช่ารายเดือน" }
      },
      {
        "@type": "Question",
        "name": "ติดตั้งเว็บร้านค้า Minecraft นานไหม?",
        "acceptedAnswer": { "@type": "Answer", "text": "ระบบเป็นแบบอัตโนมัติเต็มรูปแบบ หลังชำระเงินเสร็จสิ้น เว็บไซต์ของคุณจะออนไลน์ภายใน 5-10 นาที" }
      },
      {
        "@type": "Question",
        "name": "รองรับการเติมเงินช่องทางไหนบ้าง?",
        "acceptedAnswer": { "@type": "Answer", "text": "รองรับ PromptPay QR Code พร้อมระบบตรวจสอบสลิปอัตโนมัติด้วย EasySlip และ TrueMoney Gift Card" }
      }
    ]
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SIAMSITE STORE",
    "url": "https://panel.siamsite.shop",
    "logo": "https://panel.siamsite.shop/dashboard-admin.png",
    "sameAs": ["https://www.facebook.com/siamsitestore"]
  };

  return (
    <html lang="th">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body>
        <ToastProvider><AuthProvider><SessionToastBridge /><PageTitleManager />{children}</AuthProvider></ToastProvider>
      </body>
    </html>
  );
}
