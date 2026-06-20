import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { userService } from '../services/user.service';
import { lootBoxService } from '../services/loot-box.service';
import { walletService } from '../services/wallet.service';
import { redeemInventorySchema, redeemCodeSchema } from '../validators/schemas';
import { pool } from '../database/connection';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { destroySession } from '../services/session.service';

const router = Router();

router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getProfile(req.user!.userId);
    res.json({ success: true, user: profile });
  } catch (err) { next(err); }
});

router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT a.password FROM users u JOIN authme a ON LOWER(a.username) = LOWER(u.username) WHERE u.id = ?',
      [req.user!.userId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });

    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE authme SET password = ? WHERE LOWER(username) = LOWER(?)', [hashed, req.user!.username]);
    // Invalidate session — user must log in again with the new password
    await destroySession(req.user!.userId);
    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
  } catch (err) { next(err); }
});

// ─── Web Inventory ───────────────────────────────────────────

router.get('/inventory', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await lootBoxService.getUserInventory(req.user!.userId);
    res.json({ success: true, items });
  } catch (err) { next(err); }
});

router.post('/inventory/:id/redeem', authenticate, validate(redeemInventorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rconManager = req.app.get('rconManager');
    const playerTracker = req.app.get('playerTracker');
    const result = await lootBoxService.redeemItem(
      parseInt(req.params.id),
      req.user!.userId,
      req.user!.username,
      req.body.serverId,
      rconManager,
      playerTracker
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/inventory/redeem-all', authenticate, validate(redeemInventorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rconManager = req.app.get('rconManager');
    const playerTracker = req.app.get('playerTracker');
    const result = await lootBoxService.redeemAllItems(
      req.user!.userId,
      req.user!.username,
      req.body.serverId,
      rconManager,
      playerTracker
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ─── Redeem Code ─────────────────────────────────────────────

router.post('/redeem-code', authenticate, validate(redeemCodeSchema), async (req: Request, res: Response, next: NextFunction) => {
  const conn: PoolConnection = await (pool as any).getConnection();
  try {
    const { code, serverId } = req.body;
    const userId = req.user!.userId;
    const username = req.user!.username;

    await conn.beginTransaction();

    // Lock the redeem_codes row so concurrent requests can't both pass the checks
    const [codeRows] = await conn.execute<RowDataPacket[]>(
      'SELECT * FROM redeem_codes WHERE code = ? AND active = 1 FOR UPDATE',
      [code]
    );
    if (codeRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'โค้ดไม่ถูกต้องหรือหมดอายุแล้ว' });
    }
    const redeemCode = codeRows[0];

    // Discount codes are applied at top-up / checkout, not via this endpoint.
    if (['discount_topup', 'discount_purchase', 'discount_any'].includes(redeemCode.reward_type)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'โค้ดส่วนลดต้องใช้ตอนเติมเงินหรือซื้อสินค้า ไม่ใช่หน้านี้' });
    }

    // Check expiry
    if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'โค้ดนี้หมดอายุแล้ว' });
    }

    // Check max uses (re-read inside lock to get accurate used_count)
    if (redeemCode.max_uses > 0 && redeemCode.used_count >= redeemCode.max_uses) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' });
    }

    // Check if user already redeemed (UNIQUE key enforces this at DB level too)
    const [logRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM redeem_logs WHERE code_id = ? AND user_id = ?',
      [redeemCode.id, userId]
    );
    if (logRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'คุณใช้โค้ดนี้ไปแล้ว' });
    }

    // RCON-reward codes: server selection required + player must be online in-game.
    // We gate BEFORE marking the code used so an offline player doesn't burn their one redemption.
    if (redeemCode.reward_type === 'rcon') {
      if (!serverId) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'กรุณาเลือกเซิร์ฟเวอร์' });
      }
      const rconMgr = req.app.get('rconManager');
      // Strict: query RCON directly with no stale-cache fallback. We'd rather block
      // a real online player on transient RCON failure than silently grant a code to
      // someone who actually logged off (cache TTL is 10–30s after a real logout).
      let isOnline = false;
      try {
        isOnline = await rconMgr.checkPlayerOnlineDirect(serverId, username);
      } catch (rconErr) {
        await conn.rollback();
        return res.status(503).json({ success: false, message: 'ไม่สามารถตรวจสอบสถานะผู้เล่นได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' });
      }
      if (!isOnline) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'คุณต้องออนไลน์อยู่ในเซิร์ฟเวอร์ที่เลือกเพื่อใช้โค้ดนี้' });
      }
    }

    // Mark as used inside the transaction
    await conn.execute(
      'INSERT INTO redeem_logs (code_id, user_id) VALUES (?, ?)',
      [redeemCode.id, userId]
    );
    await conn.execute(
      'UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = ?',
      [redeemCode.id]
    );
    await conn.commit();

    // Execute reward after releasing lock (non-financial side effects outside tx)
    if (redeemCode.reward_type === 'point') {
      const amount = parseFloat(redeemCode.point_amount);
      if (!amount || amount <= 0) {
        return res.status(500).json({ success: false, message: 'โค้ดนี้ตั้งค่าไม่ถูกต้อง' });
      }
      await walletService.topup(userId, amount, 'redeem_code', redeemCode.code, `ใช้โค้ด ${redeemCode.code}`, 'redeem_code');
      res.json({ success: true, message: `ใช้โค้ดสำเร็จ! ได้รับ ${amount} บาท เข้ากระเป๋าเงิน` });
    } else {
      const rconManager = req.app.get('rconManager');
      try {
        // Use executeProductCommands so multi-line commands work (one RCON call per line)
        // and so {player}/{username} placeholders get the same case-insensitive sanitised
        // replacement that shop purchases use. It returns delivery counts instead of throwing,
        // so treat an incomplete delivery as a failure to trigger the compensation below.
        const delivery = await rconManager.executeProductCommands(serverId, redeemCode.command, username);
        if (delivery.deliveredUnits < delivery.totalUnits) {
          throw new Error(delivery.error || 'RCON delivery failed');
        }
        res.json({ success: true, message: 'ใช้โค้ดสำเร็จ! ไอเท็มถูกส่งไปยังตัวละครของคุณแล้ว' });
      } catch (rconErr) {
        // RCON failed after we already committed the redeem. Compensate by
        // undoing the redemption so the user can try again instead of losing
        // their one-use claim.
        await pool.execute('DELETE FROM redeem_logs WHERE code_id = ? AND user_id = ?', [redeemCode.id, userId]);
        await pool.execute('UPDATE redeem_codes SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?', [redeemCode.id]);
        throw rconErr;
      }
    }
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
