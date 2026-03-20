import { pool } from '../database/connection';
import { NotFoundError, InsufficientBalanceError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';

class WalletService {
  async getWallet(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM wallets WHERE user_id = ?', [userId]
    );
    if (rows.length === 0) throw new NotFoundError('Wallet not found');
    return rows[0];
  }

  async topup(userId: number, amount: number, method?: string, reference?: string, description?: string) {
    if (amount <= 0) throw new ValidationError('Amount must be positive');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get current balance for wallet log
      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');
      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter = balanceBefore + amount;

      await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
      await conn.execute(
        'INSERT INTO transactions (user_id, amount, type, method, status, reference, description) VALUES (?,?,?,?,?,?,?)',
        [userId, amount, 'topup', method || 'system', 'success', reference || null, description || 'Top-up']
      );

      // Wallet log for audit trail
      await conn.execute(
        'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description) VALUES (?,?,?,?,?,?,?,?)',
        [userId, 'credit', amount, balanceBefore, balanceAfter, method || 'system', reference || null, description || 'Top-up']
      );

      await conn.commit();
      const wallet = await this.getWallet(userId);
      logger.info('Wallet topup', { userId, amount, method });
      return wallet;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Deduct from wallet with row-level locking */
  async spend(userId: number, amount: number, description?: string, referenceId?: string) {
    if (amount <= 0) throw new ValidationError('Amount must be positive');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (rows.length === 0) throw new NotFoundError('Wallet not found');
      const balanceBefore = parseFloat(rows[0].balance);
      if (balanceBefore < amount) throw new InsufficientBalanceError();
      const balanceAfter = balanceBefore - amount;

      await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [amount, userId]);
      await conn.execute(
        'INSERT INTO transactions (user_id, amount, type, method, status, description) VALUES (?,?,?,?,?,?)',
        [userId, -amount, 'purchase', 'wallet', 'success', description || 'Purchase']
      );

      await conn.execute(
        'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description) VALUES (?,?,?,?,?,?,?,?)',
        [userId, 'debit', amount, balanceBefore, balanceAfter, 'purchase', referenceId || null, description || 'Purchase']
      );

      await conn.commit();
      logger.info('Wallet spend', { userId, amount });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Refund amount back to wallet */
  async refund(userId: number, amount: number, description?: string, referenceId?: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');
      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter = balanceBefore + amount;

      await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
      await conn.execute(
        'INSERT INTO transactions (user_id, amount, type, method, status, description) VALUES (?,?,?,?,?,?)',
        [userId, amount, 'refund', 'system', 'success', description || 'Refund']
      );

      await conn.execute(
        'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description) VALUES (?,?,?,?,?,?,?,?)',
        [userId, 'credit', amount, balanceBefore, balanceAfter, 'refund', referenceId || null, description || 'Refund']
      );

      await conn.commit();
      logger.info('Wallet refund', { userId, amount });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getTransactions(userId: number, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, String(limit), String(offset)]
    );
    const [countResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?', [userId]
    );
    const total = countResult[0].total;
    return { transactions: rows, pagination: { page, totalPages: Math.ceil(total / limit), total } };
  }

  async getWalletLogs(userId: number, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM wallet_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, String(limit), String(offset)]
    );
    const [countResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM wallet_logs WHERE user_id = ?', [userId]
    );
    const total = countResult[0].total;
    return { logs: rows, pagination: { page, totalPages: Math.ceil(total / limit), total } };
  }
}

export const walletService = new WalletService();
