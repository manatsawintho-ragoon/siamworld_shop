import { extractVoucherHash, normalizePhone, statusToThaiMessage, TrueMoneyApiError } from '../truemoney.service';

describe('extractVoucherHash', () => {
  it('extracts hash from a full gift link', () => {
    expect(extractVoucherHash('https://gift.truemoney.com/campaign/?v=abc123XYZ')).toBe('abc123XYZ');
  });
  it('accepts a raw hash', () => {
    expect(extractVoucherHash('abc123XYZ')).toBe('abc123XYZ');
  });
  it('takes the first alphanumeric run after ?v=', () => {
    expect(extractVoucherHash('https://gift.truemoney.com/campaign/vouchers/?v=HASH001#frag')).toBe('HASH001');
  });
  it('throws on input with no valid code', () => {
    expect(() => extractVoucherHash('https://example.com/?v=')).toThrow(TrueMoneyApiError);
    expect(() => extractVoucherHash('!!!')).toThrow(TrueMoneyApiError);
  });
});

describe('normalizePhone', () => {
  it('passes a valid 0-prefixed number', () => {
    expect(normalizePhone('0812345678')).toBe('0812345678');
  });
  it('converts 66-prefixed to 0-prefixed', () => {
    expect(normalizePhone('66812345678')).toBe('0812345678');
  });
  it('strips +66 and separators', () => {
    expect(normalizePhone('+66 81-234-5678')).toBe('0812345678');
  });
  it('throws on invalid number', () => {
    expect(() => normalizePhone('123')).toThrow(TrueMoneyApiError);
    expect(() => normalizePhone('0712345678')).toThrow(TrueMoneyApiError); // 07x not allowed
  });
});

describe('statusToThaiMessage', () => {
  it('maps known codes', () => {
    expect(statusToThaiMessage('VOUCHER_NOT_FOUND')).toContain('ไม่พบ');
    expect(statusToThaiMessage('VOUCHER_EXPIRED')).toContain('หมดอายุ');
    expect(statusToThaiMessage('VOUCHER_OUT_OF_STOCK')).toContain('ถูกรับ');
    expect(statusToThaiMessage('TARGET_USER_REDEEMED')).toContain('ถูกใช้');
    expect(statusToThaiMessage('CANNOT_GET_OWN_VOUCHER')).toContain('ตัวเอง');
  });
  it('falls back for unknown codes', () => {
    expect(statusToThaiMessage('SOMETHING_ELSE')).toContain('ไม่สำเร็จ');
  });
});
