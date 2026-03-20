import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { walletService } from '../services/wallet.service';
import { topupSchema } from '../validators/schemas';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await walletService.getWallet(req.user!.userId);
    res.json({ success: true, wallet });
  } catch (err) { next(err); }
});

router.post('/topup', authenticate, validate(topupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await walletService.topup(req.user!.userId, req.body.amount, 'manual', undefined, req.body.description);
    res.json({ success: true, message: 'Top-up successful', wallet });
  } catch (err) { next(err); }
});

router.get('/transactions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await walletService.getTransactions(req.user!.userId, page, limit);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/logs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await walletService.getWalletLogs(req.user!.userId, page, limit);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

export default router;
