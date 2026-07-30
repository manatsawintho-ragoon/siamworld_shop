import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'คลังของฉัน',
  description: 'ไอเทมที่ได้จากกล่องสุ่มและรอการส่งเข้าเกม กดรับของเข้าเซิร์ฟเวอร์ได้จากหน้านี้',
  robots: { index: false, follow: false },
};

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
