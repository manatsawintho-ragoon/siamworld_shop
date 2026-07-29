import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ข่าวสาร',
  description: 'ข่าวสาร แพตช์โน้ต กิจกรรม และประกาศอัปเดตล่าสุดของเซิร์ฟเวอร์ อ่านรายละเอียดพร้อมรูปภาพและวิดีโอ',
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
