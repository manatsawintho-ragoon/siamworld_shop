import { matchReceiver, numberMatches, nameMatches, SlipParty } from '../receiver-match';

const mkReceiver = (p: { proxy?: string; bank?: string; nameTh?: string }): SlipParty => ({
  account: {
    ...(p.nameTh ? { name: { th: p.nameTh } } : {}),
    ...(p.bank ? { bank: { type: 'BANKAC', account: p.bank } } : {}),
    ...(p.proxy ? { proxy: { type: 'MSISDN', account: p.proxy } } : {}),
  },
});

describe('numberMatches', () => {
  it('matches a masked proxy suffix (>= 4 visible digits) to a phone promptpay_id', () => {
    expect(numberMatches('06xxxx6132', '0631816132')).toBe(true);
  });
  it('rejects a suffix that does not match', () => {
    expect(numberMatches('06xxxx6132', '0631810000')).toBe(false);
  });
  it('requires >= 4 visible digits (2-digit mask is too weak to accept)', () => {
    expect(numberMatches('08xxxxxxxx89', '0812345689')).toBe(false);
  });
  it('normalizes an unmasked 66-prefixed international format', () => {
    expect(numberMatches('66812345689', '0812345689')).toBe(true);
  });
  it('returns false for empty inputs', () => {
    expect(numberMatches('', '0812345678')).toBe(false);
    expect(numberMatches('08xxxx1234', '')).toBe(false);
  });
});

describe('nameMatches', () => {
  it('matches when the slip masks the surname tail', () => {
    expect(nameMatches('นาย เอื้ออังกูร น', 'นาย เอื้ออังกูร นพสันติ')).toBe(true);
  });
  it('matches when the slip masks with x characters', () => {
    expect(nameMatches('นาย เอื้ออังกูร นxxxxx', 'เอื้ออังกูร นพสันติ')).toBe(true);
  });
  it('ignores differing titles', () => {
    expect(nameMatches('MR. SOMCHAI J', 'นาย somchai jaidee')).toBe(true);
  });
  it('rejects a different name', () => {
    expect(nameMatches('นาย สมชาย ใจดี', 'นาย เอื้ออังกูร นพสันติ')).toBe(false);
  });
  it('rejects when the visible portion is too short to be safe', () => {
    expect(nameMatches('นาย เอ', 'นาย เอื้ออังกูร นพสันติ')).toBe(false);
  });
});

describe('matchReceiver', () => {
  const phoneSettings = {
    promptpay_id: '0631816132',
    promptpay_name: 'นาย เอื้ออังกูร นพสันติ',
  };

  it('accepts a phone-PromptPay slip via the number path', () => {
    const r = matchReceiver(mkReceiver({ proxy: '06xxxx6132', nameTh: 'นาย เอื้ออังกูร น' }), phoneSettings);
    expect(r).toMatchObject({ matched: true, matchedBy: 'number' });
  });

  it('rejects a phone-PromptPay slip paid to a different number', () => {
    const r = matchReceiver(mkReceiver({ proxy: '06xxxx0000', nameTh: 'นาย เอื้ออังกูร น' }), phoneSettings);
    expect(r.matched).toBe(false);
  });

  // National-ID PromptPay: EasySlip returns the linked bank account (…6960), not the
  // 13-digit card number. Accept only when bank account AND name both match.
  const taxidSettings = {
    promptpay_id: '1102003269441',       // citizen id — NOT present on the slip
    promptpay_bankacct: '1234566960',    // registered receiver bank account
    promptpay_firstname: 'นาย เอื้ออังกูร',
    promptpay_lastname: 'นพสันติ',
  };

  it('accepts a บัตรปชช. slip when bank account AND name both match', () => {
    const r = matchReceiver(mkReceiver({ bank: 'xxxxxx6960', nameTh: 'นาย เอื้ออังกูร น' }), taxidSettings);
    expect(r).toMatchObject({ matched: true, matchedBy: 'bank+name' });
  });

  it('rejects a บัตรปชช. slip when the bank account matches but the name does not', () => {
    const r = matchReceiver(mkReceiver({ bank: 'xxxxxx6960', nameTh: 'นาย สมชาย ใจดี' }), taxidSettings);
    expect(r.matched).toBe(false);
  });

  it('rejects a บัตรปชช. slip when the name matches but the bank account does not', () => {
    const r = matchReceiver(mkReceiver({ bank: 'xxxxxx0000', nameTh: 'นาย เอื้ออังกูร น' }), taxidSettings);
    expect(r.matched).toBe(false);
  });

  it('does not accept on citizen-id number alone (not present on slip)', () => {
    // Only a name, no bank account registered -> cannot verify -> reject.
    const r = matchReceiver(mkReceiver({ bank: 'xxxxxx6960', nameTh: 'นาย เอื้ออังกูร น' }), {
      promptpay_id: '1102003269441',
      promptpay_name: 'นาย เอื้ออังกูร นพสันติ',
    });
    expect(r.matched).toBe(false);
  });
});
