import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ตั้งรหัสผ่านใหม่',
  description: 'ยืนยันรหัส OTP และตั้งรหัสผ่านใหม่สำหรับบัญชีในเกมของคุณ',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
