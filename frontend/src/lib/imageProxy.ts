/**
 * Route an owner-supplied image URL through Next's own optimizer.
 *
 * Shop owners paste artwork URLs from wherever they host it - postimg, Discord
 * CDNs, Canva share links - and a plain <img src> puts that host on the page's
 * critical path. On a live shop, four product images served straight from
 * i.postimg.cc took 34.7 seconds each under Lighthouse's throttling, and the
 * largest of them became the Largest Contentful Paint: 34.9s, and a Performance
 * score of 67 on desktop with everything else at 100. The one image on that page
 * that already went through /_next/image took 3.8s.
 *
 * Sending them through /_next/image means they are served from the shop's own
 * origin (so Cloudflare caches them), re-encoded to AVIF or WebP, and resized to
 * roughly what the layout needs. It also drops the third-party cookies those
 * hosts set, which Lighthouse counts under Best Practices.
 *
 * This is deliberately a URL helper rather than a swap to next/image: every call
 * site keeps its existing markup and sizing, so there is no `fill` vs `width`
 * decision to get wrong on 25 elements, and nothing about the layout changes.
 * Use next/image directly for anything that needs a real srcset (the hero
 * carousel and the navbar logo already do).
 */

/** Widths Next accepts by default - `images.imageSizes` plus `images.deviceSizes`. */
const ALLOWED = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/** Smallest allowed width that still covers `w` (2x for crispness on retina). */
function snap(w: number): number {
  const want = w * 2;
  return ALLOWED.find(a => a >= want) ?? ALLOWED[ALLOWED.length - 1];
}

/**
 * @param url   The raw image URL. Anything falsy, already-local, or a data URI
 *              is returned untouched - the optimizer would reject or waste work
 *              on those.
 * @param width Rendered CSS width in px. Snapped up to an allowed size; passing
 *              a value Next does not allow makes /_next/image answer 400.
 */
export function proxyImage(url: string | null | undefined, width: number): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/')) return url;
  // A malformed URL would 400 the optimizer, which renders as a broken image
  // where the original at least had a chance of loading.
  try {
    new URL(url);
  } catch {
    return url;
  }
  return `/_next/image?url=${encodeURIComponent(url)}&w=${snap(width)}&q=75`;
}

/**
 * onError handler for an <img> whose src came from proxyImage.
 *
 * If the optimizer cannot fetch the upstream image - some hosts serve browsers
 * but refuse server-side requests, and Next gives up after 7s - /_next/image
 * answers 500 and the element renders broken. A raw <img> would at least have
 * had the browser's own request to fall back on, so this gives it back: recover
 * the original URL from the `url` parameter and retry against it directly.
 *
 * Reads the original out of the failed src rather than taking it as an argument,
 * so every call site is the same one attribute with no extra plumbing.
 */
export function onProxyError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  const m = el.src.match(/[?&]url=([^&]+)/);
  if (!m) return; // already the direct URL - a second failure is genuine
  const original = decodeURIComponent(m[1]);
  if (!original || el.src === original) return;
  el.src = original;
}
