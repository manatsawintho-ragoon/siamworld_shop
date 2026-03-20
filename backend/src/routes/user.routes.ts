import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { userService } from '../services/user.service';
import { lootBoxService } from '../services/loot-box.service';
import { redeemInventorySchema } from '../validators/schemas';

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

export default router;
