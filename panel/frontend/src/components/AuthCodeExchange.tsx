'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Handles the post-login token exchange carried on the landing page URL.
 *
 * Lives in its own component (and its own Suspense boundary) on purpose:
 * `useSearchParams` opts its whole boundary out of static prerendering, so
 * keeping it here lets the marketing page render server-side for crawlers.
 */
export default function AuthCodeExchange() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Newer flow: one-time opaque `?code=` (preferred — JWT never enters the URL).
    // Older flow: `?exchange_token=` carrying the JWT directly (kept for one release).
    const code = searchParams.get('code');
    const legacyToken = searchParams.get('exchange_token');
    if (!code && !legacyToken) return;

    (async () => {
      try {
        const body = code ? { code } : { token: legacyToken };
        const res = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        if (res.ok) {
          window.location.href = '/dashboard';
        } else {
          window.location.replace('/?error=auth_failed');
        }
      } catch {
        window.location.replace('/?error=auth_failed');
      }
    })();
  }, [searchParams]);

  return null;
}
