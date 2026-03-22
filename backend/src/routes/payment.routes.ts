import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paymentService } from '../services/payment.service';
import { topupSchema, trueMoneyRedeemSchema, slipVerifySchema } from '../validators/schemas';

const router = Router();

router.post('/promptpay/create', authenticate, validate(topupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.createPromptPay(req.user!.userId, req.body.amount);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/promptpay/confirm', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reference } = req.body;
    const result = await paymentService.confirmPromptPay(req.user!.userId, reference);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/truemoney/redeem', authenticate, validate(trueMoneyRedeemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.redeemTrueMoney(req.user!.userId, req.body.giftLink);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ── EasySlip slip verification ────────────────────────────────────────────────
// Accepts: { base64: "data:image/jpeg;base64,..." }
//       or { url: "https://..." }
//       or { payload: "QR payload string" }
// On success: credits wallet with the amount in the slip
router.post('/slip/verify', authenticate, validate(slipVerifySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { base64, url, payload } = req.body;
    const result = await paymentService.verifySlip(req.user!.userId, { base64, url, payload });
    res.json({
      success: true,
      message: `เติมเงินสำเร็จ ฿${result.amount} จาก ${result.senderBank ?? 'ธนาคาร'}`,
      ...result,
    });
  } catch (err) { next(err); }
});

export default router;
