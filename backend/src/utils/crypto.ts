import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// scryptSync is intentionally expensive (~40ms). The derived key only depends
// on the (immutable-at-runtime) secret + static salt, so derive it once and
// memoize. Without this, every encrypt/decrypt — including each settings load
// and every RCON password decrypt on the 10s player-tracker poll — paid the
// full KDF cost, adding ~80ms to /api/public/settings alone.
const keyCache = new Map<string, Buffer>();

function deriveKey(secret: string): Buffer {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const key = crypto.scryptSync(secret, 'siamworld-salt', 32);
  keyCache.set(secret, key);
  return key;
}

// Primary key: ENCRYPTION_KEY only. It protects data-at-rest and is required to
// differ from JWT_SECRET (see config validation). All NEW encryption uses this.
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return deriveKey(secret);
}

// Legacy key: older data may have been encrypted with a key derived from
// JWT_SECRET (previous fallback behaviour). Decryption tries this if the primary
// key fails, so pre-existing RCON passwords / admin credentials keep working.
// The value is re-encrypted under ENCRYPTION_KEY on its next save.
function getLegacyKey(): Buffer | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return deriveKey(secret);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded string: salt:iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input format: iv:authTag:ciphertext (hex encoded)
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const tryKey = (key: Buffer): string => {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  };

  try {
    return tryKey(getEncryptionKey());
  } catch (err) {
    // GCM auth-tag mismatch → the data may predate ENCRYPTION_KEY and was
    // encrypted under the legacy JWT_SECRET-derived key. Try that once.
    const legacy = getLegacyKey();
    if (legacy) return tryKey(legacy);
    throw err;
  }
}

/**
 * Check if a string looks like it was encrypted by us (hex:hex:hex format).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return /^[0-9a-f]+$/.test(parts[0]) && /^[0-9a-f]+$/.test(parts[1]) && /^[0-9a-f]+$/.test(parts[2]);
}
