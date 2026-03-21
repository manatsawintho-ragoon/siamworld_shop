import { pool } from '../database/connection';
import bcrypt from 'bcrypt';
import { NotFoundError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';

class UserService {
  async getProfile(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.role, u.created_at, COALESCE(w.balance, 0) as wallet_balance
       FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE u.id = ?`, [userId]
    );
    if (rows.length === 0) throw new NotFoundError('User not found');

    const [stats] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_topup,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) THEN amount ELSE 0 END), 0) as monthly_topup
       FROM transactions 
       WHERE user_id = ? AND type = 'topup' AND status = 'success'`,
      [userId]
    );

    const [codes] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(id) as used_codes_count FROM redeem_logs WHERE user_id = ?', [userId]
    );

    const [spentStats] = await pool.execute<RowDataPacket[]>(
      "SELECT COALESCE(SUM(ABS(amount)), 0) as total_spent FROM transactions WHERE user_id = ? AND type = 'purchase' AND status = 'success'", [userId]
    );

    return {
      ...rows[0],
      total_topup: parseFloat(stats[0].total_topup || '0'),
      monthly_topup: parseFloat(stats[0].monthly_topup || '0'),
      used_codes_count: codes[0].used_codes_count,
      total_spent: parseFloat(spentStats[0].total_spent || '0')
    };
  }

  async getAllUsers(page: number = 1, limit: number = 20, search?: string) {
    const offset = (page - 1) * limit;
    const params: (string | number)[] = [];
    let whereClause = '';
    if (search) {
      whereClause = 'WHERE u.username LIKE ?';
      params.push(`%${search}%`);
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.role, u.created_at, COALESCE(w.balance, 0) as wallet_balance
       FROM users u LEFT JOIN wallets w ON u.id = w.user_id
       ${whereClause} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );
    const countParams = search ? [`%${search}%`] : [];
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`, countParams
    );
    const total = countResult[0].total;
    return { users: rows, total, pagination: { page, totalPages: Math.ceil(total / limit), total } };
  }

  async updateUserRole(userId: number, role: 'user' | 'admin') {
    const [result] = await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    if ((result as any).affectedRows === 0) throw new NotFoundError('User not found');
  }

  async updateUserProfile(userId: number, data: { email?: string, password?: string, balance?: number, role?: 'user' | 'admin' }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [userRows] = await conn.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      if (userRows.length === 0) throw new NotFoundError('User not found');
      const username = userRows[0].username;

      if (data.role || data.email !== undefined) {
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        if (data.role) { updateFields.push('role = ?'); updateValues.push(data.role); }
        if (data.email !== undefined) { updateFields.push('email = ?'); updateValues.push(data.email || null); }
        if (updateFields.length > 0) {
          updateValues.push(userId);
          await conn.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }
      }

      if (data.balance !== undefined) {
        const [walletRows] = await conn.execute<RowDataPacket[]>('SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]);
        const currentBalance = walletRows.length > 0 ? parseFloat(walletRows[0].balance) : 0;
        
        if (currentBalance !== data.balance) {
          const diff = data.balance - currentBalance;
          if (walletRows.length > 0) {
            await conn.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [data.balance, userId]);
          } else {
            await conn.execute('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [userId, data.balance]);
          }
          
          const action = diff > 0 ? 'credit' : 'debit';
          await conn.execute(
            'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, description) VALUES (?,?,?,?,?,?,?)',
            [userId, action, Math.abs(diff), currentBalance, data.balance, 'admin', 'แอดมินแก้ไขยอดเงิน']
          );
        }
      }

      if (data.password) {
         const hashedPassword = await bcrypt.hash(data.password, 10);
         await conn.execute('UPDATE authme SET password = ? WHERE LOWER(username) = LOWER(?)', [hashedPassword, username]);
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getUserHistory(userId: number, type: 'topup' | 'purchase' | 'redeem', page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    if (type === 'topup') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT id, amount, created_at, description, reference as reference_id FROM transactions WHERE user_id = ? AND type = 'topup' AND status = 'success' ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [userId, String(limit), String(offset)]
      );
      const [countResult] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as total FROM transactions WHERE user_id = ? AND type = 'topup' AND status = 'success'", [userId]);
      const total = countResult[0].total;
      return { logs: rows, pagination: { page, totalPages: Math.ceil(total / limit), total } };
    } else if (type === 'purchase') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT id, ABS(amount) as amount, created_at, description, reference as reference_id FROM transactions WHERE user_id = ? AND type = 'purchase' AND status = 'success' ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [userId, String(limit), String(offset)]
      );
      const [countResult] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as total FROM transactions WHERE user_id = ? AND type = 'purchase' AND status = 'success'", [userId]);
      const total = countResult[0].total;
      return { logs: rows, pagination: { page, totalPages: Math.ceil(total / limit), total } };
    } else if (type === 'redeem') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT rl.id, rl.redeemed_at as created_at, c.code as reference_id, c.reward_type, c.point_amount, c.command 
         FROM redeem_logs rl 
         JOIN redeem_codes c ON rl.code_id = c.id
         WHERE rl.user_id = ? ORDER BY rl.redeemed_at DESC LIMIT ? OFFSET ?`,
        [userId, String(limit), String(offset)]
      );
      const [countResult] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM redeem_logs WHERE user_id = ?', [userId]);
      const total = countResult[0].total;
      return { logs: rows, pagination: { page, totalPages: Math.ceil(total / limit), total } };
    }

    return { logs: [], pagination: { page: 1, totalPages: 0, total: 0 } };
  }
}

export const userService = new UserService();
