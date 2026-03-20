import { pool } from '../database/connection';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { walletService } from './wallet.service';
import { logger } from '../utils/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

class PaymentService {
  async createPromptPay(userId: number, amount: number) {
    if (amount <= 0 || amount > 100000) throw new ValidationError('Invalid amount');
    const reference = `PP${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await pool.execute(
      'INSERT INTO transactions (user_id, amount, type, method, status, reference, description) VALUES (?,?,?,?,?,?,?)',
      [userId, amount, 'topup', 'promptpay', 'pending', reference, `PromptPay ฿${amount}`]
    );
    return { reference, amount, qrData: `promptpay://pay?amount=${amount}&ref=${reference}` };
  }

  async confirmPromptPay(userId: number, reference: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM transactions WHERE user_id = ? AND reference = ? AND status = ?',
        [userId, reference, 'pending']
      );
      if (rows.length === 0) throw new NotFoundError('Transaction not found or already confirmed');

      const tx = rows[0];
      const amount = parseFloat(tx.amount);

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');
      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter = balanceBefore + amount;

      // Mark existing transaction as success (no new duplicate transaction)
      await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', ['success', tx.id]);
      // Update wallet balance directly
      await conn.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, userId]);
      // Audit log
      await conn.execute(
        'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description) VALUES (?,?,?,?,?,?,?,?)',
        [userId, 'credit', amount, balanceBefore, balanceAfter, 'promptpay', reference, `PromptPay ฿${amount}`]
      );

      await conn.commit();
      const wallet = await walletService.getWallet(userId);
      logger.info('PromptPay confirmed', { userId, amount, reference });
      return { message: 'Payment confirmed', wallet };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async redeemTrueMoney(userId: number, giftLink: string) {
    if (!giftLink.includes('truemoney.com/campaign')) throw new ValidationError('Invalid TrueMoney gift link');

    const [used] = await pool.execute<RowDataPacket[]>('SELECT id FROM truemoney_used WHERE gift_link = ?', [giftLink]);
    if (used.length > 0) throw new ConflictError('This gift code has already been redeemed');

    // Simulate: generate random amount 10-500
    const amount = Math.floor(Math.random() * 491) + 10;

    await pool.execute('INSERT INTO truemoney_used (gift_link, user_id, amount) VALUES (?,?,?)', [giftLink, userId, amount]);
    const wallet = await walletService.topup(userId, amount, 'truemoney', giftLink, `TrueMoney ฿${amount}`);
    logger.info('TrueMoney redeemed', { userId, amount });
    return { message: `Redeemed ฿${amount}`, amount, wallet };
  }
}

export const paymentService = new PaymentService();
