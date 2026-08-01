'use client';

import Link from 'next/link';
import { Search, Home, ShoppingCart } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import StatusScreen from '@/components/StatusScreen';

/**
 * 404 for the shop.
 *
 * Until this existed, a mistyped URL or a stale link to a deleted product served
 * Next.js's unstyled built-in "404 | This page could not be found" - on a page
 * carrying the shop owner's branding everywhere else.
 *
 * Rendered inside MainLayout so the player keeps the nav and can leave without
 * hitting back, which is the whole point: a 404 should be a detour, not a wall.
 */
export default function NotFound() {
  return (
    <MainLayout>
      <div className="max-w-lg mx-auto w-full">
        <StatusScreen
          variant="warning"
          icon={Search}
          title="ไม่พบหน้าที่คุณเปิด"
          description="หน้านี้อาจถูกย้าย ถูกลบ หรือลิงก์ที่ใช้พิมพ์ผิด"
          actions={
            <>
              <Link
                href="/"
                className="btn-primary w-full py-3 text-white font-black text-[13px] flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" strokeWidth={2.25} /> กลับหน้าแรก
              </Link>
              <Link
                href="/shop"
                className="text-[11px] font-black text-foreground-subtle hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-3 h-3" strokeWidth={2.25} /> ไปที่หน้าร้านค้า
              </Link>
            </>
          }
        />
      </div>
    </MainLayout>
  );
}
