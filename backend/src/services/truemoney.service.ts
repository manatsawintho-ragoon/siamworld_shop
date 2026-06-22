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
