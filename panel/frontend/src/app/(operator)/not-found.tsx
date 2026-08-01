import Link from 'next/link';
import { StatusScreen } from '@/components/StatusScreen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

/**
 * 404 for the operator back office.
 *
 * Thai-only and untranslated, matching the rest of the (operator) tree - there
 * is no NextIntlClientProvider above this layout, so useTranslations would throw.
 */
export default function OperatorNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <StatusScreen
        variant="warning"
        icon="magnifying-glass"
        title="ไม่พบหน้าที่คุณเปิด"
        description="หน้านี้อาจถูกย้าย เปลี่ยนชื่อ หรือลิงก์ที่ใช้พิมพ์ผิด"
        actions={
          <Button asChild className="rounded-full px-8 h-12 font-bold">
            <Link href="/admin">
              <Icon name="gauge-high" className="mr-2" />
              กลับหน้าแอดมิน
            </Link>
          </Button>
        }
      />
    </div>
  );
}
