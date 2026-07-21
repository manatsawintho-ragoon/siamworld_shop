import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { campaignService } from '../services/campaign.service';

const router = Router();

/** Public: the campaign granting points right now, for the banner. Never expose
 * operator-internal fields (budget/per-user caps, paused/active, expiry days). */
router.get('/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await campaignService.getActiveCampaign();
    if (!c) return res.json({ success: true, campaign: null });
    res.json({
      success: true,
      campaign: {
        id: c.id,
        pointsPerBaht: c.points_per_baht,
        minTopupAmount: c.min_topup_amount,
        endsAt: c.ends_at,
      },
    });
  } catch (err) { next(err); }
});

/** Authenticated: this player's own point balance and unexpired lots. */
router.get('/points', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [balance, lots] = await Promise.all([
      campaignService.getBalance(req.user!.userId),
      campaignService.getLots(req.user!.userId),
    ]);
    res.json({ success: true, balance, lots });
  } catch (err) { next(err); }
});

export default router;
