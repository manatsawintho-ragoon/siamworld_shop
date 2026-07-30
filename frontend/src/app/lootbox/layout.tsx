import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'กล่องสุ่ม',
  description: 'เปิดกล่องสุ่มไอเทมหายากในเซิร์ฟเวอร์ Minecraft ลุ้นรางวัลระดับ Mythic รับของเข้าเกมอัตโนมัติ',
};

// Deliberately not gated on show_lootbox_nav. Unlike Rewards and News, the home
// page links straight into /lootbox/[id] from the gacha widgets, so a shop that
// hides the menu item but keeps those widgets is a supported configuration -
// closing the route would break its buy path.
export default function LootboxLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
