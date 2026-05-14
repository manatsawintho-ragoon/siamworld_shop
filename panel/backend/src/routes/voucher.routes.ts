import { Router } from 'express';
import { voucherService } from '../services/voucher.service';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { asyncRoute } from '../middleware/asyncRoute';

const router = Router();

// User routes
router.post('/redeem', requireAuth, asyncRoute(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Voucher code is required' });
  }
  const amount = await voucherService.redeemVoucher(req.user!.userId, code);
  res.json({ success: true, amount, message: 'Voucher redeemed successfully' });
}));

// Admin routes
router.post('/', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const { code, amount, maxUses } = req.body;
  const voucher = await voucherService.createVoucher(req.user!.userId, code, Number(amount), Number(maxUses));
  res.json({ success: true, voucher });
}));

router.get('/', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await voucherService.getVouchers(page, limit);
  res.json({ success: true, ...result });
}));

router.get('/:id/redemptions', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await voucherService.getVoucherRedemptions(id, page, limit);
  res.json({ success: true, ...result });
}));

router.delete('/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id);
  await voucherService.deleteVoucher(id);
  res.json({ success: true, message: 'Voucher deleted' });
}));

export default router;
