import { pool } from '../database/connection';
import { NotFoundError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';

class UserService {
  async getProfile(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.role, u.created_at, COALESCE(w.balance, 0) as wallet_balance
       FROM users u LEFT JOIN wallets w ON u.id = w.user_id WHERE u.id = ?`, [userId]
    );
    if (rows.length === 0) throw new NotFoundError('User not found');
    return rows[0];
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
}

export const userService = new UserService();
