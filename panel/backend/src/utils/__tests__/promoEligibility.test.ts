import { isPromoDelivered, DEPLOY_FAILED_PREFIX } from '../promoEligibility';

/**
 * The reported bug: a customer clicked "free 7-day trial" and was told they had
 * already used it, for a shop that never finished installing. These cases pin
 * down exactly which states forgive the used_trial flag and which do not.
 */
describe('isPromoDelivered', () => {
  describe('not delivered - eligibility must be restored', () => {
    it('cancelled shop', () => {
      expect(isPromoDelivered('cancelled', null)).toBe(false);
    });

    it('pending shop whose deploy failed', () => {
      expect(isPromoDelivered('pending', `${DEPLOY_FAILED_PREFIX} docker build timed out`)).toBe(false);
    });

    it('cancelled shop that had also failed to deploy', () => {
      expect(isPromoDelivered('cancelled', `${DEPLOY_FAILED_PREFIX} boom`)).toBe(false);
    });
  });

  describe('delivered - eligibility stays consumed', () => {
    it('active shop', () => {
      expect(isPromoDelivered('active', 'deploy ok')).toBe(true);
    });

    it('expired trial - running out is not grounds for a second one', () => {
      expect(isPromoDelivered('expired', 'deploy ok')).toBe(true);
    });

    it('suspended shop', () => {
      expect(isPromoDelivered('suspended', 'deploy ok')).toBe(true);
    });

    it('deploying shop - may still succeed, must not hand out a second trial', () => {
      expect(isPromoDelivered('deploying', 'เริ่มต้นการ deploy...')).toBe(true);
    });

    it('pending shop that is merely queued, with no failure recorded', () => {
      expect(isPromoDelivered('pending', 'เริ่มต้นการ deploy...')).toBe(true);
      expect(isPromoDelivered('pending', null)).toBe(true);
      expect(isPromoDelivered('pending', '')).toBe(true);
    });

    it('pending shop mentioning a failure anywhere but the start of the log', () => {
      // Only the log's opening verdict counts. A later line about some unrelated
      // failure must not be read as "the whole deploy failed".
      expect(isPromoDelivered('pending', `step 1 ok\n${DEPLOY_FAILED_PREFIX} nope`)).toBe(true);
    });
  });

  it('treats an unknown status as delivered, so a schema change cannot leak free trials', () => {
    expect(isPromoDelivered('some-future-status', null)).toBe(true);
    expect(isPromoDelivered(undefined, undefined)).toBe(true);
  });
});
