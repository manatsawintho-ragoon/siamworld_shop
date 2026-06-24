type Loc = { protocol: string; hostname: string; host: string };

/**
 * Resolve the Socket.IO URL.
 * - Production: connect same-origin (wss://<current host>) through NPM's 443 /socket.io
 *   proxy, so the shop works on its siamsite subdomain OR any custom domain pointed at
 *   it, with no rebuild. The baked NEXT_PUBLIC_WS_URL is intentionally ignored here.
 * - Dev (localhost/127.0.0.1): the backend runs on :4000 with no proxy, so target :4000.
 * - SSR (no window): fall back to the configured env or localhost.
 */
export function resolveWsUrl(loc: Loc | undefined, configuredUrl: string | undefined): string {
  if (!loc) return configuredUrl || 'ws://localhost:4000';
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (isLocal) {
    if (configuredUrl && (configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1'))) {
      return configuredUrl;
    }
    return `${scheme}://${loc.hostname}:4000`;
  }
  return `${scheme}://${loc.host}`;
}
