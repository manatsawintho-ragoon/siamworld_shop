'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { StatusScreen, StatusDetailRow } from '@/components/StatusScreen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

/**
 * Runtime error boundary for the operator back office. Thai-only, same reason as
 * (operator)/not-found.tsx: no next-intl provider in this tree.
 */
export default function OperatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[panel/admin] unhandled render error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <StatusScreen
        variant="error"
        title="ระบบขัดข้องชั่วคราว"
        description="หน้านี้โหลดไม่สำเร็จ ลองใหม่อีกครั้ง หากยังไม่หายให้ดู log ของ panel-frontend"
        detail={error.digest ? <StatusDetailRow label="รหัสอ้างอิง" value={error.digest} /> : undefined}
        actions={
          <>
            <Button onClick={reset} className="rounded-full px-8 h-12 font-bold">
              <Icon name="arrows-rotate" className="mr-2" />
              ลองใหม่อีกครั้ง
            </Button>
            <Button
              asChild
              variant="secondary"
              className="rounded-full px-8 h-12 font-bold border border-border"
            >
              <Link href="/admin">
                <Icon name="gauge-high" className="mr-2" />
                กลับหน้าแอดมิน
              </Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
