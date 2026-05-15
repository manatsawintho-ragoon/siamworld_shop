import https from 'https';
import { pool } from '../database/connection';
import { settingsService } from './settings.service';
import { walletService } from './wallet.service';
import { ValidationError, ConflictError } from '../utils/errors';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Use HTTPS (HTTP/1.1) — HTTP/2 POST is blocked by Docker bridge network MTU/filtering
function easyslipPost(apiKey: string, bodyObj: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(bodyObj));
    const req = https.request({
      hostname: 'api.easyslip.com',
      path:     '/v2/verify/bank',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': body.length,
        'Authorization':  `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Invalid JSON from EasySlip')); }
      });
    });

    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('Request timeout'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', (e) => reject(e));

    req.write(body);
    req.end();
  });
}

// ── PromptPay QR generator ────────────────────────────────────
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
  const target = normalized.length === 10 ? '0066' + normalized.slice(1) : normalized;
  const merchantInfo = ppTag('00', 'A000000677010111') + ppTag('01', target);
  const body = [
    ppTag('00', '01'), ppTag('01', '12'), ppTag('29', merchantInfo),
    ppTag('52', '0000'), ppTag('53', '764'),
    ppTag('54', amount.toFixed(2)), ppTag('58', 'TH'), '6304',
  ].join('');
  return body + ppCrc16(body);
}

// Normalize Thai phone numbers for comparison:
// 0066XXXXXXXXX ↔ 0XXXXXXXXX ↔ 66XXXXXXXXX → canonical 0XXXXXXXXX
function normalizeAccount(v: string): string {
  const clean = v.replace(/[-\s]/g, '');
  if (clean.startsWith('0066')) return '0' + clean.slice(4);
  if (/^66\d{9}$/.test(clean)) return '0' + clean.slice(2);
  return clean;
}

// EasySlip returns PromptPay receiver masked (e.g. "06xxxx6132" or "xxx-xxx-0553").
// Extract only the digits AFTER masking chars to get an unambiguous suffix for comparison.
// "06xxxx6132" → maskedSuffix="6132"; "xxx-xxx-0553" → visibleDigits="0553"
function maskedReceiverMatchesConfig(masked: string, configured: string): boolean {
  const clean = masked.replace(/[-\s]/g, '');
  const maskedSuffix = clean.match(/x+([0-9]+)$/i)?.[1] ?? '';
  const visibleDigits = maskedSuffix || clean.replace(/[^0-9]/g, '');
  if (visibleDigits.length < 4) return false;
  return normalizeAccount(configured).endsWith(visibleDigits);
}

class PaymentService {
  /** Generate PromptPay QR for wallet top-up */
  async createTopupQR(userId: number, amount: number) {
    if (amount < 10 || amount > 100000) throw new ValidationError('ยอดเติมเงินต้องอยู่ระหว่าง 10 - 100,000 บาท');

    const settings = await settingsService.getAll();
    const promptpayId = settings['promptpay_id'];
    if (!promptpayId) throw new ValidationError('ยังไม่ได้ตั้งค่า PromptPay กรุณาติดต่อผู้ดูแลระบบ');

    const payload = generatePromptPayPayload(promptpayId, amount);
    const masked = promptpayId.slice(0, 2) + 'x-xxx-' + promptpayId.slice(-4);
    return { payload, amount, recipientName: settings['promptpay_name'] || '', recipientId: masked };
  }

  /** Verify slip via EasySlip and credit wallet */
  async verifyTopupSlip(userId: number, amount: number, slipBase64: string): Promise<{ balanceAfter: number; ref: string }> {
    if (amount < 10) throw new ValidationError('ยอดไม่ถูกต้อง');

    const settings = await settingsService.getAll();
    const apiKey = settings['easyslip_api_key'];
    if (!apiKey) throw new ValidationError('ยังไม่ได้ตั้งค่า EasySlip API Key');

    // ── Layer 1: Call EasySlip API (HTTP/2 to avoid Cloudflare TLS-fingerprint block) ──
    let easyslipData: Record<string, unknown>;
    try {
      const base64WithPrefix = slipBase64.startsWith('data:')
        ? slipBase64
        : `data:image/jpeg;base64,${slipBase64}`;
      const json = await easyslipPost(apiKey, { base64: base64WithPrefix, checkDuplicate: true }) as any;
      if (!json.success) {
        const errCode: string = json.error?.code ?? '';
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
        };
        throw new ValidationError(msgs[errCode] ?? json.error?.message ?? 'สลิปไม่ถูกต้อง');
      }
      easyslipData = json.data;
    } catch (err: unknown) {
      if (err instanceof ValidationError || err instanceof ConflictError) throw err;
      const code = (err as any)?.code ?? '';
      const networkCodes = ['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ERR_NETWORK', 'ERR_HTTP2_STREAM_CANCEL', 'ERR_HTTP2_SESSION_ERROR', 'ERR_HTTP2_CONNECT_ERROR', 'ERR_HTTP2_GOAWAY_SESSION'];
      console.error('[EasySlip] Error code:', code, 'message:', (err as any)?.message);
      if (networkCodes.includes(code)) {
        throw new ValidationError('ไม่สามารถเชื่อมต่อกับระบบตรวจสอบสลิปได้ กรุณาลองใหม่อีกครั้ง');
      }
      console.error('[EasySlip] Unexpected error:', err);
      throw new ValidationError('เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง');
    }

    const rawSlip = (easyslipData as any).rawSlip ?? {};

    // ── Layer 2: EasySlip duplicate flag ───────────────────────────────────
    // EasySlip marks a slip as duplicate once it has seen it — even if OUR previous
    // attempt failed before we wrote to DB (e.g. due to a validation bug). In that
    // case the slip is NOT in our payment_slips table, so we allow the retry.
    if ((easyslipData as any).isDuplicate === true) {
      const transRefEarly: string = rawSlip.transRef || '';
      const [existingSlip] = await pool.execute<RowDataPacket[]>(
        'SELECT id, status FROM payment_slips WHERE easyslip_ref = ?',
        [transRefEarly]
      );
      if (existingSlip.length > 0) {
        // We already processed (or rejected) this slip ourselves — genuinely duplicate.
        console.warn('EasySlip duplicate detected and confirmed in DB', { userId, transRef: transRefEarly });
        throw new ConflictError(
          existingSlip[0].status === 'verified'
            ? 'สลิปนี้เคยใช้งานแล้ว'
            : 'สลิปนี้เคยถูกปฏิเสธแล้ว ไม่สามารถใช้งานได้อีก'
        );
      }
      // Not in our DB — previous attempt likely failed before DB insert. Allow retry.
      console.warn('EasySlip duplicate but not in our DB — allowing retry', { userId, transRef: transRefEarly });
    }

    // ── Layer 3: Basic field validation ────────────────────────────────────
    const transRef: string = rawSlip.transRef || '';
    if (!transRef) throw new ValidationError('สลิปนี้ไม่มีรหัสอ้างอิง');

    const slipAmount: number = rawSlip.amount?.amount ?? 0;
    if (!slipAmount || slipAmount <= 0) throw new ValidationError('จำนวนเงินในสลิปไม่ถูกต้อง');

    // ── Layer 4: Slip age check (≤ 90 days) ────────────────────────────────
    if (rawSlip.date) {
      const slipMs = new Date(rawSlip.date).getTime();
      if (isNaN(slipMs)) throw new ValidationError('วันที่ในสลิปไม่ถูกต้อง');
      const ageDays = (Date.now() - slipMs) / 86_400_000;
      if (ageDays > 90) {
        console.warn('Slip too old', { userId, transRef, ageDays: ageDays.toFixed(1) });
        throw new ValidationError('สลิปนี้หมดอายุแล้ว (เกิน 90 วัน)');
      }
    }

    // ── Layer 5: Receiver account validation ───────────────────────────────
    // Slip must be paid to THIS panel's configured PromptPay account.
    const configuredId = (settings['promptpay_id'] || '').replace(/[-\s]/g, '');
    if (!configuredId) throw new ValidationError('ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาแจ้งผู้ดูแลระบบ');

    // PromptPay: receiver is in proxy.account (masked, e.g. "xxx-xxx-0553"), not bank.account
    // Bank transfer: receiver is in bank.account (full number)
    const receiverRaw: string =
      rawSlip.receiver?.account?.proxy?.account ??
      rawSlip.receiver?.account?.bank?.account ??
      '';
    if (!receiverRaw) {
      console.warn('Slip receiver account missing', { userId, transRef, receiver: rawSlip.receiver });
      throw new ValidationError('สลิปนี้ไม่มีข้อมูลบัญชีผู้รับ ไม่สามารถยืนยันได้');
    }
    // Use masked-aware comparison: EasySlip returns "xxx-xxx-0553" — check suffix match
    const receiverNorm = normalizeAccount(receiverRaw.replace(/[-\s]/g, ''));
    const configNorm   = normalizeAccount(configuredId);
    const matched = receiverNorm === configNorm || maskedReceiverMatchesConfig(receiverRaw, configuredId);
    if (!matched) {
      console.warn('Slip receiver mismatch', { userId, transRef, receiverRaw, configuredId });
      throw new ValidationError('สลิปนี้โอนไปยังบัญชีอื่น ไม่ใช่บัญชีของระบบนี้');
    }

    // ── Layer 6: Amount match ───────────────────────────────────────────────
    if (Math.abs(slipAmount - amount) > 0.5) {
      // Record rejected slip before throwing
      await pool.execute(
        'INSERT INTO payment_slips (user_id, amount, slip_image_base64, easyslip_ref, easyslip_raw, status, purpose, reject_reason) VALUES (?,?,?,?,?,?,?,?)',
        [userId, amount, slipBase64, transRef, JSON.stringify(easyslipData), 'rejected', 'topup',
          `ยอดในสลิป ${slipAmount} ไม่ตรงกับยอดที่แจ้ง ${amount}`]
      );
      throw new ValidationError(`ยอดในสลิป (${slipAmount} บาท) ไม่ตรงกับยอดที่แจ้ง (${amount} บาท)`);
    }

    // ── Layer 7: DB duplicate check + atomic credit ─────────────────────────
    // The previous version did `SELECT ... FOR UPDATE` before INSERT — but FOR UPDATE on
    // a non-existent row locks nothing, so two concurrent requests with the same transRef
    // both fell through and double-credited the wallet. We now rely on the UNIQUE constraint
    // on payment_slips.easyslip_ref (migration 008) and catch ER_DUP_ENTRY.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Pre-check still gives us the better error message for already-rejected slips,
      // but the INSERT below is the actual integrity barrier.
      const [dup] = await conn.execute<RowDataPacket[]>(
        'SELECT id, status FROM payment_slips WHERE easyslip_ref = ?',
        [transRef]
      );
      if (dup.length) {
        const existingStatus = dup[0].status;
        throw new ConflictError(
          existingStatus === 'verified'
            ? 'สลิปนี้เคยใช้งานแล้ว'
            : 'สลิปนี้เคยถูกปฏิเสธแล้ว ไม่สามารถใช้งานได้อีก'
        );
      }

      let slipResult: ResultSetHeader;
      try {
        const [insRes] = await conn.execute<ResultSetHeader>(
          'INSERT INTO payment_slips (user_id, amount, slip_image_base64, easyslip_ref, easyslip_raw, status, purpose, verified_at) VALUES (?,?,?,?,?,?,?,NOW())',
          [userId, slipAmount, slipBase64, transRef, JSON.stringify(easyslipData), 'verified', 'topup']
        );
        slipResult = insRes;
      } catch (e: unknown) {
        if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new ConflictError('สลิปนี้เคยใช้งานแล้ว');
        }
        throw e;
      }

      // Credit wallet using slipAmount (from EasySlip) — not the user-supplied amount
      const [walletRow] = await conn.execute<RowDataPacket[]>(
        'SELECT wallet_balance FROM panel_users WHERE id = ? FOR UPDATE', [userId]
      );
      if (!walletRow[0]) throw new Error('User not found');
      const balanceAfter = Number(walletRow[0].wallet_balance) + slipAmount;
      await conn.execute('UPDATE panel_users SET wallet_balance = ? WHERE id = ?', [balanceAfter, userId]);
      await conn.execute(
        'INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference_id) VALUES (?,?,?,?,?,?)',
        [userId, 'topup', slipAmount, balanceAfter, `เติมเงินผ่าน PromptPay ฿${slipAmount}`, String(slipResult.insertId)]
      );

      await conn.commit();
      console.info('Panel slip verified', { userId, slipAmount, transRef });
      return { balanceAfter, ref: transRef };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getSlipHistory(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, amount, status, purpose, reject_reason, created_at, verified_at FROM payment_slips WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return rows;
  }

  // ── Admin ─────────────────────────────────────────────────
  async getAllSlips(status?: string, page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit | 0, 1), 100);
    const safePage = Math.max(page | 0, 1);
    const offset = (safePage - 1) * safeLimit;
    // Skip slip_image_base64 from list view — admins fetch the image lazily by id.
    const baseFields = `ps.id, ps.user_id, ps.amount, ps.easyslip_ref, ps.status, ps.purpose,
                        ps.subscription_id, ps.reject_reason, ps.created_at, ps.verified_at,
                        pu.email, pu.display_name`;
    let rows: RowDataPacket[];
    let countRows: RowDataPacket[];
    if (status) {
      [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${baseFields}
           FROM payment_slips ps
           JOIN panel_users pu ON pu.id = ps.user_id
          WHERE ps.status = ?
          ORDER BY ps.created_at DESC LIMIT ? OFFSET ?`,
        [status, safeLimit, offset]
      );
      [countRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM payment_slips ps WHERE ps.status = ?',
        [status]
      );
    } else {
      [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT ${baseFields}
           FROM payment_slips ps
           JOIN panel_users pu ON pu.id = ps.user_id
          ORDER BY ps.created_at DESC LIMIT ? OFFSET ?`,
        [safeLimit, offset]
      );
      [countRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM payment_slips ps'
      );
    }
    return { slips: rows, total: countRows[0].total };
  }

  /** Fetch the slip image lazily — used by admin slip detail view. */
  async getSlipImage(slipId: number): Promise<{ image: string | null }> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT slip_image_base64 FROM payment_slips WHERE id = ?', [slipId]
    );
    return { image: rows[0]?.slip_image_base64 ?? null };
  }

  async adminVerifySlip(slipId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM payment_slips WHERE id = ?', [slipId]);
    if (!rows.length) throw new ValidationError('ไม่พบข้อมูลสลิป');
    const slip = rows[0];
    if (slip.status !== 'pending') throw new ValidationError('สลิปนี้ถูกประมวลผลไปแล้ว');

    await pool.execute('UPDATE payment_slips SET status = "verified", verified_at = NOW() WHERE id = ?', [slipId]);
    await walletService.credit(slip.user_id, slip.amount, 'topup', `แอดมินยืนยันการเติมเงิน ฿${slip.amount}`, String(slipId));
  }

  async adminRejectSlip(slipId: number, reason: string) {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM payment_slips WHERE id = ?', [slipId]);
    if (!rows.length) throw new ValidationError('ไม่พบข้อมูลสลิป');
    if (rows[0].status !== 'pending') throw new ValidationError('สลิปนี้ถูกประมวลผลไปแล้ว');

    await pool.execute('UPDATE payment_slips SET status = "rejected", reject_reason = ? WHERE id = ?', [reason, slipId]);
  }
}

export const paymentService = new PaymentService();
