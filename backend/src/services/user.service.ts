import { pool } from '../database/connection';
import bcrypt from 'bcrypt';
import { NotFoundError, ConflictError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';
import { destroySession } from './session.service';

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
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE() THEN amount ELSE 0 END), 0) as daily_topup,
        COALESCE(SUM(CASE WHEN YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1) THEN amount ELSE 0 END), 0) as weekly_topup,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) THEN amount ELSE 0 END), 0) as monthly_topup,
        COUNT(*) as topup_count,
        MAX(created_at) as last_topup_at
       FROM transactions
       WHERE user_id = ? AND type = 'topup' AND status = 'success'`,
      [userId]
    );

    const [codes] = await pool.execute<RowDataPacket[]>(
      `SELECT
        COUNT(id) as used_codes_count,
        COALESCE(SUM(CASE WHEN DATE(redeemed_at) = CURRENT_DATE() THEN 1 ELSE 0 END), 0) as daily_redeem_count
       FROM redeem_logs WHERE user_id = ?`, [userId]
    );

    const [spentStats] = await pool.execute<RowDataPacket[]>(
      `SELECT
        COALESCE(SUM(ABS(amount)), 0) as total_spent,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE() THEN ABS(amount) ELSE 0 END), 0) as daily_spent,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE() THEN 1 ELSE 0 END), 0) as daily_purchase_count,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) THEN ABS(amount) ELSE 0 END), 0) as monthly_spent,
        COUNT(*) as purchase_count
       FROM transactions WHERE user_id = ? AND type = 'purchase' AND status = 'success'`,
      [userId]
    );

    const totalTopup = parseFloat(stats[0].total_topup || '0');
    const totalSpent = parseFloat(spentStats[0].total_spent || '0');
    const topupCount = parseInt(stats[0].topup_count || '0');

    return {
      ...rows[0],
      total_topup: totalTopup,
      daily_topup: parseFloat(stats[0].daily_topup || '0'),
      weekly_topup: parseFloat(stats[0].weekly_topup || '0'),
      monthly_topup: parseFloat(stats[0].monthly_topup || '0'),
      topup_count: topupCount,
      last_topup_at: stats[0].last_topup_at || null,
      avg_topup: topupCount > 0 ? Math.round((totalTopup / topupCount) * 100) / 100 : 0,
      used_codes_count: codes[0].used_codes_count,
      daily_redeem_count: parseInt(codes[0].daily_redeem_count || '0'),
      total_spent: totalSpent,
      daily_spent: parseFloat(spentStats[0].daily_spent || '0'),
      daily_purchase_count: parseInt(spentStats[0].daily_purchase_count || '0'),
      monthly_spent: parseFloat(spentStats[0].monthly_spent || '0'),
      purchase_count: parseInt(spentStats[0].purchase_count || '0'),
      net_balance_rate: totalTopup > 0 ? Math.round(((totalTopup - totalSpent) / totalTopup) * 100) : 100,
    };
  }

  async getAllUsers(page: number = 1, limit: number = 20, search?: string) {
    const offset = (page - 1) * limit;
    const params: (string | number)[] = [];
    // Always hide soft-deleted users so admins don't see (and re-try to delete)
    // accounts that are already gone.
    let whereClause = 'WHERE u.deleted_at IS NULL';
    if (search) {
      whereClause += ' AND u.username LIKE ?';
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

  /**
   * Soft-delete a user. Preserves wallet/transaction/audit history so account
   * losses and disputes can still be resolved. The user can no longer log in
   * (auth.service.login checks deleted_at) and their session is destroyed.
   */
  async softDeleteUser(userId: number): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT username, deleted_at FROM users WHERE id = ?', [userId]
      );
      if (rows.length === 0) throw new NotFoundError('User not found');
      if ((rows[0] as any).deleted_at) {
        await conn.rollback();
        throw new ConflictError('ผู้ใช้นี้ถูกลบไปแล้ว');
      }
      await conn.execute('UPDATE users SET deleted_at = NOW() WHERE id = ?', [userId]);
      await conn.commit();
    } catch (err) {
      try { await conn.rollback(); } catch { /* tx may be committed */ }
      throw err;
    } finally {
      conn.release();
    }
    // Kill any active session so the JWT can't be reused. Failure here is
    // non-fatal — the JWT will still expire on its own.
    try { await destroySession(userId); } catch { /* ignore */ }
  }

  /**
   * Transfer all financial + game-state from one user to another in a single
   * transaction. The source user keeps its row + audit trail; the target
   * absorbs balances, purchases, inventory, and redeem-code usage.
   *
   * Order matters:
   *   1. Lock both wallets (smaller id first to avoid deadlocks).
   *   2. Merge balances.
   *   3. Re-attribute FK rows.
   *   4. Soft-delete the source so the username can't double-claim history.
   */
  async transferData(fromUserId: number, toUserId: number): Promise<{
    merged: { balance: number; transactions: number; purchases: number; inventory: number; redeemLogs: number };
  }> {
    if (fromUserId === toUserId) throw new Error('ผู้ใช้ต้นทางและปลายทางต้องไม่ใช่บัญชีเดียวกัน');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [fromRows] = await conn.execute<RowDataPacket[]>(
        'SELECT id, username, deleted_at FROM users WHERE id = ? FOR UPDATE', [fromUserId]
      );
      const [toRows] = await conn.execute<RowDataPacket[]>(
        'SELECT id, username, deleted_at FROM users WHERE id = ? FOR UPDATE', [toUserId]
      );
      if (fromRows.length === 0) throw new NotFoundError('ไม่พบผู้ใช้ต้นทาง');
      if (toRows.length === 0) throw new NotFoundError('ไม่พบผู้ใช้ปลายทาง');
      if ((toRows[0] as any).deleted_at) throw new ConflictError('ผู้ใช้ปลายทางถูกลบไปแล้ว');

      // Lock wallets in stable id order to avoid deadlocks under concurrent transfers.
      const a = Math.min(fromUserId, toUserId);
      const b = Math.max(fromUserId, toUserId);
      const [walletA] = await conn.execute<RowDataPacket[]>(
        'SELECT user_id, balance FROM wallets WHERE user_id = ? FOR UPDATE', [a]
      );
      const [walletB] = await conn.execute<RowDataPacket[]>(
        'SELECT user_id, balance FROM wallets WHERE user_id = ? FOR UPDATE', [b]
      );
      const fromBalance = parseFloat(
        (walletA[0] as any)?.user_id === fromUserId
          ? ((walletA[0] as any)?.balance ?? '0')
          : ((walletB[0] as any)?.balance ?? '0')
      );
      const toBalance = parseFloat(
        (walletA[0] as any)?.user_id === toUserId
          ? ((walletA[0] as any)?.balance ?? '0')
          : ((walletB[0] as any)?.balance ?? '0')
      );

      // 1. Balance merge — credit target, zero source.
      if (fromBalance > 0) {
        if (walletA.length + walletB.length < 2) {
          // Target had no wallet row yet — create one with the merged amount.
          await conn.execute('INSERT INTO wallets (user_id, balance) VALUES (?, ?)', [toUserId, toBalance + fromBalance]);
        } else {
          await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [fromBalance, toUserId]);
        }
        await conn.execute('UPDATE wallets SET balance = 0 WHERE user_id = ?', [fromUserId]);

        // Audit the merge as a paired wallet_log entry on each side.
        await conn.execute(
          'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, description) VALUES (?,?,?,?,?,?,?)',
          [fromUserId, 'debit', fromBalance, fromBalance, 0, 'admin', `โอนยอดเงินไปที่ ${(toRows[0] as any).username}`]
        );
        await conn.execute(
          'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, description) VALUES (?,?,?,?,?,?,?)',
          [toUserId, 'credit', fromBalance, toBalance, toBalance + fromBalance, 'admin', `รับโอนยอดจาก ${(fromRows[0] as any).username}`]
        );
      }

      // 2. Re-attribute single-FK tables. CHANGE_ROWS counts how many we moved.
      const [tx] = await conn.execute('UPDATE transactions SET user_id = ? WHERE user_id = ?', [toUserId, fromUserId]);
      const [pu] = await conn.execute('UPDATE purchases SET user_id = ? WHERE user_id = ?', [toUserId, fromUserId]);
      const [wi] = await conn.execute('UPDATE web_inventory SET user_id = ? WHERE user_id = ?', [toUserId, fromUserId]);
      // truemoney_used uses user_id as audit only; safe to re-attribute.
      await conn.execute('UPDATE truemoney_used SET user_id = ? WHERE user_id = ?', [toUserId, fromUserId]);

      // 3. redeem_logs has UNIQUE (code_id, user_id). UPDATE IGNORE silently skips
      //    conflicts (target already used that code); a follow-up DELETE removes
      //    the leftover source rows that were not moved.
      const [rl] = await conn.execute('UPDATE IGNORE redeem_logs SET user_id = ? WHERE user_id = ?', [toUserId, fromUserId]);
      await conn.execute('DELETE FROM redeem_logs WHERE user_id = ?', [fromUserId]);

      // 4. Soft-delete the source so its username is retired in this app.
      await conn.execute('UPDATE users SET deleted_at = NOW() WHERE id = ?', [fromUserId]);

      await conn.commit();

      // Best-effort: kill source's session so they're logged out instantly.
      try { await destroySession(fromUserId); } catch { /* ignore */ }

      return {
        merged: {
          balance: fromBalance,
          transactions: (tx as any).affectedRows || 0,
          purchases: (pu as any).affectedRows || 0,
          inventory: (wi as any).affectedRows || 0,
          redeemLogs: (rl as any).affectedRows || 0,
        },
      };
    } catch (err) {
      try { await conn.rollback(); } catch { /* already committed */ }
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const userService = new UserService();
