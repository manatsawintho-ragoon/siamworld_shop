import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';
import { config } from '../config';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { JwtPayload } from '../middleware/auth';

class AuthService {
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

  private async createUser(username: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute('INSERT INTO users (username, role) VALUES (?, ?)', [username, 'user']);
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
