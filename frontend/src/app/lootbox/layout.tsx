import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'กล่องสุ่ม',
  description: 'เปิดกล่องสุ่มไอเทมหายากในเซิร์ฟเวอร์ Minecraft ลุ้นรางวัลระดับ Mythic รับของเข้าเกมอัตโนมัติ',
};

export default function LootboxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
