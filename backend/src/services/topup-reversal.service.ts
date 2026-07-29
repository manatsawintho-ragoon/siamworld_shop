import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { campaignService } from './campaign.service';

/**
 * Reversing a top-up: the single production caller of
 * campaignService.revokeForTransaction.
 *
 * This module exists to close the blocking gate documented in
 * docs/superpowers/specs/2026-07-21-campaign-rewards-news-design.md A5. Before
 * the Reward Shop, points could be earned but not spent, so a top-up reversal
 * that ignored points was harmless. Once points buy real rewards, "top up,
 * take the points, redeem a rank, dispute the payment" is free money unless
 * every reversal also claws the points back. So money and points are reversed
 * through ONE function - never wire a new reversal path that skips this.
 *
 * Ledger shape: rather than mutate the original row's status (which every
 * dashboard query filters on), we mark it `reversed_at` and append a
 * compensating negative `topup` row. Every existing
 * `SUM(amount) WHERE type='topup' AND status='success'` aggregation - toprank,
 * dashboards, month-over-month - then self-corrects with no query changes,
 * and the player still sees the reversal in their history.
 */
class TopupReversalService {
  /**
   * @param transactionId the original successful top-up
   * @param reason        mandatory, written to the ledger and the audit log
   */
  async reverse(transactionId: number, reason: string): Promise<{
    userId: number;
    amount: number;
    walletDebited: number;
    pointsRevoked: number;
    pointsDebt: number;
  }> {
    if (!reason || !reason.trim()) throw new ValidationError('ต้องระบุเหตุผลในการยกเลิกรายการเติมเงิน');

    const conn = await pool.getConnection();
    let userId = 0;
    let amount = 0;
    let walletDebited = 0;

    try {
      await conn.beginTransaction();

      // Lock the transaction row first: it is the idempotency anchor. Two
      // admins double-clicking serialise here, and the second sees reversed_at.
      const [txRows] = await conn.execute<RowDataPacket[]>(
        'SELECT id, user_id, amount, type, status, reversed_at FROM transactions WHERE id = ? FOR UPDATE',
        [transactionId]
      );
      if (txRows.length === 0) throw new NotFoundError('ไม่พบรายการเติมเงินนี้');

      const tx = txRows[0];
      if (tx.type !== 'topup')      throw new ValidationError('ยกเลิกได้เฉพาะรายการเติมเงินเท่านั้น');
      if (tx.status !== 'success')  throw new ValidationError('ยกเลิกได้เฉพาะรายการที่สำเร็จแล้วเท่านั้น');
      if (tx.reversed_at !== null)  throw new ValidationError('รายการนี้ถูกยกเลิกไปแล้ว');

      userId = Number(tx.user_id);
      amount = Number(tx.amount);
      if (amount <= 0) throw new ValidationError('ยอดของรายการนี้ไม่ถูกต้อง');

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('ไม่พบกระเป๋าเงินของผู้ใช้นี้');

      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter = balanceBefore - amount;
      walletDebited = amount;

      // The balance is allowed to go negative on purpose. If the player already
      // spent the money, clamping would quietly forgive the difference; a
      // negative balance is the honest record of what is owed, and
      // walletService.spend already refuses to debit below zero, so the debt
      // simply blocks further purchases until it is repaid. This mirrors the
      // negative-lot debt the points ledger uses for the same situation.
      await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [amount, userId]);

      await conn.execute(
        'UPDATE transactions SET reversed_at = NOW(), reversed_reason = ? WHERE id = ?',
        [reason.trim().slice(0, 500), transactionId]
      );

      // Compensating row: same type so every existing SUM nets to zero.
      await conn.execute<ResultSetHeader>(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?,?,?,?,?,?,?)`,
        [userId, -amount, 'topup', 'reversal', 'success', String(transactionId),
         `ยกเลิกรายการเติมเงิน #${transactionId}: ${reason.trim().slice(0, 400)}`]
      );

      await conn.execute(
        `INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description)
         VALUES (?,?,?,?,?,?,?,?)`,
        [userId, 'debit', amount, balanceBefore, balanceAfter, 'reversal', String(transactionId),
         `ยกเลิกรายการเติมเงิน #${transactionId}`]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Points are clawed back only after the money reversal has committed, and
    // in its own transaction. Same ordering rule as granting (design A1): the
    // money path must never be blocked by the points path. Unlike granting,
    // a failure here MUST surface - silently keeping spendable points alive on
    // a reversed payment is the exact abuse this gate exists to prevent.
    const { revoked, debt } = await campaignService.revokeForTransaction(transactionId);

    logger.info('Top-up reversed', { transactionId, userId, amount, revoked, debt });
    return { userId, amount, walletDebited, pointsRevoked: revoked, pointsDebt: debt };
  }
}

export const topupReversalService = new TopupReversalService();
