'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

export interface Announcement {
  id: number;
  title: string;
  body: string;
  level: 'info' | 'update' | 'important';
  published_at: string | null;
}

/**
 * Polls the shop backend for operator announcements not yet dismissed by this
 * admin. Near-realtime: refetches every 15s, on window focus / tab visibility,
 * and on route change. dismiss() persists "don't show again" for this admin.
 */
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const data = await api('/admin/announcements');
      const list = (data as { announcements?: Announcement[] }).announcements;
      if (Array.isArray(list)) setAnnouncements(list);
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15000);
    const onFocus = () => refresh();
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  // Refetch when the admin navigates between pages (feels instant on any click).
  useEffect(() => { refresh(); }, [pathname, refresh]);

  const dismiss = useCallback(async (id: number) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    try { await api(`/admin/announcements/${id}/dismiss`, { method: 'POST' }); } catch { /* best-effort */ }
  }, []);

  return { announcements, dismiss };
}
