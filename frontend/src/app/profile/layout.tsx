import type { Metadata } from 'next';

// Signed-in-only page: it has nothing to offer a crawler and every URL under it
// is per-user, so it is titled properly for the tab and kept out of the index.
export const metadata: Metadata = {
  title: 'โปรไฟล์ของฉัน',
  description: 'จัดการข้อมูลบัญชี ยอดเงินคงเหลือ และประวัติการทำรายการของคุณ',
  robots: { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
