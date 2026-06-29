import crypto from 'crypto';
import { pool } from '../database/connection';
import { config } from '../config';
import { encrypt, decrypt } from '../utils/crypto';
import { RowDataPacket } from 'mysql2';
import { logger } from '../utils/logger';
import {
  generateSeed,
  currentRotatingPassword,
  deriveRotatingPassword,
  windowIndexAt,
} from '../utils/rotatingPassword';

/** Constant-time string compare that never throws on a length mismatch. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Dedicated web-admin credential — a login that lives entirely in the app-side
 * `users` table (`admin_password_enc`), decoupled from AuthMe / the Minecraft
 * account. See migration 029.
 *
 * Why reversible (AES) instead of a one-way hash: the panel displays the
 * current admin username + password to the shop owner, so the value must be
 * recoverable. This mirrors how RCON passwords are already stored
 * (utils/crypto.ts, AES-256-GCM). The panel mirrors this exact scheme to read
 * and regenerate the value — keep the two in sync.
 *
 * Players are never affected: only a `users` row whose `admin_password_enc`
 * IS NOT NULL uses this path; everyone else stays on authme/bridge.
 */

/** Username base derived from the shop's own domain, e.g.
 *  https://mchanom.siamsite.shop -> "mchanom". Falls back to "admin". */
function shopSlug(): string {
  try {
    const origin = config.corsOrigin && config.corsOrigin !== '*' ? config.corsOrigin : '';
    const host = origin ? new URL(origin).hostname : '';
    const sub = (host.split('.')[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return sub.length >= 3 ? sub.slice(0, 20) : 'admin';
  } catch {
    return 'admin';
  }
}

export interface DedicatedAdminRow {
  id: number;
  username: string;
  role: string;
  deleted_at: Date | null;
}

class AdminCredentialService {
  /** Pick a `<shopslug><2 digits>` username not already taken in users/authme. */
  async generateUniqueUsername(): Promise<string> {
    const base = shopSlug();
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = `${base}${10 + Math.floor(Math.random() * 90)}`;
      const [u] = await pool.execute<RowDataPacket[]>(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1', [candidate]
      );
      const [a] = await pool.execute<RowDataPacket[]>(
        'SELECT 1 FROM authme WHERE LOWER(username) = LOWER(?) LIMIT 1', [candidate]
      );
      if (u.length === 0 && a.length === 0) return candidate;
    }
    return `${base}${Date.now().toString().slice(-6)}`;
  }

  /** Create a brand-new dedicated admin account in ROTATING mode (migration
   *  030): `admin_password_enc` holds a random seed and the login password is
   *  derived per 60s window. Returns the password valid in the current window
   *  ONCE so the setup wizard can display it; the panel shows the live value
   *  thereafter. The owner makes it permanent by setting a custom password. */
  async provision(): Promise<{ userId: number; username: string; password: string }> {
    const username = await this.generateUniqueUsername();
    const seed = generateSeed();
    const enc = encrypt(seed);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.execute(
        'INSERT INTO users (username, email, role, admin_password_enc, admin_pw_rotating) VALUES (?, NULL, ?, ?, 1)',
        [username, 'admin', enc]
      );
      const userId = (res as any).insertId;
      await conn.execute('INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)', [userId]);
      await conn.commit();
      logger.info('Dedicated admin credential provisioned (rotating)', { userId, username });
      return { userId, username, password: currentRotatingPassword(seed) };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Verify a dedicated-admin login. Returns the row on success, else null.
   *  Constant-time comparison; never throws — on any DB error (e.g. the column
   *  not yet added during a rolling deploy) it returns null so login falls
   *  through to the existing authme/bridge path (fail-open, non-breaking). */
  async verify(username: string, password: string): Promise<DedicatedAdminRow | null> {
    let rows: RowDataPacket[];
    try {
      [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, username, role, deleted_at, admin_password_enc, admin_pw_rotating
         FROM users WHERE LOWER(username) = LOWER(?) AND admin_password_enc IS NOT NULL LIMIT 1`,
        [username]
      );
    } catch (err) {
      logger.warn('admin credential verify query failed; falling through to authme', { err: (err as Error).message });
      return null;
    }
    if (rows.length === 0) return null;
    const row = rows[0];

    let secret: string;
    try { secret = decrypt(row.admin_password_enc); } catch { return null; }

    let ok = false;
    if (row.admin_pw_rotating) {
      // Rotating: `secret` is the seed. Accept the current AND previous 60s
      // window so an owner who copies a password right before it rolls over is
      // not locked out (grace window). Fixed-length output → no length leak.
      const w = windowIndexAt();
      for (const idx of [w, w - 1]) {
        if (constantTimeEqual(deriveRotatingPassword(secret, idx), password)) { ok = true; break; }
      }
    } else {
      // Custom (permanent): `secret` is the real password.
      ok = constantTimeEqual(secret, password);
    }
    if (!ok) return null;

    return { id: row.id, username: row.username, role: row.role, deleted_at: row.deleted_at };
  }

  /** True when this user logs in via the dedicated credential (not authme). */
  async isDedicatedAdmin(userId: number): Promise<boolean> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT 1 FROM users WHERE id = ? AND admin_password_enc IS NOT NULL LIMIT 1', [userId]
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /** Read the current usable credential (username + the password valid right
   *  now) for a dedicated admin, or null. For rotating admins this is the
   *  current window's derived password; for custom admins it is the stored one.
   *  Used to detect dedicated admins and for self-service surfaces. */
  async getCurrent(userId: number): Promise<{ username: string; password: string } | null> {
    let rows: RowDataPacket[];
    try {
      [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT username, admin_password_enc, admin_pw_rotating FROM users WHERE id = ? AND admin_password_enc IS NOT NULL LIMIT 1', [userId]
      );
    } catch {
      return null;
    }
    if (rows.length === 0) return null;
    try {
      const secret = decrypt(rows[0].admin_password_enc);
      const password = rows[0].admin_pw_rotating ? currentRotatingPassword(secret) : secret;
      return { username: rows[0].username, password };
    } catch {
      return null;
    }
  }

  /** Set a custom password for a dedicated admin and PIN it (stop rotating).
   *  This is the rotating → permanent transition. No-op for non-dedicated users. */
  async setPassword(userId: number, newPassword: string): Promise<boolean> {
    const enc = encrypt(newPassword);
    const [res] = await pool.execute(
      'UPDATE users SET admin_password_enc = ?, admin_pw_rotating = 0 WHERE id = ? AND admin_password_enc IS NOT NULL', [enc, userId]
    );
    return (res as any).affectedRows > 0;
  }
}

export const adminCredentialService = new AdminCredentialService();
