import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paymentService } from '../services/payment.service';
import { topupSchema, trueMoneyRedeemSchema, slipVerifySchema, discountPreviewSchema } from '../validators/schemas';
import { purchaseCooldown } from '../middleware/cooldown';
import { discountService, DiscountError } from '../services/discount.service';

const router = Router();

router.post('/promptpay/create', authenticate, validate(topupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.createPromptPay(req.user!.userId, req.body.amount);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/promptpay/confirm', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await paymentService.confirmPromptPay(req.user!.userId, req.body.reference);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/truemoney/redeem', authenticate, validate(trueMoneyRedeemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await paymentService.redeemTrueMoney(req.user!.userId, req.body.giftLink);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── EasySlip slip verification ────────────────────────────────────────────────
// Accepts: { base64: "data:image/jpeg;base64,..." }
//       or { url: "https://..." }
//       or { payload: "QR payload string" }
// On success: credits wallet with the amount in the slip
// Rate limited: 30s cooldown per user after a successful verify to avoid EasySlip quota abuse
router.post('/slip/verify', authenticate, purchaseCooldown(30, 'slip'), validate(slipVerifySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { base64, url, payload, expectedAmount, discountCode } = req.body;
    const result = await paymentService.verifySlip(
      req.user!.userId,
      { base64, url, payload },
      expectedAmount,
      discountCode
    );
    res.json({
      success: true,
      message: `เติมเงินสำเร็จ ฿${result.amount} จาก ${result.senderBank ?? 'ธนาคาร'}`,
      ...result,
    });
  } catch (err) { next(err); }
});

// Pre-check a discount code without consuming it. Used by the topup / checkout
// UI to show how much the code will save before the user commits.
router.post('/discount/preview', authenticate, validate(discountPreviewSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, context, amount } = req.body as { code: string; context: 'topup' | 'purchase'; amount: number };
    const { codeRow, discountAmount, effectiveAmount } = await discountService.preview(code, context, amount, req.user!.userId);
    res.json({
      success: true,
      code: codeRow.code,
      reward_type: codeRow.reward_type,
      discountAmount,
      effectiveAmount,
    });
  } catch (err) {
    if (err instanceof DiscountError) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
});

export default router;
