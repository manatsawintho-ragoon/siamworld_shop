import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { walletService } from '../services/wallet.service';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await walletService.getWallet(req.user!.userId);
    res.json({ success: true, wallet });
  } catch (err) { next(err); }
});

// NOTE: There is intentionally NO self-service /topup route. Crediting a wallet
// must go through a verified payment path (payment.service: PromptPay slip /
// TrueMoney) or an admin adjustment (admin.routes). A raw authenticated /topup
// let any logged-in user grant themselves unlimited balance — removed.

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
