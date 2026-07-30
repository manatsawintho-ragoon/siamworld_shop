import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { fetchShopSeo } from '@/lib/serverSeo';

/**
 * Serve the shop's own favicon as a PNG from our own origin.
 *
 * This exists because the previous approach did not work in any browser. The
 * shop's favicon_url was passed through /_next/image, which picks its output
 * format from the request's Accept header - and a favicon request from Chrome
 * or Firefox advertises image/avif, so the optimizer returned AVIF. Neither
 * browser renders an AVIF favicon: the tab silently kept the built-in fallback
 * (public/icon.svg, an "M"), which is what every shop was showing. Verified
 * against live shops: /_next/image?url=<favicon>&w=64 answers image/avif.
 *
 * Encoding here rather than letting the browser have the original keeps the two
 * properties the optimizer was there for in the first place: the request stays
 * same-origin, so the image host's cookies never touch the page, and a 549KB
 * Canva PNG is re-encoded down to a couple of KB. PNG is not negotiable - it is
 * the one raster format every browser will accept as an icon.
 */

/** Neutral mark used when the shop has set no icon, or its URL is unreachable. */
const FALLBACK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' +
  '<rect width="32" height="32" rx="7" fill="#1f2937"/>' +
  '<path d="M9 21V11l7 4 7-4v10" fill="none" stroke="#f3f4f6" stroke-width="2.5" ' +
  'stroke-linejoin="round" stroke-linecap="round"/></svg>';

/** Anything larger than this is not a favicon and we decline to download it. */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

function fallback() {
  return new NextResponse(FALLBACK_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Short: an owner who has just pasted a working URL should not wait a day
      // for the placeholder to expire out of their tab.
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export async function GET(request: Request) {
  const size = Math.min(Math.max(Number(new URL(request.url).searchParams.get('size')) || 64, 16), 512);

  const seo = await fetchShopSeo();
  const source = seo.faviconUrl || seo.logoUrl;
  if (!source || !/^https?:\/\//i.test(source)) return fallback();

  try {
    const upstream = await fetch(source, {
      // The icon changes only when the owner edits the setting, and this route
      // is hit by every visitor's browser, so it is worth a long server cache.
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) return fallback();

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) return fallback();

    // `fit: 'contain'` on a transparent canvas: shop logos are rarely square and
    // cropping one to fit tends to cut the wordmark in half.
    const png = await sharp(buffer, { animated: false })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Buffer is not in BodyInit, so hand the response its backing bytes.
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        // `immutable` is safe because the URL carries a ?v= fingerprint of the
        // configured favicon_url (see generateMetadata in app/layout.tsx), so a
        // changed icon is a different URL rather than a stale cache entry.
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    // Unreachable host, malformed image, sharp refusing the format (.ico is the
    // common one). A tab with the neutral mark beats a tab with a broken icon.
    return fallback();
  }
}
