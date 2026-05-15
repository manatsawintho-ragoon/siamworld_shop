import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../database/connection';
import { config } from '../config';
import { AuthError, ConflictError, ValidationError } from '../utils/errors';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createSession, destroySession } from './session.service';

/**
 * Minimum password policy:
 *   - 8+ characters
 *   - At least 3 of: lowercase, uppercase, digit, symbol
 * Rejects classics like "password", "12345678", and the user's own email prefix.
 */
function assertStrongPassword(password: string, email?: string): void {
  if (password.length < 8) {
    throw new ValidationError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  }
  if (password.length > 128) {
    throw new ValidationError('รหัสผ่านยาวเกินไป');
  }
  const classes = [
    /[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/,
  ].reduce((n, re) => n + (re.test(password) ? 1 : 0), 0);
  if (classes < 3) {
    throw new ValidationError('รหัสผ่านต้องประกอบด้วยตัวพิมพ์เล็ก ใหญ่ ตัวเลข หรือสัญลักษณ์ อย่างน้อย 3 ใน 4 ประเภท');
  }
  const lc = password.toLowerCase();
  const banned = ['password', '12345678', 'qwerty', 'siamsite', 'siamworld'];
  if (banned.some(b => lc.includes(b))) {
    throw new ValidationError('รหัสผ่านอ่อนแอเกินไป กรุณาเลือกใหม่');
  }
  if (email) {
    const localPart = email.split('@')[0].toLowerCase();
    if (localPart.length >= 3 && lc.includes(localPart)) {
      throw new ValidationError('รหัสผ่านห้ามมีส่วนของอีเมล');
    }
  }
}

interface PanelUser extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  phone: string | null;
  wallet_balance: number;
  line_notify_token: string | null;
  role: 'customer' | 'admin';
}

class AuthService {
  async register(email: string, password: string, displayName: string, phone?: string, signupIp?: string) {
    assertStrongPassword(password, email);

    const [existing] = await pool.execute<PanelUser[]>(
      'SELECT id FROM panel_users WHERE email = ?', [email]
    );
    if (existing.length) throw new ConflictError('อีเมลนี้มีผู้ใช้งานแล้ว');

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO panel_users (email, password_hash, display_name, phone, signup_ip) VALUES (?,?,?,?,?)',
      [email, passwordHash, displayName, phone ?? null, signupIp ?? null]
    );

    const jti = await createSession(result.insertId);
    const token = this.signToken(result.insertId, email, 'customer', jti);
    return { token, user: { id: result.insertId, email, displayName, role: 'customer', walletBalance: 0 } };
  }

  async login(email: string, password: string) {
    const [rows] = await pool.execute<PanelUser[]>(
      'SELECT * FROM panel_users WHERE email = ?', [email]
    );
    const user = rows[0];
    if (!user) throw new AuthError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new AuthError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    // Create new session — atomically replaces any existing session (single-device enforcement)
    const jti = await createSession(user.id);
    const token = this.signToken(user.id, user.email, user.role, jti);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        walletBalance: Number(user.wallet_balance),
        lineNotifyToken: user.line_notify_token,
      }
    };
  }

  async logout(userId: number): Promise<void> {
    await destroySession(userId);
  }

  async getProfile(userId: number) {
    const [rows] = await pool.execute<PanelUser[]>(
      'SELECT id, email, display_name, phone, wallet_balance, line_notify_token, role, created_at FROM panel_users WHERE id = ?',
      [userId]
    );
    const u = rows[0];
    if (!u) throw new AuthError();
    return {
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      phone: u.phone,
      walletBalance: Number(u.wallet_balance),
      lineNotifyToken: u.line_notify_token,
      role: u.role,
      createdAt: u.created_at,
    };
  }

  async updateProfile(userId: number, data: { displayName?: string; phone?: string; lineNotifyToken?: string }) {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (data.displayName !== undefined) { fields.push('display_name = ?'); values.push(data.displayName); }
    if (data.phone !== undefined)       { fields.push('phone = ?');        values.push(data.phone); }
    if (data.lineNotifyToken !== undefined) { fields.push('line_notify_token = ?'); values.push(data.lineNotifyToken || null); }
    if (!fields.length) return;
    values.push(userId);
    await pool.execute(`UPDATE panel_users SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const [rows] = await pool.execute<PanelUser[]>(
      'SELECT password_hash, email FROM panel_users WHERE id = ?', [userId]
    );
    const user = rows[0];
    if (!user) throw new AuthError();
    assertStrongPassword(newPassword, user.email);
    const ok = await bcrypt.compare(oldPassword, user.password_hash);
    if (!ok) throw new AuthError('รหัสผ่านเดิมไม่ถูกต้อง');
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE panel_users SET password_hash = ? WHERE id = ?', [hash, userId]);
    // Invalidate session so user must log in again with new password
    await destroySession(userId);
  }

  async handleSocialLogin(email: string, socialId: string, provider: 'google' | 'facebook', displayName: string, avatarUrl?: string, signupIp?: string) {
    // Check if user exists by email
    const [existing] = await pool.execute<PanelUser[]>(
      'SELECT * FROM panel_users WHERE email = ?', [email]
    );

    let user = existing[0];

    if (user) {
      // User exists, update social ID if not set
      const idField = provider === 'google' ? 'google_id' : 'facebook_id';
      if (!user[idField]) {
        await pool.execute(
          `UPDATE panel_users SET ${idField} = ?, avatar_url = ? WHERE id = ?`,
          [socialId, avatarUrl || user.avatar_url, user.id]
        );
      }
    } else {
      // User doesn't exist, create new
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12); // Dummy password (inaccessible — social login only)
      const idField = provider === 'google' ? 'google_id' : 'facebook_id';

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO panel_users (email, password_hash, display_name, ${idField}, avatar_url, signup_ip) VALUES (?,?,?,?,?,?)`,
        [email, passwordHash, displayName, socialId, avatarUrl || null, signupIp ?? null]
      );

      const [newRows] = await pool.execute<PanelUser[]>(
        'SELECT * FROM panel_users WHERE id = ?', [result.insertId]
      );
      user = newRows[0];
    }

    // Create new session — replaces any existing session (single-device enforcement)
    const jti = await createSession(user.id);
    const token = this.signToken(user.id, user.email, user.role, jti);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        walletBalance: Number(user.wallet_balance),
        lineNotifyToken: user.line_notify_token,
        avatarUrl: user.avatar_url
      }
    };
  }

  private signToken(userId: number, email: string, role: 'customer' | 'admin', jti: string): string {
    return jwt.sign({ userId, email, role, jti }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
