import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { walletService } from '../services/wallet.service';
import { paymentService } from '../services/payment.service';
import { ValidationError } from '../utils/errors';

const router = Router();

router.get('/balance', requireAuth, asyncRoute(async (req, res) => {
  const balance = await walletService.getBalance(req.user!.userId);
  res.json({ balance });
}));

router.get('/transactions', requireAuth, asyncRoute(async (req, res) => {
  const page = parseInt(String(req.query.page)) || 1;
  const result = await walletService.getTransactions(req.user!.userId, page);
  res.json(result);
}));

router.post('/topup/qr', requireAuth, asyncRoute(async (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount)) throw new ValidationError('ยอดไม่ถูกต้อง');
  const result = await paymentService.createTopupQR(req.user!.userId, amount);
  res.json(result);
}));

router.post('/topup/slip', requireAuth, asyncRoute(async (req, res) => {
  const { amount, slipBase64 } = req.body;
  if (!amount || !slipBase64) throw new ValidationError('กรุณาระบุยอดและแนบสลิป');
  const result = await paymentService.verifyTopupSlip(req.user!.userId, parseFloat(amount), slipBase64);
  res.json(result);
}));

router.get('/slips', requireAuth, asyncRoute(async (req, res) => {
  const slips = await paymentService.getSlipHistory(req.user!.userId);
  res.json({ slips });
}));

export default router;
