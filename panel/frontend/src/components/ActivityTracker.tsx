'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { trackPageView, trackFeature } from '@/lib/track';

// Mounted once in the root layout. Captures page views (on route change) and tagged
// feature clicks ([data-track="..."]) for logged-in panel users only. The backend
// restricts storage to the /dashboard + /admin area; we gate client-side too to avoid
// firing useless beacons from public/marketing pages.
const IN_SCOPE = /^\/(dashboard|admin)(\/|$)/;

export default function ActivityTracker() {
  const { user } = useAuth();
  const pathname = usePathname();

  // Page views — one per in-scope route change, only while authenticated.
  useEffect(() => {
    if (!user || !pathname || !IN_SCOPE.test(pathname)) return;
    trackPageView(pathname);
  }, [user, pathname]);

  // Feature clicks — single delegated listener for [data-track] elements.
  useEffect(() => {
    if (!user) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
      const key = el?.dataset.track?.trim();
      if (key) trackFeature(key);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [user]);

  return null;
}
