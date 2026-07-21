import { pool } from '../database/connection';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { easySlipService, EasySlipApiError } from './easyslip.service';
import { settingsService } from './settings.service';
import { matchReceiver } from './receiver-match';
import { notificationService } from './notification.service';
import { discountService } from './discount.service';
import { truemoneyService, extractVoucherHash, TrueMoneyApiError } from './truemoney.service';
import { campaignService } from './campaign.service';

// ── PromptPay EMVCo QR payload generator ─────────────────────────────────────

function ppTag(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

function ppCrc16(str: string): string {
  let crc = 0xFFFF;
  for (const ch of str) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Generate PromptPay QR WITH a fixed amount embedded.
// Thai banking apps (K PLUS, SCB EASY, etc.) auto-fill and LOCK the amount field —
// the user cannot change it before confirming payment.
//
// EMVCo PromptPay uses a DIFFERENT merchant-account sub-tag per proxy type:
//   01 = mobile number  (formatted 0066 + last 9 digits)
//   02 = national ID / Tax ID (13 digits, as-is)
// Encoding a 13-digit Tax ID under tag 01 produces a QR that banking apps read as
// an (invalid) phone number → "ข้อมูลไม่ถูกต้อง / โอนไม่ได้". Pick the tag by the
// configured type, falling back to length detection (10 = phone, 13 = Tax ID).
export function generatePromptPayPayload(
  promptpayId: string,
  amount: number,
  type?: 'mobile' | 'taxid',
): string {
  const normalized = promptpayId.replace(/[-\s]/g, '');
  const isTaxId = type === 'taxid' || (type === undefined && normalized.length === 13);
  const proxyTag = isTaxId ? '02' : '01';
  const target = isTaxId
    ? normalized                                           // Tax ID: 13 digits as-is
    : (normalized.length === 10 ? '0066' + normalized.slice(1) : normalized); // phone
  const merchantInfo = ppTag('00', 'A000000677010111') + ppTag(proxyTag, target);
  const body = [
    ppTag('00', '01'),
    ppTag('01', '12'),           // multiple-use QR
    ppTag('29', merchantInfo),
    ppTag('52', '0000'),
    ppTag('53', '764'),          // THB
    ppTag('54', amount.toFixed(2)),
    ppTag('58', 'TH'),
    '6304',
  ].join('');
  return body + ppCrc16(body);
}

// Shared top-up bonus math. Bonus only inflates the credited (spendable) amount;
// the ledger records real money elsewhere.
export function computeTopupCredit(
  amount: number,
  multiplierSetting: string,
  enabled: boolean,
): { creditAmount: number; multiplier: number } {
  const raw = parseFloat(multiplierSetting || '1');
  const multiplier = (enabled && raw > 1) ? raw : 1;
  const creditAmount = parseFloat((amount * multiplier).toFixed(2));
  return { creditAmount, multiplier };
}

// Per-method top-up bonus resolver. Each payment channel (promptpay / truemoney)
// has its own enable flag + multiplier. Falls back to the legacy shared keys
// (topup_bonus_enabled / topup_bonus_multiplier) so shops that haven't re-saved
// their settings keep their existing promotion until they configure per-method.
export function resolveTopupBonus(
  settings: Record<string, string>,
  method: 'promptpay' | 'truemoney',
): { enabled: boolean; multiplier: string } {
  const enabledKey = `topup_bonus_${method}_enabled`;
  const multKey    = `topup_bonus_${method}_multiplier`;
  const enabled = (settings[enabledKey] ?? settings['topup_bonus_enabled']) === 'true';
  const multiplier = settings[multKey] ?? settings['topup_bonus_multiplier'] ?? '1';
  return { enabled, multiplier };
}

class PaymentService {
  async createPromptPay(userId: number, amount: number) {
    if (amount < 10 || amount > 100000) throw new ValidationError('ยอดขั้นต่ำ 10 บาท');

    const settings = await settingsService.getAll();
    if (settings['promptpay_enabled'] === 'false') {
      throw new ValidationError('ระบบ PromptPay ปิดรับชำระเงินอยู่ กรุณาแจ้งผู้ดูแลระบบ');
    }
    const promptpayId   = settings['promptpay_id']        || '';
    const promptpayName = [settings['promptpay_firstname'], settings['promptpay_lastname']]
      .filter(Boolean).join(' ') || settings['promptpay_name'] || '';

    if (!promptpayId) throw new ValidationError('ยังไม่ได้ตั้งค่า PromptPay ID กรุณาแจ้งผู้ดูแลระบบ');

    const ppType    = (settings['promptpay_type'] as 'mobile' | 'taxid') || undefined;
    const reference = `PP${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payload   = generatePromptPayPayload(promptpayId, amount, ppType);

    await pool.execute(
      'INSERT INTO transactions (user_id, amount, type, method, status, reference, description) VALUES (?,?,?,?,?,?,?)',
      [userId, amount, 'topup', 'promptpay', 'pending', reference, `PromptPay ฿${amount}`]
    );

    // Mask: 08x-xxx-5678
    const masked = promptpayId.length >= 4
      ? promptpayId.slice(0, 2) + 'x-xxx-' + promptpayId.slice(-4)
      : promptpayId;

    return { reference, amount, payload, recipientName: promptpayName, recipientId: masked };
  }

  async confirmPromptPay(_userId: number, _reference: string) {
    // SECURITY: Manual confirm is disabled — use slip verification (/payment/slip/verify) instead.
    // This endpoint previously credited wallets without verifying any slip, creating a free-money vulnerability.
    throw new ValidationError('ฟังก์ชันนี้ถูกปิดใช้งานแล้ว กรุณาอัปโหลดสลิปการโอนเงินแทน');
  }

  async redeemTrueMoney(userId: number, giftLink: string) {
    // ── L0: Config ───────────────────────────────────────────────────────────
    const settings = await settingsService.getAll();
    if (settings['truemoney_enabled'] !== 'true') {
      throw new ValidationError('ระบบ TrueMoney Wallet ยังไม่เปิดใช้งาน กรุณาแจ้งผู้ดูแลระบบ');
    }
    const shopPhone = (settings['truemoney_phone'] || '').replace(/\D/g, '');
    if (!/^0[689]\d{8}$/.test(shopPhone)) {
      throw new ValidationError('ยังไม่ได้ตั้งค่าเบอร์ TrueMoney Wallet ของร้าน กรุณาแจ้งผู้ดูแลระบบ');
    }

    // ── L1: Parse voucher hash ───────────────────────────────────────────────
    let voucherHash: string;
    try {
      voucherHash = extractVoucherHash(giftLink);
    } catch {
      throw new ValidationError('ลิงก์ซองของขวัญไม่ถูกต้อง');
    }

    // ── L1b: Pre-dedup (cheap reject before the external call) ────────────────
    const [pre] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM truemoney_logs WHERE voucher_hash = ?', [voucherHash]
    );
    if (pre.length > 0) {
      throw new ConflictError('ซองของขวัญนี้ถูกใช้ไปแล้ว');
    }

    // ── L2: Redeem into the shop wallet (TrueMoney is the source of truth) ────
    let amount: number;
    let ownerName: string | null;
    try {
      const r = await truemoneyService.redeem(shopPhone, voucherHash);
      amount = r.amount;
      ownerName = r.ownerName;
    } catch (err) {
      if (err instanceof TrueMoneyApiError) throw new ValidationError(err.message);
      throw err;
    }

    // ── L3: Sanity ───────────────────────────────────────────────────────────
    if (!(amount > 0)) throw new ValidationError('ยอดเงินในซองของขวัญไม่ถูกต้อง');

    // ── L4: Bonus + atomic credit ────────────────────────────────────────────
    const tmnBonus = resolveTopupBonus(settings, 'truemoney');
    const { creditAmount, multiplier } = computeTopupCredit(
      amount, tmnBonus.multiplier || '1', tmnBonus.enabled,
    );
    const desc = multiplier > 1
      ? `ซองของขวัญ TrueMoney ฿${amount} (โบนัส x${multiplier} = ฿${creditAmount})`
      : `ซองของขวัญ TrueMoney ฿${amount}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // UNIQUE(voucher_hash) is the authoritative retry/race guard.
      try {
        await conn.execute(
          'INSERT INTO truemoney_logs (user_id, voucher_hash, amount, owner_name) VALUES (?, ?, ?, ?)',
          [userId, voucherHash, amount, ownerName]
        );
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY') {
          await conn.rollback();
          throw new ConflictError('ซองของขวัญนี้ถูกใช้ไปแล้ว');
        }
        throw e;
      }

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');

      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter  = balanceBefore + creditAmount;

      await conn.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, userId]);
      await conn.execute(
        `INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description)
         VALUES (?, 'credit', ?, ?, ?, 'truemoney', ?, ?)`,
        [userId, creditAmount, balanceBefore, balanceAfter, voucherHash, desc]
      );
      // Ledger records REAL money (`amount`), not the bonus-inflated creditAmount.
      const [txResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'truemoney', 'success', ?, ?)`,
        [userId, amount, voucherHash, desc]
      );
      const transactionId = txResult.insertId;

      await conn.commit();

      // Campaign points are granted AFTER the money has committed and can never
      // roll it back. TrueMoney has no bank timestamp, so the redemption instant
      // IS the payment instant.
      try {
        await campaignService.grantForTopup({
          userId,
          transactionId,
          amountBaht: amount,
          qualifiedAt: new Date(),
        });
      } catch (err) {
        logger.error('Campaign grant failed after truemoney topup', {
          userId, transactionId, error: (err as Error)?.message,
        });
      }

      logger.info('TrueMoney redeemed', { userId, paidAmount: amount, creditAmount, multiplier, voucherHash });

      const [uRows] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      const username = uRows[0]?.username ?? `User#${userId}`;
      notificationService.create('topup_success',
        `เติมเงินสำเร็จ (TrueMoney): ${username}`,
        JSON.stringify({
          username, userId,
          status: 'สำเร็จ',
          method: 'TrueMoney Wallet',
          amount_paid: `฿${amount}`,
          credit: multiplier > 1 ? `฿${creditAmount} (โบนัส x${multiplier})` : `฿${creditAmount}`,
          sender_name: ownerName ?? '-',
          voucher_hash: voucherHash,
          balance_after: `฿${balanceAfter.toLocaleString()}`,
        })
      );

      return { amount: creditAmount, paid_amount: amount, multiplier, voucherHash, balanceAfter, ownerName };
    } catch (err) {
      await conn.rollback();
      // Reconciliation safety: the money is already in the shop wallet, but the
      // DB credit failed. Alert loudly so an admin can credit manually.
      if (!(err instanceof ConflictError)) {
        const [uRows] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
        const username = uRows[0]?.username ?? `User#${userId}`;
        notificationService.create('topup_failed',
          `TrueMoney credit ค้าง: ${username}`,
          JSON.stringify({
            username, userId,
            status: 'ต้องตรวจสอบ',
            reason: 'แลกซองสำเร็จแต่ลงบัญชีไม่สำเร็จ',
            detail: 'เงินเข้ากระเป๋าร้านแล้ว แต่ยังไม่ได้เติมให้ผู้เล่น กรุณาเติมมือ',
            voucher_hash: voucherHash,
            amount: `฿${amount}`,
          })
        );
      }
      throw err;
    } finally {
      conn.release();
    }
  }

  // ── EasySlip slip verification ────────────────────────────────────────────

  async verifySlip(
    userId: number,
    input: { base64?: string; url?: string; payload?: string },
    expectedAmount?: number,
    discountCode?: string,
  ) {
    // ── Layer 1: Call EasySlip API (checkDuplicate + matchAccount enabled by default) ──
    let slipData;
    try {
      if (input.payload) {
        slipData = await easySlipService.verifyByPayload(input.payload);
      } else if (input.base64) {
        slipData = await easySlipService.verifyByBase64(input.base64);
      } else if (input.url) {
        slipData = await easySlipService.verifyByUrl(input.url);
      } else {
        throw new ValidationError('Provide one of: base64, url, or payload');
      }
    } catch (err) {
      if (err instanceof EasySlipApiError) {
        const msgs: Record<string, string> = {
          SLIP_NOT_FOUND:        'ไม่พบสลิปนี้หรือ QR Code ไม่ถูกต้อง',
          SLIP_PENDING:          'สลิปกำลังดำเนินการ กรุณารอ 5 นาทีแล้วลองใหม่',
          IMAGE_SIZE_TOO_LARGE:  'ไฟล์รูปใหญ่เกิน 4 MB',
          INVALID_IMAGE_FORMAT:  'รูปภาพไม่ถูกต้อง รองรับ JPEG, PNG, GIF, WebP',
          QUOTA_EXCEEDED:        'ระบบตรวจสอบสลิปถึงขีดจำกัด กรุณาแจ้งผู้ดูแลระบบ',
          VALIDATION_ERROR:      'ข้อมูลสลิปไม่ถูกต้อง',
          INVALID_IMAGE:         'ไม่สามารถอ่านข้อมูลจากรูปสลิปได้',
          URL_PROTOCOL_NOT_ALLOWED: 'URL ไม่ถูกต้อง',
          IMAGE_URL_UNREACHABLE: 'ไม่สามารถเข้าถึงรูปภาพจาก URL ที่ให้มาได้',
          CONNECTION_ERROR:      'ระบบตรวจสลิปไม่สามารถเชื่อมต่อได้ชั่วคราว กรุณาลองใหม่อีกครั้ง',
        };
        throw new ValidationError(msgs[err.code] ?? `ตรวจสอบสลิปไม่สำเร็จ: ${err.message}`);
      }
      throw err;
    }

    const raw = slipData.rawSlip;

    // ── Layer 2: EasySlip duplicate flag ─────────────────────────────────────
    // EasySlip tracks slips it has seen — if true this slip was already submitted
    // to EasySlip by any application.
    if (slipData.isDuplicate) {
      logger.warn('EasySlip duplicate detected', { transRef: raw.transRef, userId });
      const [uRows2] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      const username2 = uRows2[0]?.username ?? `User#${userId}`;
      notificationService.create('topup_failed',
        `สลิปซ้ำ: ${username2}`,
        JSON.stringify({
          username: username2, userId,
          status: 'ปฏิเสธ',
          reason: 'สลิปซ้ำ (EasySlip)',
          detail: 'isDuplicate = true: สลิปนี้เคยถูกส่งตรวจกับ EasySlip มาก่อนแล้ว',
          trans_ref: raw.transRef ?? '-',
        })
      );
      throw new ConflictError('สลิปนี้เคยถูกใช้งานแล้ว (ตรวจพบโดย EasySlip)');
    }

    // ── Layer 3: Basic field validation ──────────────────────────────────────
    const transRef = raw.transRef;
    if (!transRef) throw new ValidationError('สลิปนี้ไม่มีรหัสอ้างอิง');

    const amount = raw.amount?.amount;
    if (!amount || amount <= 0) throw new ValidationError('จำนวนเงินในสลิปไม่ถูกต้อง');

    // ── Layer 3b: Amount lock validation ─────────────────────────────────────
    // Since the QR embeds a fixed amount that banking apps lock, the slip amount
    // must match the QR amount. Tolerance ±0.50฿ for rounding edge cases.
    if (expectedAmount !== undefined && expectedAmount > 0) {
      if (Math.abs(amount - expectedAmount) > 0.5) {
        logger.warn('Slip amount mismatch', { userId, transRef, slipAmount: amount, expectedAmount });
        throw new ValidationError(
          `ยอดในสลิป (฿${amount}) ไม่ตรงกับยอด QR (฿${expectedAmount})`
        );
      }
    }

    // ── Layer 4: Slip age check ───────────────────────────────────────────────
    // Different banks support 30–180 days; reject slips older than 90 days
    // to stay safely within all banks' verification windows.
    if (raw.date) {
      const slipMs = new Date(raw.date).getTime();
      if (isNaN(slipMs)) {
        logger.warn('Slip has invalid date', { transRef, date: raw.date, userId });
        throw new ValidationError('วันที่ในสลิปไม่ถูกต้อง');
      }
      const ageDays = (Date.now() - slipMs) / 86_400_000;
      if (ageDays > 90) {
        logger.warn('Slip too old', { transRef, ageDays: ageDays.toFixed(1), userId });
        throw new ValidationError('สลิปนี้หมดอายุแล้ว (เกิน 90 วัน)');
      }
    }

    // ── Layer 5: Receiver account validation ─────────────────────────────────
    // Verify the slip was paid to THIS shop's PromptPay account.
    // Each shop configures their own promptpay_id in Admin → Payment Settings.
    // This is the primary receiver check for SaaS — no EasySlip portal registration needed.
    const allSettings = await settingsService.getAll();
    if (allSettings['promptpay_enabled'] === 'false') {
      throw new ValidationError('ระบบ PromptPay ปิดรับชำระเงินอยู่ กรุณาแจ้งผู้ดูแลระบบ');
    }
    const configuredId = (allSettings['promptpay_id'] || '').replace(/[-\s]/g, '');
    if (!configuredId) {
      throw new ValidationError('ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาแจ้งผู้ดูแลระบบ');
    }
    // Delegate receiver matching to the shared helper (see receiver-match.ts):
    //  - phone PromptPay  → proxy/bank number matches promptpay_id
    //  - บัตรปชช. PromptPay → EasySlip returns the linked bank account, not the
    //    citizen id, so require BOTH promptpay_bankacct AND the receiver name.
    const match = matchReceiver(raw.receiver as any, allSettings);
    if (!match.receiverAccount && !match.receiverName) {
      logger.warn('Slip receiver account missing in EasySlip response', { transRef, userId, receiver: raw.receiver });
      throw new ValidationError('สลิปนี้ไม่มีข้อมูลบัญชีผู้รับ ไม่สามารถยืนยันได้');
    }
    if (!match.matched) {
      logger.warn('Slip receiver mismatch', {
        transRef, userId,
        receiverAccount: match.receiverAccount, receiverName: match.receiverName,
        configuredId, hasBankAcct: !!allSettings['promptpay_bankacct'],
      });
      const [uRowsR] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      const usernameR = uRowsR[0]?.username ?? `User#${userId}`;
      notificationService.create('topup_failed',
        `บัญชีผู้รับไม่ตรง: ${usernameR}`,
        JSON.stringify({
          username: usernameR, userId,
          status: 'ปฏิเสธ',
          reason: 'บัญชีผู้รับไม่ตรง',
          detail: `สลิปโอนไปยัง ${match.receiverAccount || match.receiverName || '-'} ไม่ตรงกับบัญชีของร้าน`,
          trans_ref: transRef,
          amount: `฿${amount}`,
          bank: raw.sender?.bank?.short ?? '-',
        })
      );
      throw new ValidationError('สลิปนี้โอนไปยังบัญชีอื่น ไม่ใช่บัญชีของร้านนี้');
    }
    logger.info('Slip receiver matched', { transRef, userId, matchedBy: match.matchedBy });

    // ── Layer 6: Bonus calculation ────────────────────────────────────────────
    const ppBonus = resolveTopupBonus(allSettings, 'promptpay');
    const rawMult = parseFloat(ppBonus.multiplier || '1');
    const multiplier = (ppBonus.enabled && rawMult > 1) ? rawMult : 1;
    let creditAmount = parseFloat((amount * multiplier).toFixed(2));
    let slipDesc = multiplier > 1
      ? `สลิป ฿${amount} (โบนัส x${multiplier} = ฿${creditAmount}, ${raw.sender?.bank?.short ?? 'Bank'})`
      : `สลิป ฿${amount} (${raw.sender?.bank?.short ?? 'Bank'})`;

    // ── Layer 6b: Discount code (top-up bonus credit) ────────────────────────
    // If the user applied a code, validate it now BEFORE we open the credit tx.
    // We re-validate inside the tx via discountService.consume() to close the
    // TOCTOU window (between preview and consume).
    let discountBonus = 0;
    let discountRow: { id: number; code: string } | null = null;
    if (discountCode && discountCode.trim()) {
      const preview = await discountService.preview(discountCode.trim(), 'topup', amount, userId);
      discountBonus = preview.discountAmount;
      discountRow = { id: preview.codeRow.id, code: preview.codeRow.code };
      creditAmount = parseFloat((creditAmount + discountBonus).toFixed(2));
      slipDesc = `${slipDesc} + โค้ด ${discountRow.code} (+฿${discountBonus.toFixed(2)})`;
    }

    // ── Layer 7: DB duplicate check + atomic credit ───────────────────────────
    // Uses FOR UPDATE lock on slip_logs to prevent race conditions where the same
    // transRef is submitted concurrently by multiple requests.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM slip_logs WHERE trans_ref = ? FOR UPDATE',
        [transRef]
      );
      if (existing.length > 0) {
        const [uRowsDB] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
        const usernameDB = uRowsDB[0]?.username ?? `User#${userId}`;
        notificationService.create('topup_failed',
          `สลิปซ้ำใน DB: ${usernameDB}`,
          JSON.stringify({
            username: usernameDB, userId,
            status: 'ปฏิเสธ',
            reason: 'สลิปซ้ำในระบบ (DB)',
            detail: 'trans_ref นี้มีอยู่ใน slip_logs แล้ว อาจเป็น retry หรือ race condition',
            trans_ref: transRef,
          })
        );
        throw new ConflictError('สลิปนี้ถูกใช้เติมเงินไปแล้ว');
      }

      const slipDate = raw.date ? new Date(raw.date) : new Date();
      await conn.execute(
        `INSERT INTO slip_logs (user_id, trans_ref, amount, bank_from, bank_to, sender_name, receiver_name, slip_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          transRef,
          amount,
          raw.sender?.bank?.id ?? null,
          raw.receiver?.bank?.id ?? null,
          raw.sender?.account?.name?.th ?? raw.sender?.account?.name?.en ?? null,
          raw.receiver?.account?.name?.th ?? raw.receiver?.account?.name?.en ?? null,
          slipDate,
        ]
      );

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');

      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter  = balanceBefore + creditAmount;

      await conn.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, userId]);
      await conn.execute(
        `INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description)
         VALUES (?, 'credit', ?, ?, ?, 'slip', ?, ?)`,
        [userId, creditAmount, balanceBefore, balanceAfter, transRef, slipDesc]
      );
      // Ledger records the REAL money paid (`amount`), NOT the bonus-inflated
      // creditAmount. Toprank + dashboard accounting SUM transactions.amount, so
      // they must reflect actual revenue. The bonus only inflates the wallet
      // balance / wallet_logs above (the player's spendable points).
      const [txResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'slip', 'success', ?, ?)`,
        [userId, amount, transRef, slipDesc]
      );
      const transactionId = txResult.insertId;

      // Consume discount code inside the credit tx so a payment rollback also
      // releases the redeem_log slot. Re-validates max_uses inside the lock.
      if (discountRow) {
        await discountService.consume(conn, discountRow.id, userId);
      }

      await conn.commit();

      // qualified_at is the BANK TRANSFER time (slipDate), not the upload time.
      // This is both fairer (pay 23:58, verify 00:05, still counts) and safer
      // (a slip hoarded from before the window does not qualify).
      try {
        await campaignService.grantForTopup({
          userId,
          transactionId,
          amountBaht: amount,
          qualifiedAt: slipDate,
        });
      } catch (err) {
        logger.error('Campaign grant failed after slip topup', {
          userId, transactionId, error: (err as Error)?.message,
        });
      }

      logger.info('Slip verified', { userId, paidAmount: amount, creditAmount, multiplier, transRef });

      const [uRows] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      const username = uRows[0]?.username ?? `User#${userId}`;
      notificationService.create('topup_success',
        `เติมเงินสำเร็จ: ${username}`,
        JSON.stringify({
          username, userId,
          status: 'สำเร็จ',
          amount_paid: `฿${amount}`,
          credit: multiplier > 1 ? `฿${creditAmount} (โบนัส x${multiplier})` : `฿${creditAmount}`,
          bank: raw.sender?.bank?.short ?? '-',
          sender_name: raw.sender?.account?.name?.th ?? raw.sender?.account?.name?.en ?? '-',
          trans_ref: transRef,
          balance_after: `฿${balanceAfter.toLocaleString()}`,
        })
      );

      return {
        amount: creditAmount,
        paid_amount: amount,
        multiplier,
        transRef,
        senderBank:   raw.sender?.bank?.short ?? null,
        senderName:   raw.sender?.account?.name?.th ?? raw.sender?.account?.name?.en ?? null,
        receiverBank: raw.receiver?.bank?.short ?? null,
        balanceAfter,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

export const paymentService = new PaymentService();
