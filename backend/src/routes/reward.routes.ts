import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { purchaseCooldown } from '../middleware/cooldown';
import { rewardService } from '../services/reward.service';
import { redeemRewardSchema } from '../validators/schemas';

const router = Router();

/**
 * Reward Shop: where campaign points are spent. Points never convert back to
 * Baht here - a redemption produces a PENDING web_inventory row, nothing else.
 */

/**
 * Catalog. Readable signed-out so the shop is browsable (and indexable), but
 * per-user fields (alreadyRedeemed) only fill in when a token is present.
 *
 * Deliberately NOT on the shared catalog cache tier: the response varies per
 * user and carries live stock, so a shared 60s cache would leak one player's
 * redemption counts to another.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Optional auth: reuse the middleware only when a token was actually sent.
    const hasToken = Boolean(req.headers.authorization);
    if (!hasToken) {
      const rewards = await rewardService.getCatalog(null);
      res.json({ success: true, rewards });
      return;
    }
    authenticate(req, res, async (err?: any) => {
      if (err) return next(err);
      try {
        const rewards = await rewardService.getCatalog(req.user!.userId);
        res.json({ success: true, rewards });
      } catch (e) { next(e); }
    });
  } catch (err) { next(err); }
});

/** This player's own redemption history. */
router.get('/redemptions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const redemptions = await rewardService.getUserRedemptions(req.user!.userId);
    res.json({ success: true, redemptions });
  } catch (err) { next(err); }
});

/**
 * Redeem. Cooldown mirrors the loot-box tier (3s) rather than the purchase
 * tier, since no money moves and the real double-spend defense is the
 * idempotency key plus row locks.
 */
router.post(
  '/:id/redeem',
  authenticate,
  purchaseCooldown(3, 'reward'),
  validate(redeemRewardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rewardId = parseInt(req.params.id);
      if (!Number.isFinite(rewardId)) {
        res.status(400).json({ success: false, message: 'รหัสของรางวัลไม่ถูกต้อง' });
        return;
      }
      const result = await rewardService.redeem(
        req.user!.userId, rewardId, req.body.idempotencyKey ?? null
      );
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  }
);

export default router;
