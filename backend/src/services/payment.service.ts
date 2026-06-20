import { pool } from '../database/connection';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { easySlipService, EasySlipApiError } from './easyslip.service';
import { settingsService } from './settings.service';
import { notificationService } from './notification.service';
import { discountService } from './discount.service';

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
function generatePromptPayPayload(promptpayId: string, amount: number): string {
  const normalized = promptpayId.replace(/[-\s]/g, '');
  // Phone: 10 digits → 0066 + last 9; Tax ID: 13 digits → keep as-is
  const target = normalized.length === 10
    ? '0066' + normalized.slice(1)
    : normalized;
  const merchantInfo = ppTag('00', 'A000000677010111') + ppTag('01', target);
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

class PaymentService {
  async createPromptPay(userId: number, amount: number) {
    if (amount < 10 || amount > 100000) throw new ValidationError('ยอดขั้นต่ำ 10 บาท');

    const settings = await settingsService.getAll();
    const promptpayId   = settings['promptpay_id']        || '';
    const promptpayName = [settings['promptpay_firstname'], settings['promptpay_lastname']]
      .filter(Boolean).join(' ') || settings['promptpay_name'] || '';

    if (!promptpayId) throw new ValidationError('ยังไม่ได้ตั้งค่า PromptPay ID กรุณาแจ้งผู้ดูแลระบบ');

    const reference = `PP${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payload   = generatePromptPayPayload(promptpayId, amount);

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

  async redeemTrueMoney(_userId: number, _giftLink: string) {
    // TrueMoney integration is not yet available. Disabled to prevent the simulated
    // random-amount payout from being exploited.
    throw new ValidationError('ระบบ TrueMoney ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
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
    const configuredId = (allSettings['promptpay_id'] || '').replace(/[-\s]/g, '');
    if (!configuredId) {
      throw new ValidationError('ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาแจ้งผู้ดูแลระบบ');
    }
    // PromptPay: receiver is in proxy.account (may be masked e.g. "xxx-xxx-0553"), not bank.account
    // Bank transfer: receiver is in bank.account (full number)
    const receiverRaw: string = (
      (raw.receiver?.account as any)?.proxy?.account ??
      raw.receiver?.account?.bank?.account ??
      ''
    );
    if (!receiverRaw) {
      logger.warn('Slip receiver account missing in EasySlip response', { transRef, userId, receiver: raw.receiver });
      throw new ValidationError('สลิปนี้ไม่มีข้อมูลบัญชีผู้รับ ไม่สามารถยืนยันได้');
    }
    // Normalize: 0066XXXXXXXXX ↔ 0XXXXXXXXX ↔ 66XXXXXXXXX
    const normalizeAccount = (v: string) => {
      if (v.startsWith('0066')) return '0' + v.slice(4);
      if (/^66\d{9}$/.test(v))  return '0' + v.slice(2);
      return v;
    };
    // EasySlip may return masked number e.g. "06xxxx6132" (prefix digits + x's + suffix digits)
    // Extract only the trailing digits AFTER the masking chars to get an unambiguous suffix.
    // e.g. "06xxxx6132" → maskedSuffix="6132"; "xxx-xxx-0553" → maskedSuffix="0553"
    const receiverAccount = receiverRaw.replace(/[-\s]/g, '');
    const maskedSuffix = receiverAccount.match(/x+([0-9]+)$/i)?.[1] ?? '';
    const visibleDigits = maskedSuffix || receiverAccount.replace(/[^0-9]/g, '');
    const receiverMatched =
      normalizeAccount(receiverAccount) === normalizeAccount(configuredId) ||
      (visibleDigits.length >= 4 && normalizeAccount(configuredId).endsWith(visibleDigits));
    if (!receiverMatched) {
      logger.warn('Slip receiver mismatch', { transRef, userId, receiverRaw, configuredId });
      const [uRowsR] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      const usernameR = uRowsR[0]?.username ?? `User#${userId}`;
      notificationService.create('topup_failed',
        `บัญชีผู้รับไม่ตรง: ${usernameR}`,
        JSON.stringify({
          username: usernameR, userId,
          status: 'ปฏิเสธ',
          reason: 'บัญชีผู้รับไม่ตรง',
          detail: `สลิปโอนไปยัง ${receiverAccount} แต่ระบบกำหนด ${configuredId}`,
          trans_ref: transRef,
          amount: `฿${amount}`,
          bank: raw.sender?.bank?.short ?? '-',
        })
      );
      throw new ValidationError('สลิปนี้โอนไปยังบัญชีอื่น ไม่ใช่บัญชีของร้านนี้');
    }

    // ── Layer 6: Bonus calculation ────────────────────────────────────────────
    const bonusActive = allSettings['topup_bonus_enabled'] === 'true';
    const rawMult = parseFloat(allSettings['topup_bonus_multiplier'] || '1');
    const multiplier = (bonusActive && rawMult > 1) ? rawMult : 1;
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
      await conn.execute(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'slip', 'success', ?, ?)`,
        [userId, amount, transRef, slipDesc]
      );

      // Consume discount code inside the credit tx so a payment rollback also
      // releases the redeem_log slot. Re-validates max_uses inside the lock.
      if (discountRow) {
        await discountService.consume(conn, discountRow.id, userId);
      }

      await conn.commit();

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
