import { parseRedeemResponse, TrueMoneyApiError } from '../truemoney.service';

const okJson = {
  status: { code: 'SUCCESS', message: 'success' },
  data: {
    my_ticket: { amount_baht: '100.00' },
    voucher: { redeemed_amount_baht: '100.00' },
    owner_profile: { full_name: 'Somchai J.' },
  },
};

describe('parseRedeemResponse', () => {
  it('returns amount + owner on SUCCESS', () => {
    expect(parseRedeemResponse(200, okJson)).toEqual({ amount: 100, ownerName: 'Somchai J.' });
  });
  it('handles missing owner_profile', () => {
    const j = { ...okJson, data: { my_ticket: { amount_baht: '55.50' } } };
    expect(parseRedeemResponse(200, j)).toEqual({ amount: 55.5, ownerName: null });
  });
  it('throws mapped error on a TrueMoney error status', () => {
    const j = { status: { code: 'VOUCHER_EXPIRED', message: 'expired' } };
    try {
      parseRedeemResponse(200, j);
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TrueMoneyApiError);
      expect((e as TrueMoneyApiError).code).toBe('VOUCHER_EXPIRED');
      expect((e as TrueMoneyApiError).message).toContain('หมดอายุ');
    }
  });
  it('throws when amount is missing on a SUCCESS body', () => {
    const j = { status: { code: 'SUCCESS' }, data: {} };
    expect(() => parseRedeemResponse(200, j)).toThrow(TrueMoneyApiError);
  });
  it('throws on a non-2xx with no usable body', () => {
    expect(() => parseRedeemResponse(500, {})).toThrow(TrueMoneyApiError);
  });
});
