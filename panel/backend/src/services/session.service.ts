import crypto from 'crypto';
import { redis } from '../database/redis';

const SESSION_TTL_SEC    = 24 * 60 * 60; // 24h — matches JWT expiry ceiling
const INACTIVITY_TTL_SEC = 40 * 60;      // 40 minutes

export type SessionStatus = 'valid' | 'kicked' | 'expired';

/**
 * Create a new session for a panel user (overwrites any existing session, kicking the old device).
 * Returns the jti to embed in the JWT.
 */
export async function createSession(userId: number): Promise<string> {
  const jti = crypto.randomUUID();
  try {
    await Promise.all([
      redis.set(`panel_session:${userId}`, jti, 'EX', SESSION_TTL_SEC),
      redis.set(`panel_activity:${userId}`, Date.now().toString(), 'EX', INACTIVITY_TTL_SEC),
    ]);
  } catch (err) {
    console.error('[Redis] Failed to create panel session:', err);
    // Still return jti so login succeeds; session validation will degrade gracefully
  }
  return jti;
}

/**
 * Validate a session on every authenticated request.
 * - 'kicked'  → a newer login replaced this session
 * - 'expired' → inactivity timeout or session not found
 * - 'valid'   → session is active; caller should call touchSession()
 *
 * If Redis is unavailable, returns 'valid' (graceful degradation).
 * JWT signature is still verified — this only skips single-session enforcement.
 */
export async function validateSession(userId: number, jti: string): Promise<SessionStatus> {
  try {
    const [storedJti, lastActivity] = await Promise.all([
      redis.get(`panel_session:${userId}`),
      redis.get(`panel_activity:${userId}`),
    ]);

    if (!storedJti) return 'expired';
    if (storedJti !== jti) return 'kicked';
    if (!lastActivity) {
      await destroySession(userId);
      return 'expired';
    }
    if (Date.now() - Number(lastActivity) > INACTIVITY_TTL_SEC * 1000) {
      await destroySession(userId);
      return 'expired';
    }

    return 'valid';
  } catch (err) {
    // Redis is down — degrade gracefully so auth doesn't block all requests.
    console.error('[Redis] Session validation skipped (graceful degradation):', (err as Error).message);
    return 'valid';
  }
}

/**
 * Refresh the inactivity countdown. Call on every valid authenticated request.
 */
export async function touchSession(userId: number): Promise<void> {
  try {
    await redis.set(`panel_activity:${userId}`, Date.now().toString(), 'EX', INACTIVITY_TTL_SEC);
  } catch {
    // Redis down — non-fatal
  }
}

/** Invalidate a session (used on logout and when a new login kicks the old session). */
export async function destroySession(userId: number): Promise<void> {
  try {
    await redis.del(`panel_session:${userId}`, `panel_activity:${userId}`);
  } catch {
    // Redis down — session will naturally expire via JWT expiry
  }
}
