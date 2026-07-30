import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getRequestOrigin, SETTINGS_TAG } from '@/lib/serverSeo';

/**
 * Drop the server-side cache of the shop's public settings.
 *
 * The admin panel writes settings to the backend, which knows nothing about
 * Next's data cache. Every customer-facing page is server-rendered from
 * fetchShopSeo(), cached for 300s, and SettingsProvider is seeded from that same
 * render and never re-fetches - so before this route existed, flipping a
 * visibility toggle (Reward Shop, News, any widget) had no visible effect for up
 * to five minutes and read as a broken switch.
 *
 * Admin-only. Revalidation is cheap and idempotent, but leaving it open would
 * let anyone force every shop page to re-render on demand.
 */
export async function POST() {
  const cookie = cookies().toString();
  if (!cookie.includes('auth_token=')) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  // The session cookie is httpOnly and signed by the backend, so the backend is
  // the only thing that can tell us who is holding it.
  const internal = process.env.BACKEND_INTERNAL_URL;
  let role: string | undefined;
  for (const base of [internal, getRequestOrigin()].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`${base}/api/auth/session`, { headers: { cookie }, cache: 'no-store' });
      if (!res.ok) continue;
      role = (await res.json())?.user?.role;
      break;
    } catch {
      /* try next endpoint */
    }
  }

  if (role !== 'admin') {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  revalidateTag(SETTINGS_TAG);
  return NextResponse.json({ success: true });
}
