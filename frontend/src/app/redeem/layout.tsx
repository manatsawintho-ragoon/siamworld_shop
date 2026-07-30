import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'แลกโค้ด',
  description: 'กรอกโค้ดเพื่อรับเครดิตหรือไอเทมในเซิร์ฟเวอร์ ใช้ได้หนึ่งครั้งต่อหนึ่งบัญชี',
  robots: { index: false, follow: false },
};

export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
