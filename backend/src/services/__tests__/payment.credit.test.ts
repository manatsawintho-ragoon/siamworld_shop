import { computeTopupCredit } from '../payment.service';

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
