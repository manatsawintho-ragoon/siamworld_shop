import { logger } from '../utils/logger';
import crypto from 'crypto';
import { redis } from '../database/redis';

const SESSION_TTL_SEC     = 24 * 60 * 60; // 24h — matches JWT expiry ceiling
const INACTIVITY_TTL_SEC  = 40 * 60;      // 40 minutes
const TOUCH_DEBOUNCE_MS   = 60 * 1000;    // refresh inactivity timer at most once per minute

export type SessionStatus = 'valid' | 'kicked' | 'expired' | 'unavailable';

/** In-process debounce so a hot user doesn't hammer Redis SET every request. */
const lastTouchedAt = new Map<number, number>();

/**
 * Create a new session for a panel user (overwrites any existing session, kicking the old device).
 * Returns the jti to embed in the JWT.
 *
 * Throws if Redis is unavailable — login should NOT succeed without a server-side session,
 * otherwise the JWT would point at a session that was never stored and validation would
 * either reject every request or fall back to JWT-only auth.
 */
export async function createSession(userId: number): Promise<string> {
  const jti = crypto.randomUUID();
  await Promise.all([
    redis.set(`panel_session:${userId}`, jti, 'EX', SESSION_TTL_SEC),
    redis.set(`panel_activity:${userId}`, Date.now().toString(), 'EX', INACTIVITY_TTL_SEC),
  ]);
  lastTouchedAt.set(userId, Date.now());
  return jti;
}

/**
 * Validate a session on every authenticated request.
 * - 'kicked'       → a newer login replaced this session
 * - 'expired'      → inactivity timeout or session not found
 * - 'unavailable'  → Redis is down; caller MUST fail-closed (401), never allow the request.
 * - 'valid'        → session is active; caller should call touchSession()
 *
 * Previous versions of this function fell back to 'valid' when Redis was unreachable,
 * which made every kicked/expired session usable during a Redis outage. We now fail
 * closed; a Redis outage takes down auth, but does not silently bypass session policy.
 */
export async function validateSession(userId: number, jti: string): Promise<SessionStatus> {
  let storedJti: string | null;
  let lastActivity: string | null;
  try {
    [storedJti, lastActivity] = await Promise.all([
      redis.get(`panel_session:${userId}`),
      redis.get(`panel_activity:${userId}`),
    ]);
  } catch (err) {
    logger.error('[Redis] Session validation failed:', (err as Error).message);
    return 'unavailable';
  }

  if (!storedJti) return 'expired';
  if (storedJti !== jti) return 'kicked';
  if (!lastActivity) {
    await destroySession(userId).catch(() => {});
    return 'expired';
  }
  if (Date.now() - Number(lastActivity) > INACTIVITY_TTL_SEC * 1000) {
    await destroySession(userId).catch(() => {});
    return 'expired';
  }

  return 'valid';
}

/**
 * Refresh the inactivity countdown. Debounced to at most once per TOUCH_DEBOUNCE_MS
 * to avoid a hot Redis key on high-traffic users.
 */
export async function touchSession(userId: number): Promise<void> {
  const now = Date.now();
  const last = lastTouchedAt.get(userId) || 0;
  if (now - last < TOUCH_DEBOUNCE_MS) return;
  lastTouchedAt.set(userId, now);
  try {
    await redis.set(`panel_activity:${userId}`, now.toString(), 'EX', INACTIVITY_TTL_SEC);
  } catch {
    // Redis down — non-fatal; validateSession will fail-closed on the next request anyway.
  }
}

/** Invalidate a session (used on logout and when a new login kicks the old session). */
export async function destroySession(userId: number): Promise<void> {
  lastTouchedAt.delete(userId);
  try {
    await redis.del(`panel_session:${userId}`, `panel_activity:${userId}`);
  } catch {
    // Redis down — session will naturally expire via JWT expiry.
  }
}

// ── One-time OAuth exchange codes ─────────────────────────────────
// Short opaque codes that map to a JWT so the JWT never appears in the URL/Referer/logs.
const OAUTH_CODE_TTL_SEC = 60;

export async function createOAuthExchangeCode(token: string): Promise<string> {
  const code = crypto.randomBytes(24).toString('base64url');
  await redis.set(`panel_oauth_code:${code}`, token, 'EX', OAUTH_CODE_TTL_SEC);
  return code;
}

/** Consume an OAuth exchange code: returns the JWT once, then deletes it. */
export async function consumeOAuthExchangeCode(code: string): Promise<string | null> {
  if (!code || typeof code !== 'string') return null;
  const key = `panel_oauth_code:${code}`;
  const token = await redis.get(key);
  if (!token) return null;
  // Best-effort delete — even if it fails, the TTL will reap it.
  await redis.del(key).catch(() => {});
  return token;
}
