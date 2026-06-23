/**
 * Decide whether a Socket.IO handshake is allowed.
 * A connection passes when it is non-browser (no Origin), explicitly configured,
 * wildcard, or strictly same-origin (Origin host === request Host). The same-origin
 * rule is what lets a shop work on any custom domain without a container restart.
 * Safe because auth is an httpOnly, SameSite cookie, so cross-site pages cannot
 * ride a logged-in user's session over the socket.
 */
export function isWsOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  allowed: '*' | string[]
): boolean {
  if (!origin) return true;
  if (allowed === '*') return true;
  if (allowed.includes(origin)) return true;
  if (host) {
    try {
      if (new URL(origin).host === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}
