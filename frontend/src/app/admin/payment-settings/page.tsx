'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Payment settings are now split into dedicated pages per channel.
// Keep this route as a redirect so old links / bookmarks still land somewhere.
export default function PaymentSettingsIndex() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/payment-settings/promptpay'); }, [router]);
  return (
    <div className="flex items-center justify-center py-20">
      <i className="fas fa-spinner fa-spin text-3xl text-[#f97316]" />
    </div>
  );
}
