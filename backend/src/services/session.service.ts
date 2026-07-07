import crypto from 'crypto';
import { redis } from '../database/redis';
import { logger } from '../utils/logger';

const SESSION_TTL_SEC    = 24 * 60 * 60; // 24h — matches JWT expiry ceiling
const INACTIVITY_TTL_SEC = 40 * 60;      // 40 minutes

export type SessionStatus = 'valid' | 'kicked' | 'expired' | 'degraded';

/**
 * Create a new session for a user (overwrites any existing session, kicking the old device).
 * Returns the jti to embed in the JWT.
 */
export async function createSession(userId: number): Promise<string> {
  const jti = crypto.randomUUID();
  try {
    await Promise.all([
      redis.set(`session:${userId}`, jti, 'EX', SESSION_TTL_SEC),
      redis.set(`activity:${userId}`, Date.now().toString(), 'EX', INACTIVITY_TTL_SEC),
    ]);
  } catch (err) {
    logger.error('Redis: failed to create session', { userId, err });
    // Still return jti so login succeeds; session validation will degrade gracefully
  }
  return jti;
}

/**
 * Validate a session on every authenticated request.
 * - 'kicked'   → a newer login replaced this session
 * - 'expired'  → inactivity timeout or session not found
 * - 'valid'    → session is active; caller should call touchSession()
 * - 'degraded' → Redis unavailable; single-session enforcement could not run.
 *                The caller decides the policy (e.g. allow normal users but
 *                fail closed for admins). JWT signature is still verified either
 *                way — this only signals that session state is unknown.
 */
export async function validateSession(userId: number, jti: string): Promise<SessionStatus> {
  try {
    const [storedJti, lastActivity] = await Promise.all([
      redis.get(`session:${userId}`),
      redis.get(`activity:${userId}`),
    ]);

    if (!storedJti) return 'expired';
    if (storedJti !== jti) return 'kicked';
    if (!lastActivity) {
      // activity key expired but session key still present — treat as expired
      await destroySession(userId);
      return 'expired';
    }
    if (Date.now() - Number(lastActivity) > INACTIVITY_TTL_SEC * 1000) {
      await destroySession(userId);
      return 'expired';
    }

    return 'valid';
  } catch (err) {
    // Redis is down — report 'degraded' and let the caller apply policy. We do
    // NOT silently return 'valid': that would let a kicked/expired admin session
    // keep working for the JWT's full lifetime whenever Redis is unavailable.
    logger.warn('Redis unavailable — session state unknown (degraded)', { userId });
    return 'degraded';
  }
}

/**
 * Refresh the inactivity countdown. Call on every valid authenticated request.
 * Errors are swallowed — a failed touch must not break the request.
 */
export async function touchSession(userId: number): Promise<void> {
  try {
    await redis.set(`activity:${userId}`, Date.now().toString(), 'EX', INACTIVITY_TTL_SEC);
  } catch {
    // Redis down — non-fatal, inactivity window just won't be refreshed
  }
}

/** Invalidate a session (used on logout and when a new login kicks the old session). */
export async function destroySession(userId: number): Promise<void> {
  try {
    await redis.del(`session:${userId}`, `activity:${userId}`);
  } catch {
    // Redis down — session will naturally expire via JWT expiry
  }
}
