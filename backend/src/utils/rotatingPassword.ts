import crypto from 'crypto';

/**
 * Time-based rotating admin password (TOTP-style, see migration 030).
 *
 * The shop backend (login verify) and the panel (display) MUST derive the exact
 * same value, so this file is mirrored verbatim in
 *   panel/backend/src/utils/rotatingPassword.ts
 * Any change here must be applied there in lockstep, or owners will see a
 * password that does not let them log in.
 *
 * Derivation: from a per-credential random `seed` (32 bytes, stored encrypted in
 * users.admin_password_enc) and the current 60s window index,
 *   password = readable( HMAC-SHA256(seed, String(windowIndex)) )
 * The alphabet excludes look-alike characters (O/0/I/l/1) so the owner can read
 * it off the panel without confusion — same alphabet as the static generator.
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
