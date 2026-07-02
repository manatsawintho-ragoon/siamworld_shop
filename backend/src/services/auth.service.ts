import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';
import { config } from '../config';
import { AuthenticationError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { JwtPayload } from '../middleware/auth';
import { createSession, destroySession } from './session.service';
import { bridgeClient } from './bridge-client.service';
import { adminCredentialService } from './admin-credential.service';

// AuthMe SHA256: $SHA$<salt>$sha256(sha256(password) + salt)
function verifyAuthMeSHA256(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[1] !== 'SHA') return false;
  const [, , salt, hash] = parts;
  const inner = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
  const computed = crypto.createHash('sha256').update(inner + salt, 'utf8').digest('hex');
  return computed === hash;
}

// When bridge mode is on, "user not found in MC AuthMe" and "bridge unreachable"
// both let us fall back to local authme — the first covers legacy pre-bridge
// accounts and the second prevents lockouts when the plugin is offline.
const BRIDGE_FALLBACK_REASONS = new Set(['unknown_user', 'bridge_unreachable', 'bridge_timeout', 'unauthorized']);

class AuthService {
  async register(username: string, password: string, email: string): Promise<{ token: string; user: JwtPayload }> {
    if (config.bridge.enabled) {
      // Web register is disabled in bridge mode — MC AuthMe is the source of truth.
      // The bridge protocol has no register opcode yet (M3 ships verify only), so we'd
      // otherwise create accounts that exist on the web but not on the MC server.
      throw new ValidationError('กรุณาสมัครสมาชิกใน Minecraft ก่อนด้วยคำสั่ง /register <รหัสผ่าน> <รหัสผ่าน> แล้วจึงเข้าสู่ระบบในเว็บด้วยชื่อและรหัสเดียวกัน');
    }

    // Hash password before opening transaction (bcrypt is slow — don't hold DB connection)
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check username (lock row if exists to prevent concurrent duplicate registration)
      const [existing] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM authme WHERE LOWER(username) = LOWER(?)', [username]
      );
      if (existing.length > 0) throw new ValidationError('ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว');

      // Check email
      const [existingEmail] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ?', [email]
      );
      if (existingEmail.length > 0) throw new ValidationError('อีเมลล์นี้ถูกใช้ไปแล้ว');

      // Insert into authme — include email so AuthMe plugin also shows correct email
      await conn.execute(
        'INSERT INTO authme (username, realname, password, regdate, email) VALUES (?, ?, ?, ?, ?)',
        [username, username, hashedPassword, now, email]
      );

      // Insert app user + wallet in same transaction
      const [userResult] = await conn.execute(
        'INSERT INTO users (username, email, role) VALUES (?, ?, ?)',
        [username, email, 'user']
      );
      const userId = (userResult as any).insertId;
      await conn.execute('INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)', [userId]);

      await conn.commit();

      const jti = await createSession(userId);
      const payload: JwtPayload = { userId, username, role: 'user', jti };
      const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });

      logger.info('User registered', { userId, username });
      return { token, user: payload };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async login(username: string, password: string): Promise<{ token: string; user: JwtPayload }> {
    // 1. Dedicated web-admin credential (decoupled from authme/bridge). Tried
    //    first so the shop owner can always reach the admin panel even when the
    //    shop runs in Bridge mode, where authme is not authoritative. A normal
    //    player can never own this row (users.username is unique), so this only
    //    ever matches the shop's dedicated admin.
    const adminRow = await adminCredentialService.verify(username, password);
    if (adminRow) {
      // Soft-deleted admin: return the generic error, don't leak why.
      if (adminRow.deleted_at) throw new AuthenticationError('Invalid username or password');
      return this.finalizeLogin(adminRow.username, null);
    }

    if (config.bridge.enabled) {
      const bridgeResult = await bridgeClient.verifyAuthme(username, password);
      if (bridgeResult.ok) {
        return this.finalizeLogin(username, bridgeResult.email || null);
      }
      // `banned` or `bad_password`: MC is authoritative — reject without consulting local.
      // Anything else (unknown_user / bridge_unreachable / bridge_timeout / unauthorized):
      // fall through to local authme so legacy web users + bridge-down scenarios both work.
      if (!bridgeResult.reason || !BRIDGE_FALLBACK_REASONS.has(bridgeResult.reason)) {
        logger.info('Bridge auth rejected', { username, reason: bridgeResult.reason });
        throw new AuthenticationError('Invalid username or password');
      }
      logger.debug('Bridge fallback to local authme', { username, reason: bridgeResult.reason });
    }

    return this.loginLocal(username, password);
  }

  private async loginLocal(username: string, password: string): Promise<{ token: string; user: JwtPayload }> {
    const [authRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM authme WHERE LOWER(username) = LOWER(?)', [username]
    );
    if (authRows.length === 0) throw new AuthenticationError('Invalid username or password');

    const authUser = authRows[0];
    let validPassword: boolean;
    if (authUser.password?.startsWith('$SHA$')) {
      validPassword = verifyAuthMeSHA256(password, authUser.password);
    } else {
      validPassword = await bcrypt.compare(password, authUser.password);
    }
    if (!validPassword) throw new AuthenticationError('Invalid username or password');

    return this.finalizeLogin(authUser.username, null);
  }

  // Ensures the app-side `users` + `wallets` rows exist and issues the JWT.
  // Shared by local and bridge login paths so the post-auth flow stays identical.
  private async finalizeLogin(username: string, emailFromBridge: string | null): Promise<{ token: string; user: JwtPayload }> {
    let appUser: { id: number; username: string; role: string; deleted_at: Date | null; banned_at: Date | null } | null =
      await this.findUser(username) as any;
    if (!appUser) {
      appUser = { ...(await this.createUser(username, emailFromBridge || undefined)), deleted_at: null, banned_at: null };
    }
    if (appUser.deleted_at || appUser.banned_at) {
      // Soft-deleted or suspended (banned) users cannot log in. Don't leak why —
      // return the generic error.
      throw new AuthenticationError('Invalid username or password');
    }

    const jti = await createSession(appUser.id);
    const payload: JwtPayload = { userId: appUser.id, username: appUser.username, role: appUser.role, jti };
    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });

    logger.info('User logged in', { userId: appUser.id, username: appUser.username });
    return { token, user: payload };
  }

  async logout(userId: number): Promise<void> {
    await destroySession(userId);
    logger.info('User logged out', { userId });
  }

  private async findUser(username: string) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, role, deleted_at, banned_at FROM users WHERE LOWER(username) = LOWER(?)', [username]
    );
    return rows[0] || null;
  }

  private async createUser(username: string, email?: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      let userId: number;
      try {
        const [result] = await conn.execute(
          'INSERT INTO users (username, email, role) VALUES (?, ?, ?)',
          [username, email || null, 'user']
        );
        userId = (result as any).insertId;
      } catch (err: any) {
        // Two MC AuthMe accounts can share an email (AuthMe doesn't enforce uniqueness).
        // Web-side `users.email` is UNIQUE, so retry without email rather than blocking login.
        if (err?.code === 'ER_DUP_ENTRY' && email) {
          logger.warn('Duplicate email on user creation, retrying with null', { username, email });
          const [result] = await conn.execute(
            'INSERT INTO users (username, email, role) VALUES (?, ?, ?)',
            [username, null, 'user']
          );
          userId = (result as any).insertId;
        } else {
          throw err;
        }
      }
      await conn.execute('INSERT INTO wallets (user_id, balance) VALUES (?, 0.00)', [userId]);
      await conn.commit();
      return { id: userId, username, role: 'user' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const authService = new AuthService();
