import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'เติมเงิน',
  description: 'เติมเงินเข้ากระเป๋าอัตโนมัติผ่าน PromptPay และ TrueMoney ตรวจสลิปอัตโนมัติ รวดเร็วปลอดภัย 24 ชั่วโมง',
};

export default function TopupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
