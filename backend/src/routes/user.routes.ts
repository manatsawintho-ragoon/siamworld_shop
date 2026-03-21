import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { userService } from '../services/user.service';
import { lootBoxService } from '../services/loot-box.service';
import { walletService } from '../services/wallet.service';
import { redeemInventorySchema, redeemCodeSchema } from '../validators/schemas';
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';

const router = Router();

router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getProfile(req.user!.userId);
    res.json({ success: true, user: profile });
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
  try {
    const { code, serverId } = req.body;
    const userId = req.user!.userId;
    const username = req.user!.username;

    // Find the code
    const [codeRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM redeem_codes WHERE code = ? AND active = 1',
      [code]
    );
    if (codeRows.length === 0) {
      return res.status(404).json({ success: false, message: 'โค้ดไม่ถูกต้องหรือหมดอายุแล้ว' });
    }
    const redeemCode = codeRows[0];

    // Check expiry
    if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'โค้ดนี้หมดอายุแล้ว' });
    }

    // Check max uses
    if (redeemCode.max_uses > 0 && redeemCode.used_count >= redeemCode.max_uses) {
      return res.status(400).json({ success: false, message: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' });
    }

    // Check if user already redeemed
    const [logRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM redeem_logs WHERE code_id = ? AND user_id = ?',
      [redeemCode.id, userId]
    );
    if (logRows.length > 0) {
      return res.status(400).json({ success: false, message: 'คุณใช้โค้ดนี้ไปแล้ว' });
    }

    // Execute reward based on type
    if (redeemCode.reward_type === 'point') {
      // Add points to wallet
      const amount = parseFloat(redeemCode.point_amount);
      if (!amount || amount <= 0) {
        return res.status(500).json({ success: false, message: 'โค้ดนี้ตั้งค่าไม่ถูกต้อง' });
      }
      await walletService.topup(userId, amount, 'redeem_code', redeemCode.code, `ใช้โค้ด ${redeemCode.code}`, 'redeem_code');

      // Log the redemption
      await pool.execute(
        'INSERT INTO redeem_logs (code_id, user_id) VALUES (?, ?)',
        [redeemCode.id, userId]
      );
      await pool.execute(
        'UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = ?',
        [redeemCode.id]
      );

      res.json({ success: true, message: `ใช้โค้ดสำเร็จ! ได้รับ ${amount} บาท เข้ากระเป๋าเงิน` });
    } else {
      // RCON command
      if (!serverId) {
        return res.status(400).json({ success: false, message: 'กรุณาเลือกเซิร์ฟเวอร์' });
      }
      const rconManager = req.app.get('rconManager');
      const playerTracker = req.app.get('playerTracker');
      const command = redeemCode.command.replace(/{player}/g, username);

      // Check player online
      const isOnline = await playerTracker.isPlayerOnline(serverId, username);
      if (!isOnline) {
        return res.status(400).json({ success: false, message: 'คุณต้องออนไลน์อยู่ในเซิร์ฟเวอร์ที่เลือกเพื่อรับไอเทม' });
      }

      const response = await rconManager.sendCommand(serverId, command);

      // Log the redemption
      await pool.execute(
        'INSERT INTO redeem_logs (code_id, user_id) VALUES (?, ?)',
        [redeemCode.id, userId]
      );
      await pool.execute(
        'UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = ?',
        [redeemCode.id]
      );

      res.json({ success: true, message: 'ใช้โค้ดสำเร็จ! ไอเทมถูกส่งไปยังตัวละครของคุณแล้ว', rcon_response: response });
    }
  } catch (err) { next(err); }
});

export default router;
