import crypto from 'crypto';

/**
 * Time-based rotating admin password (TOTP-style, see migration 030).
 *
 * MIRROR of the shop backend's siamworld_shop/backend/src/utils/rotatingPassword.ts.
 * The panel displays the current password while the shop backend verifies it, so
 * BOTH must derive the exact same value. Keep this file byte-for-byte equivalent
 * to the shop's (algorithm, alphabet, length, window) — any drift means the
 * owner sees a password that does not let them log in.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const PASSWORD_LEN = 10;
export const WINDOW_SECONDS = 60;

/** 32-byte random seed as hex (64 chars). Stored encrypted; never shown. */
export function generateSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Window index for a given epoch-milliseconds timestamp (default: now). */
export function windowIndexAt(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / WINDOW_SECONDS);
}

/** Milliseconds remaining until the current window rolls over (1..60000). */
export function msUntilNextWindow(nowMs: number = Date.now()): number {
  const windowMs = WINDOW_SECONDS * 1000;
  return windowMs - (nowMs % windowMs);
}

/** Derive the readable password for a seed at a specific window index. */
export function deriveRotatingPassword(seedHex: string, windowIndex: number): string {
  const seed = Buffer.from(seedHex, 'hex');
  const mac = crypto.createHmac('sha256', seed).update(String(windowIndex)).digest();
  let out = '';
  for (let i = 0; i < PASSWORD_LEN; i++) out += ALPHABET[mac[i] % ALPHABET.length];
  return out;
}

/** The password valid in the current window for a seed (default: now). */
export function currentRotatingPassword(seedHex: string, nowMs: number = Date.now()): string {
  return deriveRotatingPassword(seedHex, windowIndexAt(nowMs));
}
