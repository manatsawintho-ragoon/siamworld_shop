'use client';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Icon, type IconName } from '@/components/ui/icon';

/**
 * The custom-domain flow moved into a modal opened from the dashboard ("โดเมน" button).
 * This route is kept only to redirect old bookmarks/links back to the dashboard.
 */
export default function DomainRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Icon name="spinner" className="text-2xl text-primary animate-spin" />
    </div>
  );
}
