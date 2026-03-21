import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';
import { config } from '../config';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { JwtPayload } from '../middleware/auth';

class AuthService {
  async register(username: string, password: string, email: string): Promise<{ token: string; user: JwtPayload }> {
    // Check if username already taken in authme
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM authme WHERE LOWER(username) = LOWER(?)', [username]
    );
    if (existing.length > 0) throw new Error('ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว');

    // Check if email already taken
    const [existingEmail] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existingEmail.length > 0) throw new Error('อีเมลล์นี้ถูกใช้ไปแล้ว');

    // Hash password (same bcrypt format AuthMe uses)
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();

    // Insert into authme
    await pool.execute(
      'INSERT INTO authme (username, realname, password, regdate) VALUES (?, ?, ?, ?)',
      [username, username, hashedPassword, now]
    );

    // Create app user + wallet (with email)
    const appUser = await this.createUser(username, email) as { id: number; username: string; role: string };

    const payload: JwtPayload = { userId: appUser.id, username: appUser.username, role: appUser.role };
    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });

    logger.info('User registered', { userId: appUser.id, username: appUser.username });
    return { token, user: payload };
  }

  async login(username: string, password: string): Promise<{ token: string; user: JwtPayload }> {
    // Check AuthMe table
    const [authRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM authme WHERE LOWER(username) = LOWER(?)', [username]
    );
    if (authRows.length === 0) throw new AuthenticationError('Invalid username or password');

    const authUser = authRows[0];
    const validPassword = await bcrypt.compare(password, authUser.password);
    if (!validPassword) throw new AuthenticationError('Invalid username or password');

    // Ensure app user exists
    let appUser: { id: number; username: string; role: string } | null = await this.findUser(authUser.username) as { id: number; username: string; role: string } | null;
    if (!appUser) {
      appUser = await this.createUser(authUser.username);
    }

    const payload: JwtPayload = { userId: appUser.id, username: appUser.username, role: appUser.role };
    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });

    logger.info('User logged in', { userId: appUser.id, username: appUser.username });
    return { token, user: payload };
  }

  private async findUser(username: string) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?)', [username]
    );
    return rows[0] || null;
  }

  private async createUser(username: string, email?: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        'INSERT INTO users (username, email, role) VALUES (?, ?, ?)',
        [username, email || null, 'user']
      );
      const userId = (result as any).insertId;
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
