import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'SIAMSITE STORE | ร้านค้ามายคราฟอัตโนมัติที่ดีที่สุด',
  description: 'ซื้อไอเท็ม Minecraft เติมเงินอัตโนมัติ รับของทันที 24 ชั่วโมง ระบบที่รวดเร็วและปลอดภัยที่สุดสำหรับคุณ',
  keywords: 'ร้านค้ามายคราฟ, เติมเงินมายคราฟ, ซื้อไอเท็มมายคราฟ, Minecraft Store, PromptPay, TrueMoney',
  openGraph: {
    title: 'SIAMSITE STORE | ร้านค้ามายคราฟอัตโนมัติที่ดีที่สุด',
    description: 'ซื้อไอเท็ม Minecraft เติมเงินอัตโนมัติ รับของทันที 24 ชั่วโมง',
    type: 'website',
    locale: 'th_TH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIAMSITE STORE | ร้านค้ามายคราฟอัตโนมัติที่ดีที่สุด',
    description: 'ซื้อไอเท็ม Minecraft เติมเงินอัตโนมัติ รับของทันที 24 ชั่วโมง',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Prompt:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="font-sans bg-background text-foreground min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
