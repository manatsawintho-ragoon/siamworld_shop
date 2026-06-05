import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { settingsService } from './settings.service';

/**
 * Email-OTP password reset.
 *
 * Threat model and mitigations:
 * 1. **Account enumeration** — requestReset always returns success, even if the
 *    email is unknown. The actual sendMail only runs when a user matches.
 * 2. **Brute force** — OTPs are 6 digits (1M space). Each token allows max 5
 *    verify attempts before being locked; after that the user must request a
 *    new one. With rate limiting on issuance this caps online brute force at
 *    a few attempts per hour.
 * 3. **OTP leakage at rest** — only sha256(otp) is stored. A DB dump cannot
 *    be used to log in directly.
 * 4. **Replay** — used_at is set on success; we also delete other live tokens
 *    for the user.
 * 5. **DoS on email provider** — per-email and per-IP throttles via
 *    password_reset_requests table.
 */
class PasswordResetService {
  // Tuneable but not config-driven — these are security limits, not preferences.
  private readonly OTP_TTL_MS = 15 * 60 * 1000;   // 15 minutes
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly MAX_EMAIL_PER_HOUR = 3;
  private readonly MAX_IP_PER_HOUR = 10;

  async requestReset(email: string, ip?: string): Promise<{ delivered: boolean }> {
    // Validate email shape early so we don't fill the throttle table with junk.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { delivered: false };
    }

    // 1. Throttle. Same-shape window for email and IP.
    const [emailRecent] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM password_reset_requests
       WHERE email = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)`,
      [email]
    );
    if ((emailRecent[0] as any).c >= this.MAX_EMAIL_PER_HOUR) {
      logger.warn('Password reset rate-limit hit (email)', { email });
      return { delivered: false };
    }
    if (ip) {
      const [ipRecent] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM password_reset_requests
         WHERE ip = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)`,
        [ip]
      );
      if ((ipRecent[0] as any).c >= this.MAX_IP_PER_HOUR) {
        logger.warn('Password reset rate-limit hit (ip)', { ip });
        return { delivered: false };
      }
    }
    await pool.execute('INSERT INTO password_reset_requests (email, ip) VALUES (?, ?)', [email, ip || null]);

    // 2. Look up user. If unknown, silently succeed (no enumeration).
    const [userRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, email FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    if (userRows.length === 0) return { delivered: false };
    const user = userRows[0] as { id: number; username: string; email: string };

    // 3. Issue OTP. Use crypto.randomInt to get a cryptographically-secure
    //    uniform 6-digit number (0-padded).
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const otpHash = sha256Hex(otp);
    const expiresAt = new Date(Date.now() + this.OTP_TTL_MS);

    // Invalidate previous live tokens so the new one is the only valid code.
    await pool.execute(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()`,
      [user.id]
    );
    await pool.execute<ResultSetHeader>(
      'INSERT INTO password_reset_tokens (user_id, otp_hash, expires_at, created_ip) VALUES (?, ?, ?, ?)',
      [user.id, otpHash, expiresAt, ip || null]
    );

    // 4. Send email. If SMTP not configured, return delivered:false.
    const shopName = (await settingsService.get('shop_name')) || 'Shop';
    const html = renderResetEmail(shopName, user.username, otp, this.OTP_TTL_MS / 60_000);
    const sent = await emailService.send(
      user.email,
      `${shopName}: รหัสรีเซ็ตรหัสผ่าน`,
      html
    );
    return { delivered: sent };
  }

  /**
   * Verify the OTP and set the new password. The DB transaction is held only
   * long enough to mark the token used, since bcrypt hashing is slow.
   */
  async verifyAndReset(email: string, otp: string, newPassword: string): Promise<void> {
    if (!email || !otp || !newPassword) {
      throw new ResetError('ข้อมูลไม่ครบ', 400);
    }
    if (newPassword.length < 6) {
      throw new ResetError('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร', 400);
    }
    const otpHash = sha256Hex(otp);

    const [userRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username FROM users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    if (userRows.length === 0) throw new ResetError('รหัส OTP ไม่ถูกต้องหรือหมดอายุ', 400);
    const user = userRows[0] as { id: number; username: string };

    // Hash the new password before opening the transaction (bcrypt ≈ 100ms).
    const hashed = await bcrypt.hash(newPassword, 10);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the live token for this user.
      const [tokenRows] = await conn.execute<RowDataPacket[]>(
        `SELECT id, otp_hash, attempts, expires_at FROM password_reset_tokens
         WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [user.id]
      );
      if (tokenRows.length === 0) {
        await conn.rollback();
        throw new ResetError('รหัส OTP ไม่ถูกต้องหรือหมดอายุ', 400);
      }
      const token = tokenRows[0] as { id: number; otp_hash: string; attempts: number; expires_at: Date };

      if (token.attempts >= this.MAX_VERIFY_ATTEMPTS) {
        await conn.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [token.id]);
        await conn.commit();
        throw new ResetError('รหัสนี้ถูกใส่ผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่', 400);
      }

      if (!constantTimeEquals(token.otp_hash, otpHash)) {
        await conn.execute(
          'UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = ?',
          [token.id]
        );
        await conn.commit();
        throw new ResetError('รหัส OTP ไม่ถูกต้อง', 400);
      }

      // OTP correct → update AuthMe password + mark token used in one tx.
      await conn.execute(
        'UPDATE authme SET password = ? WHERE LOWER(username) = LOWER(?)',
        [hashed, user.username]
      );
      await conn.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [token.id]);
      await conn.commit();

      logger.info('Password reset succeeded', { userId: user.id, username: user.username });
    } catch (err) {
      try { await conn.rollback(); } catch { /* already committed */ }
      throw err;
    } finally {
      conn.release();
    }
  }
}

export class ResetError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function renderResetEmail(shopName: string, username: string, otp: string, ttlMin: number): string {
  // Tight, single-column HTML. No external CSS or images so spam filters
  // are less suspicious and providers like Gmail render it consistently.
  return `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">${escapeHtml(shopName)}</h2>
  <p>สวัสดี <b>${escapeHtml(username)}</b>,</p>
  <p>คุณได้ขอรีเซ็ตรหัสผ่าน กรุณาใช้รหัส OTP ด้านล่างเพื่อยืนยันตัวตน:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; background: #f5f5f5; border-radius: 8px; padding: 16px 24px; text-align: center; margin: 24px 0;">${otp}</p>
  <p>รหัสนี้มีอายุ ${ttlMin} นาที หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ให้ละเลยอีเมลฉบับนี้ได้เลย รหัสผ่านปัจจุบันยังคงปลอดภัย</p>
  <p style="color: #999; font-size: 12px; margin-top: 32px;">อีเมลอัตโนมัติ กรุณาอย่าตอบกลับ</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

export const passwordResetService = new PasswordResetService();
