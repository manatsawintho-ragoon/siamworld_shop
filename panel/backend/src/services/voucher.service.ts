import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import { ValidationError, NotFoundError } from '../utils/errors';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import crypto from 'crypto';

class VoucherService {
  async createVoucher(adminId: number, code: string, amount: number, maxUses: number) {
    if (!code) code = crypto.randomBytes(4).toString('hex').toUpperCase();
    if (amount <= 0) throw new ValidationError('Amount must be positive');
    if (maxUses <= 0) throw new ValidationError('Max uses must be at least 1');

    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO vouchers (code, amount, max_uses, created_by) VALUES (?, ?, ?, ?)',
        [code, amount, maxUses, adminId]
      );
      return { id: result.insertId, code, amount, maxUses };
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') throw new ValidationError('Voucher code already exists');
      throw e;
    }
  }

  async getVouchers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT v.*, u.display_name as creator_name FROM vouchers v LEFT JOIN panel_users u ON v.created_by = u.id ORDER BY v.created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [count] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM vouchers');
    return { data: rows, total: count[0].total, page, limit };
  }

  async getVoucherRedemptions(voucherId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT r.*, u.email, u.display_name FROM voucher_redemptions r JOIN panel_users u ON r.user_id = u.id WHERE r.voucher_id = ? ORDER BY r.redeemed_at DESC LIMIT ? OFFSET ?',
      [voucherId, limit, offset]
    );
    const [count] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM voucher_redemptions WHERE voucher_id = ?', [voucherId]);
    return { data: rows, total: count[0].total, page, limit };
  }

  async deleteVoucher(id: number) {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM vouchers WHERE id = ?', [id]);
    if (result.affectedRows === 0) throw new NotFoundError('Voucher not found');
    return { success: true };
  }

  async redeemVoucher(userId: number, code: string): Promise<number> {
    const conn = await pool.getConnection();
    const upperCode = code.trim().toUpperCase();
    logger.info(`[Voucher] User ${userId} attempting to redeem: "${upperCode}"`);
    try {
      await conn.beginTransaction();

      // Lock voucher row
      const [vRows] = await conn.execute<RowDataPacket[]>(
        'SELECT id, amount, max_uses, current_uses FROM vouchers WHERE code = ? FOR UPDATE',
        [upperCode]
      );
      if (!vRows[0]) {
        logger.info(`[Voucher] Code "${upperCode}" not found in database`);
        await conn.rollback();
        throw new NotFoundError('ไม่พบโค้ดนี้ หรือโค้ดไม่ถูกต้อง');
      }

      const voucher = vRows[0];
      logger.info(`[Voucher] Found: id=${voucher.id}, uses=${voucher.current_uses}/${voucher.max_uses}`);
      if (voucher.current_uses >= voucher.max_uses) {
        await conn.rollback();
        throw new ValidationError('โค้ดนี้ถูกใช้งานครบตามจำนวนที่กำหนดแล้ว');
      }

      // Check if already redeemed by this user
      const [rRows] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM voucher_redemptions WHERE voucher_id = ? AND user_id = ?',
        [voucher.id, userId]
      );
      if (rRows.length > 0) {
        await conn.rollback();
        throw new ValidationError('คุณเคยแลกรับโค้ดนี้ไปแล้ว');
      }

      // Lock user row
      const [uRows] = await conn.execute<RowDataPacket[]>(
        'SELECT wallet_balance FROM panel_users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (!uRows[0]) {
        await conn.rollback();
        throw new NotFoundError('ไม่พบข้อมูลผู้ใช้งาน');
      }

      // Insert redemption
      await conn.execute(
        'INSERT INTO voucher_redemptions (voucher_id, user_id) VALUES (?, ?)',
        [voucher.id, userId]
      );

      // Update current_uses
      await conn.execute(
        'UPDATE vouchers SET current_uses = current_uses + 1 WHERE id = ?',
        [voucher.id]
      );

      // Credit wallet
      const amount = Number(voucher.amount);
      const balanceAfter = Number(uRows[0].wallet_balance) + amount;
      
      await conn.execute('UPDATE panel_users SET wallet_balance = ? WHERE id = ?', [balanceAfter, userId]);
      await conn.execute(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)',
        [userId, 'voucher', amount, balanceAfter, `Redeemed voucher: ${code}`, voucher.id.toString()]
      );

      await conn.commit();
      return amount;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

export const voucherService = new VoucherService();
