import { pool } from '../database/connection';
import { ValidationError, NotFoundError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

class WalletService {
  async getBalance(userId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT wallet_balance FROM panel_users WHERE id = ?', [userId]
    );
    if (!rows[0]) throw new NotFoundError('User not found');
    return Number(rows[0].wallet_balance);
  }

  /**
   * Debit on an existing connection inside a transaction the caller controls.
   * Use this when you need to atomically debit + insert another row (e.g. subscription).
   * Caller is responsible for begin/commit/rollback.
   */
  async debitWithin(conn: PoolConnection, userId: number, amount: number, type: string, description: string, referenceId?: string): Promise<number> {
    if (amount <= 0) throw new ValidationError('Amount must be positive');
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT wallet_balance FROM panel_users WHERE id = ? FOR UPDATE', [userId]
    );
    if (!rows[0]) throw new NotFoundError('User not found');
    const current = Number(rows[0].wallet_balance);
    if (current < amount) throw new ValidationError('ยอดเงินไม่เพียงพอ');
    const balanceAfter = current - amount;
    await conn.execute('UPDATE panel_users SET wallet_balance = ? WHERE id = ?', [balanceAfter, userId]);
    await conn.execute(
      'INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)',
      [userId, type, -amount, balanceAfter, description, referenceId ?? null]
    );
    return balanceAfter;
  }

  /** Credit wallet — call inside an existing transaction conn if needed */
  async credit(userId: number, amount: number, type: string, description: string, referenceId?: string): Promise<number> {
    if (amount <= 0) throw new ValidationError('Amount must be positive');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT wallet_balance FROM panel_users WHERE id = ? FOR UPDATE', [userId]
      );
      if (!rows[0]) { await conn.rollback(); throw new NotFoundError('User not found'); }

      const balanceAfter = Number(rows[0].wallet_balance) + amount;
      await conn.execute('UPDATE panel_users SET wallet_balance = ? WHERE id = ?', [balanceAfter, userId]);
      await conn.execute(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)',
        [userId, type, amount, balanceAfter, description, referenceId ?? null]
      );
      await conn.commit();
      return balanceAfter;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /** Debit wallet — throws if insufficient balance */
  async debit(userId: number, amount: number, type: string, description: string, referenceId?: string): Promise<number> {
    if (amount <= 0) throw new ValidationError('Amount must be positive');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT wallet_balance FROM panel_users WHERE id = ? FOR UPDATE', [userId]
      );
      if (!rows[0]) { await conn.rollback(); throw new NotFoundError('User not found'); }

      const current = Number(rows[0].wallet_balance);
      if (current < amount) { await conn.rollback(); throw new ValidationError('ยอดเงินไม่เพียงพอ'); }

      const balanceAfter = current - amount;
      await conn.execute('UPDATE panel_users SET wallet_balance = ? WHERE id = ?', [balanceAfter, userId]);
      await conn.execute(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)',
        [userId, type, -amount, balanceAfter, description, referenceId ?? null]
      );
      await conn.commit();
      return balanceAfter;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async getTransactions(userId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    const [count] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?', [userId]
    );
    return { transactions: rows, total: count[0].total, page, limit };
  }
}

export const walletService = new WalletService();
