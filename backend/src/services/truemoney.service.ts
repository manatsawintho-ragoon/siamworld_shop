import http2 from 'http2';
import dns from 'dns';
import { logger } from '../utils/logger';

// ── Custom error class ───────────────────────────────────────────────────────
export class TrueMoneyApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'TrueMoneyApiError';
  }
}

// ── Voucher hash extraction ──────────────────────────────────────────────────
// Accepts a full gift link (…?v=HASH) or a raw hash. Returns the first
// continuous alphanumeric run of the code segment.
export function extractVoucherHash(input: string): string {
  const trimmed = (input ?? '').trim();
  const parts = trimmed.split('?v=');
  const candidate = parts[1] ?? parts[0] ?? '';
  const match = candidate.match(/[0-9A-Za-z]+/);
  if (!match) {
    throw new TrueMoneyApiError('INVALID_VOUCHER_CODE', 'ลิงก์ซองของขวัญไม่ถูกต้อง');
  }
  return match[0];
}

// ── Phone normalization ──────────────────────────────────────────────────────
// Normalizes to 0XXXXXXXXX and validates a Thai mobile (0[689]xxxxxxxx).
export function normalizePhone(phone: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (/^66\d{9}$/.test(digits)) digits = '0' + digits.slice(2);
  if (!/^0[689]\d{8}$/.test(digits)) {
    throw new TrueMoneyApiError('INVALID_PHONE_NUMBER', 'เบอร์ TrueMoney Wallet ไม่ถูกต้อง');
  }
  return digits;
}

// ── Status code → Thai message ───────────────────────────────────────────────
const STATUS_THAI: Record<string, string> = {
  VOUCHER_NOT_FOUND:      'ไม่พบซองของขวัญนี้ ลิงก์อาจไม่ถูกต้อง',
  VOUCHER_EXPIRED:        'ซองของขวัญนี้หมดอายุแล้ว',
  VOUCHER_OUT_OF_STOCK:   'ซองของขวัญนี้ถูกรับไปหมดแล้ว',
  TARGET_USER_REDEEMED:   'ซองของขวัญนี้ถูกใช้ไปแล้ว',
  CANNOT_GET_OWN_VOUCHER: 'ไม่สามารถรับซองของตัวเองได้',
};

export function statusToThaiMessage(code: string): string {
  return STATUS_THAI[code] ?? 'แลกซองของขวัญไม่สำเร็จ กรุณาตรวจสอบลิงก์อีกครั้ง';
}

const TRUEMONEY_HOSTNAME = 'gift.truemoney.com';

// ── Response parsing (pure) ──────────────────────────────────────────────────
export function parseRedeemResponse(
  httpStatus: number,
  json: any,
): { amount: number; ownerName: string | null } {
  const code: string | undefined = json?.status?.code;
  if (code !== 'SUCCESS') {
    if (code) throw new TrueMoneyApiError(code, statusToThaiMessage(code), 400);
    throw new TrueMoneyApiError(
      'HTTP_ERROR_UNKNOWN',
      'แลกซองของขวัญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      httpStatus >= 500 ? 503 : 400,
    );
  }
  const rawAmount = json?.data?.my_ticket?.amount_baht ?? json?.data?.voucher?.redeemed_amount_baht;
  const amount = parseFloat(rawAmount);
  if (!isFinite(amount) || amount <= 0) {
    throw new TrueMoneyApiError('INVALID_AMOUNT', 'ไม่สามารถอ่านยอดเงินจากซองของขวัญได้', 400);
  }
  const ownerName: string | null = json?.data?.owner_profile?.full_name ?? null;
  return { amount, ownerName };
}

// ── Hardened HTTP/2 transport (mirrors easyslip.service.ts) ──────────────────
function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses?.length) reject(err ?? new Error('No IPv4 address'));
      else resolve(addresses[0]);
    });
  });
}

async function http2Post(path: string, body: string): Promise<{ status: number; json: any }> {
  const ipv4 = await resolveIPv4(TRUEMONEY_HOSTNAME);
  return new Promise((resolve, reject) => {
    const session = http2.connect(`https://${ipv4}`, { servername: TRUEMONEY_HOSTNAME });
    const timer = setTimeout(() => { session.destroy(); reject(new Error('Request timeout')); }, 30000);
    session.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    const bodyBuf = Buffer.from(body);
    const req = session.request({
      ':method': 'POST',
      ':path': path,
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; SiamsiteShop/1.0)',
      'content-length': String(bodyBuf.length),
    });
    req.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    let status = 0;
    req.on('response', (headers) => { status = headers[':status'] as number; });
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      clearTimeout(timer);
      session.destroy();
      try { resolve({ status, json: JSON.parse(raw) }); }
      catch { reject(new Error('Invalid JSON response')); }
    });
    req.write(bodyBuf);
    req.end();
  });
}

// ── Service ──────────────────────────────────────────────────────────────────
class TrueMoneyService {
  async redeem(phone: string, voucherHash: string): Promise<{ amount: number; ownerName: string | null }> {
    const path = `/campaign/vouchers/${encodeURIComponent(voucherHash)}/redeem`;
    const payload = JSON.stringify({ mobile: phone, voucher_hash: voucherHash });
    let status: number;
    let json: any;
    try {
      const res = await http2Post(path, payload);
      status = res.status;
      json = res.json;
    } catch (err: any) {
      logger.warn('TrueMoney connection error', { error: err.message, code: err.code });
      throw new TrueMoneyApiError('NETWORK_ERROR', 'ไม่สามารถเชื่อมต่อระบบ TrueMoney ได้ กรุณาลองใหม่อีกครั้ง', 503);
    }
    return parseRedeemResponse(status, json);
  }
}

export const truemoneyService = new TrueMoneyService();
