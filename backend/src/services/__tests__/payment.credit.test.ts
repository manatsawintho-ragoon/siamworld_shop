import { computeTopupCredit, resolveTopupBonus } from '../payment.service';

describe('computeTopupCredit', () => {
  it('returns the raw amount when bonus disabled', () => {
    expect(computeTopupCredit(100, '2', false)).toEqual({ creditAmount: 100, multiplier: 1 });
  });
  it('applies the multiplier when enabled and > 1', () => {
    expect(computeTopupCredit(100, '1.5', true)).toEqual({ creditAmount: 150, multiplier: 1.5 });
  });
  it('ignores a multiplier of 1 or less', () => {
    expect(computeTopupCredit(80, '1', true)).toEqual({ creditAmount: 80, multiplier: 1 });
  });
  it('rounds to 2 decimals', () => {
    expect(computeTopupCredit(33.33, '1.1', true)).toEqual({ creditAmount: 36.66, multiplier: 1.1 });
  });
});

describe('resolveTopupBonus', () => {
  it('uses the per-method keys when present', () => {
    const s = {
      topup_bonus_promptpay_enabled: 'true', topup_bonus_promptpay_multiplier: '2',
      topup_bonus_truemoney_enabled: 'false', topup_bonus_truemoney_multiplier: '1',
    };
    expect(resolveTopupBonus(s, 'promptpay')).toEqual({ enabled: true, multiplier: '2' });
    expect(resolveTopupBonus(s, 'truemoney')).toEqual({ enabled: false, multiplier: '1' });
  });
  it('falls back to legacy shared keys when per-method missing', () => {
    const s = { topup_bonus_enabled: 'true', topup_bonus_multiplier: '3' };
    expect(resolveTopupBonus(s, 'promptpay')).toEqual({ enabled: true, multiplier: '3' });
    expect(resolveTopupBonus(s, 'truemoney')).toEqual({ enabled: true, multiplier: '3' });
  });
  it('per-method overrides legacy independently', () => {
    const s = {
      topup_bonus_enabled: 'true', topup_bonus_multiplier: '5',
      topup_bonus_truemoney_enabled: 'false',
    };
    // promptpay still inherits legacy enable; truemoney is explicitly off
    expect(resolveTopupBonus(s, 'promptpay').enabled).toBe(true);
    expect(resolveTopupBonus(s, 'truemoney').enabled).toBe(false);
  });
  it('defaults to disabled / x1 when nothing set', () => {
    expect(resolveTopupBonus({}, 'promptpay')).toEqual({ enabled: false, multiplier: '1' });
  });
});
