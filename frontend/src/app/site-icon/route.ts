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

/**
 * Downloaded source bytes and encoded PNGs, held for the life of the process.
 *
 * This is not an optimisation, it is what makes the route work. The image hosts
 * owners use are not reliable under repeated requests: fetching one shop's
 * postimg favicon from the VPS answered in 2.0s and then timed out twice in a
 * row at 30s. Re-fetching per request meant most requests fell through to the
 * placeholder, which is the same blank outcome the AVIF bug produced.
 *
 * Keyed by source URL, so the four sizes in the document head plus the two in
 * the manifest cost one download between them. Bounded by the number of icons a
 * shop configures, which is one - a second entry only appears when the owner
 * edits the setting, and the old one is evicted below.
 */
const sourceCache = new Map<string, Buffer>();
const pngCache = new Map<string, Buffer>();

/**
 * `transient` separates "this shop has set no icon", which is a stable answer
 * worth caching for a few minutes, from "the image host did not answer", which
 * is not - those hosts recover, and a long cache on a failed fetch would leave
 * the placeholder in visitors' tabs long after the icon became fetchable again.
 */
function fallback(transient = false) {
  return new NextResponse(FALLBACK_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': transient ? 'public, max-age=30' : 'public, max-age=300',
    },
  });
}

export async function GET(request: Request) {
  const size = Math.min(Math.max(Number(new URL(request.url).searchParams.get('size')) || 64, 16), 512);

  const seo = await fetchShopSeo();
  const source = seo.faviconUrl || seo.logoUrl;
  if (!source || !/^https?:\/\//i.test(source)) return fallback();

  const pngKey = `${source}|${size}`;

  try {
    const alreadyEncoded = pngCache.get(pngKey);
    if (alreadyEncoded) return pngResponse(alreadyEncoded);

    let buffer = sourceCache.get(source);
    if (!buffer) {
      // 15s rather than a snappy timeout: this runs once per source, behind the
      // cache above, and what it falls back to sticks in the visitor's tab.
      // Waiting is cheaper than being wrong.
      const upstream = await fetch(source, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!upstream.ok) return fallback(true);

      buffer = Buffer.from(await upstream.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) return fallback(true);

      // A different source means the owner edited the setting, so nothing held
      // for the previous one can be asked for again - the ?v= fingerprint in the
      // document head changed with it.
      sourceCache.clear();
      pngCache.clear();
      sourceCache.set(source, buffer);
    }

    // `fit: 'contain'` on a transparent canvas: shop logos are rarely square and
    // cropping one to fit tends to cut the wordmark in half.
    const encoded = await sharp(buffer, { animated: false })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngCache.set(pngKey, encoded);

    return pngResponse(encoded);
  } catch {
    // Unreachable host, malformed image, sharp refusing the format (.ico is the
    // common one). A tab with the neutral mark beats a tab with a broken icon.
    return fallback(true);
  }
}

function pngResponse(body: Buffer) {
  // Buffer is not in BodyInit, so hand the response its backing bytes.
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/png',
      // `immutable` is safe because the URL carries a ?v= fingerprint of the
      // configured favicon_url (see generateMetadata in app/layout.tsx), so a
      // changed icon is a different URL rather than a stale cache entry.
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
