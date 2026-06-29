import crypto from 'crypto';

/**
 * Mirror of the shop backend's crypto (siamworld_shop/backend/src/utils/crypto.ts).
 *
 * Each shop encrypts its dedicated web-admin password with AES-256-GCM using a
 * key derived from that shop's ENCRYPTION_KEY (or JWT_SECRET) via
 * scrypt(secret, 'siamworld-salt', 32). The panel reads/regenerates that value,
 * so it must use the EXACT same scheme + key derivation. If the shop's crypto
 * changes, update this file in lockstep.
 *
 * The `secret` here is the per-shop ENCRYPTION_KEY||JWT_SECRET, read from the
 * shop's .env via deployService.getCustomerEnv — never a panel secret.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const STATIC_SALT = 'siamworld-salt';

// Derived keys are pure functions of the secret; cache to avoid paying the
// ~40ms scrypt cost repeatedly for the same shop within a process.
const keyCache = new Map<string, Buffer>();

function deriveKey(secret: string): Buffer {
  if (!secret || secret.length < 32) {
    throw new Error('shop ENCRYPTION_KEY/JWT_SECRET must be at least 32 characters');
  }
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.scryptSync(secret, STATIC_SALT, 32);
    keyCache.set(secret, key);
  }
  return key;
}

/** Encrypt plaintext → `iv:authTag:ciphertext` (all hex). */
export function encryptWithSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/** Decrypt an `iv:authTag:ciphertext` string produced by the shop or by us. */
export function decryptWithSecret(encryptedText: string, secret: string): string {
  const key = deriveKey(secret);
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parts[2], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** True if the string is in our `hex:hex:hex` shape. */
export function looksEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/.test(p) && p.length > 0);
}
