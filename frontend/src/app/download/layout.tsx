import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ดาวน์โหลด',
  description: 'ดาวน์โหลดไฟล์และทรัพยากรสำหรับเข้าเล่นเซิร์ฟเวอร์ Minecraft',
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
