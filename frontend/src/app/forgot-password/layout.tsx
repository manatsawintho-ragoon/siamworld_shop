import type { Metadata } from 'next';

// noindex on both password routes: an indexed reset form is a phishing target
// and a support-ticket generator, and the reset URL carries a one-time token.
export const metadata: Metadata = {
  title: 'ลืมรหัสผ่าน',
  description: 'ขอรหัส OTP ทางอีเมลเพื่อตั้งรหัสผ่านใหม่สำหรับบัญชีในเกมของคุณ',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
