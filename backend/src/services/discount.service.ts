import { pool } from '../database/connection';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';

export type DiscountContext = 'topup' | 'purchase';

export interface DiscountCode {
  id: number;
  code: string;
  reward_type: 'rcon' | 'point' | 'discount_topup' | 'discount_purchase' | 'discount_any';
  discount_percent: string | null;
  discount_amount: string | null;
  min_topup_amount: string | null;
  max_uses: number;
  used_count: number;
  active: 0 | 1;
  expires_at: Date | null;
}

export class DiscountError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
  }
}

/**
 * Compute and apply discount codes for top-up bonus credit and purchase price
 * reductions.
 *
 * Two key invariants enforced here:
 *
 *   1. **A code can only be applied to one consumption flow per user.** The
 *      same redeem_logs unique key as RCON/point codes — UNIQUE(code_id,user_id)
 *      — gates that. We insert the log row inside the caller's transaction so
 *      a payment failure can roll it back.
 *
 *   2. **Discount math never goes negative.** percent capped 0..100, fixed
 *      amount capped at the target amount.
 */
class DiscountService {
  /** Look up + validate a code for the given context. Throws DiscountError on rejection. */
  async preview(code: string, context: DiscountContext, baseAmount: number, userId: number): Promise<{
    codeRow: DiscountCode;
    discountAmount: number;     // Baht the user saves (for purchase) or gains (for topup bonus).
    effectiveAmount: number;    // What user actually pays (purchase) / receives (topup).
  }> {
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw new DiscountError('กรุณากรอกโค้ดส่วนลด');
    }
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      throw new DiscountError('ยอดเงินไม่ถูกต้อง');
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM redeem_codes WHERE code = ? AND active = 1 LIMIT 1',
      [code.trim()]
    );
    if (rows.length === 0) throw new DiscountError('โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ', 404);
    const c = rows[0] as unknown as DiscountCode;

    if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) {
      throw new DiscountError('โค้ดส่วนลดนี้หมดอายุแล้ว');
    }
    if (c.max_uses > 0 && c.used_count >= c.max_uses) {
      throw new DiscountError('โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว');
    }
    // Context check
    const okContext =
      (context === 'topup' && (c.reward_type === 'discount_topup' || c.reward_type === 'discount_any')) ||
      (context === 'purchase' && (c.reward_type === 'discount_purchase' || c.reward_type === 'discount_any'));
    if (!okContext) {
      throw new DiscountError(context === 'topup'
        ? 'โค้ดนี้ใช้กับการเติมเงินไม่ได้'
        : 'โค้ดนี้ใช้กับการซื้อสินค้าไม่ได้');
    }
    // Per-user one-use (matches RCON/point code behavior; UNIQUE key enforces at DB level too)
    const [used] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM redeem_logs WHERE code_id = ? AND user_id = ?', [c.id, userId]
    );
    if (used.length > 0) throw new DiscountError('คุณใช้โค้ดนี้ไปแล้ว');

    // Min-spend gate
    const minTopup = c.min_topup_amount ? parseFloat(c.min_topup_amount) : 0;
    if (minTopup > 0 && baseAmount < minTopup) {
      throw new DiscountError(`ต้องมียอดอย่างน้อย ${minTopup.toFixed(2)} บาทเพื่อใช้โค้ดนี้`);
    }

    // Compute discount value
    const percent = c.discount_percent ? parseFloat(c.discount_percent) : 0;
    const amount = c.discount_amount ? parseFloat(c.discount_amount) : 0;
    let discount = 0;
    if (percent > 0) discount = baseAmount * Math.min(percent, 100) / 100;
    else if (amount > 0) discount = amount;
    discount = Math.min(discount, baseAmount);   // never exceed base
    discount = Math.round(discount * 100) / 100; // round to 2 dp
    if (discount <= 0) throw new DiscountError('โค้ดส่วนลดไม่ถูกต้อง');

    const effectiveAmount = context === 'topup'
      ? Math.round((baseAmount + discount) * 100) / 100   // bonus credit added
      : Math.max(0, Math.round((baseAmount - discount) * 100) / 100); // price reduced

    return { codeRow: c, discountAmount: discount, effectiveAmount };
  }

  /**
   * Mark a discount code as consumed for a user. Must be invoked from inside
   * the caller's DB transaction so rollback cleans up if the consumption flow
   * later fails (eg. RCON delivery fails for a purchase).
   */
  async consume(conn: PoolConnection, codeId: number, userId: number): Promise<void> {
    // Re-check inside the lock to prevent TOCTOU.
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT id, max_uses, used_count FROM redeem_codes WHERE id = ? AND active = 1 FOR UPDATE',
      [codeId]
    );
    if (rows.length === 0) throw new DiscountError('โค้ดส่วนลดไม่ถูกต้อง');
    const c = rows[0] as { max_uses: number; used_count: number };
    if (c.max_uses > 0 && c.used_count >= c.max_uses) {
      throw new DiscountError('โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว');
    }
    // Insert log; UNIQUE(code_id,user_id) protects against double-claim
    try {
      await conn.execute('INSERT INTO redeem_logs (code_id, user_id) VALUES (?, ?)', [codeId, userId]);
    } catch (err: any) {
      if (err && err.code === 'ER_DUP_ENTRY') throw new DiscountError('คุณใช้โค้ดนี้ไปแล้ว');
      throw err;
    }
    await conn.execute('UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = ?', [codeId]);
  }
}

export const discountService = new DiscountService();
