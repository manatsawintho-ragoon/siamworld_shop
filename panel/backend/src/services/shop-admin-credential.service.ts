import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { deployService } from './deploy.service';
import { encryptWithSecret, decryptWithSecret, looksEncrypted } from '../utils/shopCrypto';
import {
  generateSeed,
  currentRotatingPassword,
  deriveRotatingPassword,
  windowIndexAt,
  msUntilNextWindow,
  WINDOW_SECONDS,
} from '../utils/rotatingPassword';

const execAsync = promisify(exec);

/**
 * Reads / provisions / regenerates a shop's dedicated web-admin credential.
 *
 * The credential lives in the shop's own MySQL (`users.admin_password_enc` +
 * `admin_pw_rotating`, migrations 029 + 030), encrypted with the shop's
 * ENCRYPTION_KEY. We reach the shop DB the same way deploy ops do —
 * `docker exec` into `sw-<shop>-mysql-1` — so there is no extra network
 * exposure and no new secret handshake.
 *
 * Two modes (see migration 030):
 *   - ROTATING (default after setup): `admin_password_enc` stores a random seed;
 *     the login password is derived per 60s window. We display the current
 *     value + the next one + the window expiry so the panel UI can show a live
 *     countdown and swap without a race. Both sides derive identically via
 *     utils/rotatingPassword (mirrored from the shop backend).
 *   - CUSTOM (after the owner sets their own password): `admin_password_enc`
 *     stores the real password and `admin_pw_rotating = 0` (permanent).
 *
 * Provisioning is lazy + idempotent. Decrypted secrets are cached in memory per
 * shop so the per-minute refetch the UI does (to roll the countdown) does not
 * pay a docker exec each time; the cache is cleared on regenerate / setPassword.
 */

/** Single-quote a value for safe embedding in a shell command. */
function sq(s: string): string {
  return `'` + s.replace(/'/g, `'\\''`) + `'`;
}

/** Random password from an unambiguous alphabet (no O/0/I/l/1). Legacy/custom. */
function randomPassword(len = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

export interface ShopAdminCredential {
  username: string;
  password: string;
  rotating: boolean;
  provisioned: boolean;     // true if this call created the credential
  nextPassword?: string;    // rotating only: password for the next window
  expiresAt?: number;       // rotating only: epoch ms (server clock) when the window ends
  remainingMs?: number;     // rotating only: ms left in the window — clock-skew-proof
  windowSeconds?: number;   // rotating only: window length (60)
}

interface CacheEntry {
  mode: 'rotating' | 'custom';
  username: string;
  secret: string; // rotating: seed hex; custom: the real password
  at: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

class ShopAdminCredentialService {
  private cache = new Map<string, CacheEntry>();

  /** Run a SQL statement inside the shop's mysql container; returns stdout. */
  private async runSql(shopName: string, env: Record<string, string>, sql: string): Promise<string> {
    const user = env.MYSQL_USER || 'siamworld';
    const pass = env.MYSQL_PASSWORD || '';
    const db = env.MYSQL_DATABASE || 'siamworld';
    const container = `sw-${shopName}-mysql-1`;
    const cmd = `docker exec -i ${sq(container)} mysql -N -B -u${sq(user)} -p${sq(pass)} ${sq(db)} -e ${sq(sql)}`;
    const { stdout } = await execAsync(cmd, { timeout: 30000 });
    return stdout;
  }

  private secretOf(env: Record<string, string>): string {
    const secret = env.ENCRYPTION_KEY || env.JWT_SECRET;
    if (!secret) throw new Error('ไม่พบ ENCRYPTION_KEY ของร้าน ไม่สามารถจัดการรหัสแอดมินได้');
    return secret;
  }

  /** Build the API-facing credential from a cache entry (no DB access). */
  private present(entry: CacheEntry, provisioned = false): ShopAdminCredential {
    if (entry.mode === 'rotating') {
      const now = Date.now();
      const remainingMs = msUntilNextWindow(now);
      return {
        username: entry.username,
        password: currentRotatingPassword(entry.secret, now),
        nextPassword: deriveRotatingPassword(entry.secret, windowIndexAt(now) + 1),
        expiresAt: now + remainingMs,
        remainingMs,
        windowSeconds: WINDOW_SECONDS,
        rotating: true,
        provisioned,
      };
    }
    return { username: entry.username, password: entry.secret, rotating: false, provisioned };
  }

  /** Read the dedicated-admin row, tolerating shops not yet on migration 030. */
  private async readRow(
    shopName: string, env: Record<string, string>
  ): Promise<{ username: string; enc: string; rotating: boolean } | null> {
    let out: string;
    let hasCol = true;
    try {
      out = (await this.runSql(
        shopName, env,
        'SELECT username, admin_password_enc, admin_pw_rotating FROM users WHERE admin_password_enc IS NOT NULL ORDER BY id ASC LIMIT 1'
      )).trim();
    } catch {
      // Column not present yet (pre-030 shop) — fall back to the legacy shape.
      hasCol = false;
      out = (await this.runSql(
        shopName, env,
        'SELECT username, admin_password_enc FROM users WHERE admin_password_enc IS NOT NULL ORDER BY id ASC LIMIT 1'
      )).trim();
    }
    if (!out) return null;
    const parts = out.split('\t');
    const username = parts[0];
    const enc = parts[1];
    const rotating = hasCol ? parts[2] === '1' : false;
    return { username, enc, rotating };
  }

  private async hasRotatingColumn(shopName: string, env: Record<string, string>): Promise<boolean> {
    const out = (await this.runSql(shopName, env, "SHOW COLUMNS FROM users LIKE 'admin_pw_rotating'")).trim();
    return out.length > 0;
  }

  private async generateUniqueUsername(shopName: string, env: Record<string, string>): Promise<string> {
    const base = shopName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'admin';
    for (let i = 0; i < 25; i++) {
      const cand = `${base}${10 + Math.floor(Math.random() * 90)}`;
      const out = (await this.runSql(
        shopName, env,
        `SELECT (SELECT COUNT(*) FROM users WHERE LOWER(username)=LOWER('${cand}')) + ` +
        `(SELECT COUNT(*) FROM authme WHERE LOWER(username)=LOWER('${cand}'))`
      )).trim();
      if (out === '0') return cand;
    }
    return `${base}${Date.now().toString().slice(-6)}`;
  }

  /** Provision a brand-new credential. Rotating when the shop has migration 030,
   *  else a legacy static password (degrades gracefully mid-deploy). */
  private async provision(shopName: string, env: Record<string, string>, secret: string): Promise<ShopAdminCredential> {
    const username = await this.generateUniqueUsername(shopName, env); // safe charset by construction
    const rotating = await this.hasRotatingColumn(shopName, env);

    if (rotating) {
      const seed = generateSeed();
      const enc = encryptWithSecret(seed, secret); // hex:hex:hex, safe to embed
      await this.runSql(
        shopName, env,
        `INSERT INTO users (username,email,role,admin_password_enc,admin_pw_rotating) VALUES ('${username}',NULL,'admin','${enc}',1); ` +
        `INSERT INTO wallets (user_id,balance) VALUES (LAST_INSERT_ID(),0.00)`
      );
      const entry: CacheEntry = { mode: 'rotating', username, secret: seed, at: Date.now() };
      this.cache.set(shopName, entry);
      return this.present(entry, true);
    }

    const password = randomPassword();
    const enc = encryptWithSecret(password, secret);
    await this.runSql(
      shopName, env,
      `INSERT INTO users (username,email,role,admin_password_enc) VALUES ('${username}',NULL,'admin','${enc}'); ` +
      `INSERT INTO wallets (user_id,balance) VALUES (LAST_INSERT_ID(),0.00)`
    );
    const entry: CacheEntry = { mode: 'custom', username, secret: password, at: Date.now() };
    this.cache.set(shopName, entry);
    return this.present(entry, true);
  }

  /** Write a rotating seed for the existing credential (new rotating sequence). */
  private async writeSeed(shopName: string, env: Record<string, string>, secret: string, username: string, seed: string): Promise<void> {
    if (!USERNAME_RE.test(username)) throw new Error('ชื่อแอดมินไม่ถูกต้อง');
    const enc = encryptWithSecret(seed, secret);
    await this.runSql(shopName, env, `UPDATE users SET admin_password_enc='${enc}', admin_pw_rotating=1 WHERE username='${username}'`);
  }

  /** Write a permanent custom password for the existing credential (stop rotating). */
  private async writePassword(shopName: string, env: Record<string, string>, secret: string, username: string, password: string, hasCol: boolean): Promise<void> {
    if (!USERNAME_RE.test(username)) throw new Error('ชื่อแอดมินไม่ถูกต้อง');
    const enc = encryptWithSecret(password, secret);
    const setRotating = hasCol ? ', admin_pw_rotating=0' : '';
    await this.runSql(shopName, env, `UPDATE users SET admin_password_enc='${enc}'${setRotating} WHERE username='${username}'`);
  }

  /** Read the current credential, provisioning one if the shop has none yet.
   *  Uses the in-memory secret cache so the UI can roll its countdown cheaply. */
  async getOrProvision(shopName: string): Promise<ShopAdminCredential> {
    const cached = this.cache.get(shopName);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return this.present(cached);
    }

    const env = await deployService.getCustomerEnv(shopName);
    const secret = this.secretOf(env);
    const row = await this.readRow(shopName, env);

    if (!row) return this.provision(shopName, env, secret);

    const { username, enc, rotating } = row;
    if (username && enc && looksEncrypted(enc)) {
      const decrypted = decryptWithSecret(enc, secret);
      const entry: CacheEntry = {
        mode: rotating ? 'rotating' : 'custom',
        username,
        secret: decrypted,
        at: Date.now(),
      };
      this.cache.set(shopName, entry);
      return this.present(entry);
    }

    // Row exists but value is unreadable (e.g. key rotated) — reset it. Prefer a
    // rotating reset when the shop supports it.
    if (username && USERNAME_RE.test(username)) {
      const hasCol = await this.hasRotatingColumn(shopName, env);
      if (hasCol) {
        const seed = generateSeed();
        await this.writeSeed(shopName, env, secret, username, seed);
        const entry: CacheEntry = { mode: 'rotating', username, secret: seed, at: Date.now() };
        this.cache.set(shopName, entry);
        return this.present(entry);
      }
      const password = randomPassword();
      await this.writePassword(shopName, env, secret, username, password, false);
      const entry: CacheEntry = { mode: 'custom', username, secret: password, at: Date.now() };
      this.cache.set(shopName, entry);
      return this.present(entry);
    }

    return this.provision(shopName, env, secret);
  }

  /** Generate a fresh rotating seed for the existing credential (or create one).
   *  Returns the credential to a rotating state even if it was custom. */
  async regenerate(shopName: string): Promise<ShopAdminCredential> {
    this.cache.delete(shopName);
    const env = await deployService.getCustomerEnv(shopName);
    const secret = this.secretOf(env);
    const row = await this.readRow(shopName, env);
    if (!row) return this.provision(shopName, env, secret);

    const hasCol = await this.hasRotatingColumn(shopName, env);
    if (hasCol) {
      const seed = generateSeed();
      await this.writeSeed(shopName, env, secret, row.username, seed);
      const entry: CacheEntry = { mode: 'rotating', username: row.username, secret: seed, at: Date.now() };
      this.cache.set(shopName, entry);
      return this.present(entry);
    }
    // Legacy shop: regenerate a static password.
    const password = randomPassword();
    await this.writePassword(shopName, env, secret, row.username, password, false);
    const entry: CacheEntry = { mode: 'custom', username: row.username, secret: password, at: Date.now() };
    this.cache.set(shopName, entry);
    return this.present(entry);
  }

  /** Set a permanent custom password for the existing credential (stop rotating). */
  async setPassword(shopName: string, newPassword: string): Promise<ShopAdminCredential> {
    if (!newPassword || newPassword.length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
    if (newPassword.length > 100) throw new Error('รหัสผ่านยาวเกินไป');
    this.cache.delete(shopName);
    const env = await deployService.getCustomerEnv(shopName);
    const secret = this.secretOf(env);
    let row = await this.readRow(shopName, env);
    if (!row) {
      const created = await this.provision(shopName, env, secret);
      row = { username: created.username, enc: '', rotating: created.rotating };
    }
    const hasCol = await this.hasRotatingColumn(shopName, env);
    await this.writePassword(shopName, env, secret, row.username, newPassword, hasCol);
    const entry: CacheEntry = { mode: 'custom', username: row.username, secret: newPassword, at: Date.now() };
    this.cache.set(shopName, entry);
    return this.present(entry);
  }
}

export const shopAdminCredentialService = new ShopAdminCredentialService();
