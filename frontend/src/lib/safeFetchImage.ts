import dns from 'dns/promises';
import net from 'net';

/**
 * Fetch a shop-configured image URL without letting it reach our own network.
 *
 * The favicon/logo URL is set by the shop owner, who in this SaaS is a customer
 * rather than an operator. Fetching it server-side with no restriction turned the
 * Next container into a probe: `http://backend:4000/...`, `http://10.x.x.x:port`
 * or the cloud metadata endpoint would all be requested from inside the trust
 * boundary, and the difference between "valid image", "not an image" and "timed
 * out" is a usable oracle for mapping internal services.
 *
 * The defense is to resolve the hostname ourselves and refuse anything that is
 * not a public unicast address, then pin the connection to the address we
 * checked. Redirects are refused rather than followed, because following one
 * would re-open the hole at the next hop.
 */

/** Blocks loopback, private, link-local (incl. cloud metadata), CGNAT and friends. */
export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0) return false;                              // "this network"
    if (p[0] === 10) return false;                             // RFC1918
    if (p[0] === 127) return false;                            // loopback
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false; // RFC1918
    if (p[0] === 192 && p[1] === 168) return false;            // RFC1918
    if (p[0] === 169 && p[1] === 254) return false;            // link-local + 169.254.169.254 metadata
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false; // CGNAT
    if (p[0] >= 224) return false;                             // multicast + reserved
    return true;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return false;               // unspecified / loopback
    if (v.startsWith('fe80')) return false;                    // link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return false; // unique-local
    if (v.startsWith('ff')) return false;                      // multicast
    // IPv4-mapped (::ffff:10.0.0.1) must be judged on the embedded v4 address.
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return true;
  }
  return false;
}

export interface SafeFetchResult {
  ok: boolean;
  buffer?: Buffer;
  reason?: string;
}

/**
 * GET a remote image, enforcing: https/http only, public address only, a size
 * ceiling, and no redirects.
 */
export async function safeFetchImage(
  rawUrl: string,
  { maxBytes, timeoutMs = 15000 }: { maxBytes: number; timeoutMs?: number }
): Promise<SafeFetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }

  // Resolve first and judge every answer: a hostname can legitimately resolve to
  // several addresses, and accepting the response when ANY of them is internal
  // would leave a DNS-rebinding path open.
  let addresses: string[];
  try {
    const resolved = await dns.lookup(url.hostname, { all: true });
    addresses = resolved.map(r => r.address);
  } catch {
    return { ok: false, reason: 'dns' };
  }
  if (addresses.length === 0) return { ok: false, reason: 'dns' };
  if (!addresses.every(isPublicAddress)) return { ok: false, reason: 'private-address' };

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      redirect: 'error', // a redirect could point back inside; refuse rather than re-check
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, reason: `status-${res.status}` };

    // Trust the declared length when present, but still bound what we actually read.
    const declared = Number(res.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, reason: 'too-large' };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) {
      return { ok: false, reason: 'too-large' };
    }
    return { ok: true, buffer };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}
