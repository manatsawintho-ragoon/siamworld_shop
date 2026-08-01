'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw, Home } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import StatusScreen, { StatusDetailRow } from '@/components/StatusScreen';

/**
 * Runtime error boundary for the shop.
 *
 * Without it, a thrown render error showed Next.js's "Application error: a
 * client-side exception has occurred" on a blank white page - which on a store
 * that takes payments reads as "my money is gone".
 *
 * `error.digest` is the id that ties this to the stack trace in the container
 * log. It is the only handle the shop owner has when a player says the page
 * went blank, so it is shown rather than swallowed. The message itself is not:
 * in production Next redacts it anyway, and it can carry internals.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[shop] unhandled render error:', error);
  }, [error]);

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto w-full">
        <StatusScreen
          variant="error"
          title="ระบบขัดข้องชั่วคราว"
          description="หน้านี้โหลดไม่สำเร็จ ยอดเงินและรายการซื้อของคุณไม่ได้รับผลกระทบ ลองใหม่อีกครั้งได้เลย"
          detail={error.digest ? <StatusDetailRow label="รหัสอ้างอิง" value={error.digest} /> : undefined}
          actions={
            <>
              <button
                onClick={reset}
                className="btn-primary w-full py-3 text-white font-black text-[13px] flex items-center justify-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5" strokeWidth={2.25} /> ลองใหม่อีกครั้ง
              </button>
              <Link
                href="/"
                className="text-[11px] font-black text-foreground-subtle hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Home className="w-3 h-3" strokeWidth={2.25} /> กลับหน้าแรก
              </Link>
            </>
          }
        />
      </div>
    </MainLayout>
  );
}
