import { pool } from '../database/connection';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { walletService } from './wallet.service';
import { logger } from '../utils/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { easySlipService, EasySlipApiError } from './easyslip.service';
import { settingsService } from './settings.service';

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
    if (amount <= 0 || amount > 100000) throw new ValidationError('Invalid amount');

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

  async confirmPromptPay(userId: number, reference: string) {
    // Read bonus settings before acquiring DB connection
    const bonusSettings = await settingsService.getAll();
    const bonusActive = bonusSettings['topup_bonus_enabled'] === 'true';
    const rawMult = parseFloat(bonusSettings['topup_bonus_multiplier'] || '1');
    const multiplier = (bonusActive && rawMult > 1) ? rawMult : 1;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM transactions WHERE user_id = ? AND reference = ? AND status = ? FOR UPDATE',
        [userId, reference, 'pending']
      );
      if (rows.length === 0) throw new NotFoundError('Transaction not found or already confirmed');

      const tx = rows[0];
      const paidAmount = parseFloat(tx.amount);
      const creditAmount = parseFloat((paidAmount * multiplier).toFixed(2));
      const desc = multiplier > 1
        ? `PromptPay ฿${paidAmount} (โบนัส x${multiplier} = ฿${creditAmount})`
        : `PromptPay ฿${paidAmount}`;

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');
      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter = balanceBefore + creditAmount;

      // Mark existing transaction as success (no new duplicate transaction)
      await conn.execute('UPDATE transactions SET status = ? WHERE id = ?', ['success', tx.id]);
      // Update wallet balance directly
      await conn.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, userId]);
      // Audit log
      await conn.execute(
        'INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description) VALUES (?,?,?,?,?,?,?,?)',
        [userId, 'credit', creditAmount, balanceBefore, balanceAfter, 'promptpay', reference, desc]
      );

      await conn.commit();
      const wallet = await walletService.getWallet(userId);
      logger.info('PromptPay confirmed', { userId, paidAmount, creditAmount, multiplier, reference });
      return { message: 'Payment confirmed', amount: creditAmount, paid_amount: paidAmount, multiplier, wallet };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async redeemTrueMoney(userId: number, giftLink: string) {
    if (!giftLink.includes('truemoney.com/campaign')) throw new ValidationError('Invalid TrueMoney gift link');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the row if it exists, preventing concurrent redemption of the same link
      const [used] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM truemoney_used WHERE gift_link = ? FOR UPDATE',
        [giftLink]
      );
      if (used.length > 0) throw new ConflictError('This gift code has already been redeemed');

      // Simulate: generate random amount 10-500
      const amount = Math.floor(Math.random() * 491) + 10;

      await conn.execute(
        'INSERT INTO truemoney_used (gift_link, user_id, amount) VALUES (?,?,?)',
        [giftLink, userId, amount]
      );
      await conn.commit();

      const wallet = await walletService.topup(userId, amount, 'truemoney', giftLink, `TrueMoney ฿${amount}`);
      logger.info('TrueMoney redeemed', { userId, amount });
      return { message: `Redeemed ฿${amount}`, amount, wallet };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // ── EasySlip slip verification ────────────────────────────────────────────

  async verifySlip(userId: number, input: { base64?: string; url?: string; payload?: string }) {
    // 1. Call EasySlip API
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
        // Map EasySlip error codes to user-friendly messages
        const msgs: Record<string, string> = {
          SLIP_NOT_FOUND:      'ไม่พบสลิปนี้หรือ QR Code ไม่ถูกต้อง',
          SLIP_PENDING:        'สลิปกำลังดำเนินการ กรุณารอสักครู่แล้วลองใหม่',
          IMAGE_SIZE_TOO_LARGE:'ไฟล์รูปใหญ่เกิน 4 MB',
          INVALID_IMAGE_FORMAT:'รูปภาพไม่ถูกต้อง รองรับ JPEG, PNG, GIF, WebP',
          QUOTA_EXCEEDED:      'ระบบตรวจสอบสลิปถึงขีดจำกัด กรุณาแจ้งผู้ดูแลระบบ',
          VALIDATION_ERROR:    'ข้อมูลสลิปไม่ถูกต้อง',
        };
        throw new ValidationError(msgs[err.code] ?? `ตรวจสอบสลิปไม่สำเร็จ: ${err.message}`);
      }
      throw err;
    }

    const raw = slipData.rawSlip;
    const amount = raw.amount.amount;
    if (!amount || amount <= 0) throw new ValidationError('จำนวนเงินในสลิปไม่ถูกต้อง');

    const transRef = raw.transRef;
    if (!transRef) throw new ValidationError('สลิปนี้ไม่มีรหัสอ้างอิง');

    // 2. Read bonus settings (before DB connection)
    const bonusSettings = await settingsService.getAll();
    const bonusActive = bonusSettings['topup_bonus_enabled'] === 'true';
    const rawMult = parseFloat(bonusSettings['topup_bonus_multiplier'] || '1');
    const multiplier = (bonusActive && rawMult > 1) ? rawMult : 1;
    const creditAmount = parseFloat((amount * multiplier).toFixed(2));
    const slipDesc = multiplier > 1
      ? `สลิป ฿${amount} (โบนัส x${multiplier} = ฿${creditAmount}, ${raw.sender?.bank?.short ?? 'Bank'})`
      : `สลิป ฿${amount} (${raw.sender?.bank?.short ?? 'Bank'})`;

    // 3. Check our own DB for duplicate (belt-and-suspenders)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.execute<RowDataPacket[]>(
        'SELECT id FROM slip_logs WHERE trans_ref = ? FOR UPDATE',
        [transRef]
      );
      if (existing.length > 0) throw new ConflictError('สลิปนี้ถูกใช้เติมเงินไปแล้ว');

      // 3. Record the slip
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

      // 4. Credit wallet (inside transaction)
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
      await conn.execute(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'slip', 'success', ?, ?)`,
        [userId, creditAmount, transRef, slipDesc]
      );

      await conn.commit();

      logger.info('Slip verified', { userId, paidAmount: amount, creditAmount, multiplier, transRef });

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
