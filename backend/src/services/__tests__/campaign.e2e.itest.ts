/**
 * TEMPORARY end-to-end verification against a throwaway MySQL.
 * Not part of the normal suite (filename ends .itest.ts, jest matches *.test.ts).
 * Run explicitly:  npx jest --testMatch='**\/*.itest.ts'
 */
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '13306';
process.env.MYSQL_USER = 'root';
process.env.MYSQL_PASSWORD = 'testpw';
process.env.MYSQL_DATABASE = 'siamtest';

describe('campaign engine against a real database', () => {
  let pool: any;
  let campaignService: any;

  beforeAll(async () => {
    ({ pool } = await import('../../database/connection'));
    ({ campaignService } = await import('../campaign.service'));
    await pool.execute('DELETE FROM point_lots');
    await pool.execute('DELETE FROM campaigns');
    await pool.execute(
      `INSERT INTO campaigns (id, name, points_per_baht, min_topup_amount,
         starts_at, ends_at, points_expire_days)
       VALUES (1, 'E2E', 0.1000, 50, DATE_SUB(NOW(), INTERVAL 1 DAY),
               DATE_ADD(NOW(), INTERVAL 1 DAY), 30)`
    );
  });

  afterAll(async () => { await pool.end(); });

  it('grants floor(amount * rate) for an in-window top-up', async () => {
    const r = await campaignService.grantForTopup({
      userId: 7, transactionId: 1001, amountBaht: 500, qualifiedAt: new Date(),
    });
    expect(r.granted).toBe(50);
    expect(await campaignService.getBalance(7)).toBe(50);
  });

  it('is idempotent: a retried grant for the same transaction adds nothing', async () => {
    const r = await campaignService.grantForTopup({
      userId: 7, transactionId: 1001, amountBaht: 500, qualifiedAt: new Date(),
    });
    expect(r.granted).toBe(0);
    expect(await campaignService.getBalance(7)).toBe(50);
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS n FROM point_lots WHERE source_transaction_id = 1001'
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it('grants nothing below min_topup_amount', async () => {
    const r = await campaignService.grantForTopup({
      userId: 8, transactionId: 1002, amountBaht: 40, qualifiedAt: new Date(),
    });
    expect(r.granted).toBe(0);
    expect(await campaignService.getBalance(8)).toBe(0);
  });

  it('grants nothing for a top-up outside the window', async () => {
    const r = await campaignService.grantForTopup({
      userId: 9, transactionId: 1003, amountBaht: 500,
      qualifiedAt: new Date('2020-01-01T00:00:00Z'),
    });
    expect(r.granted).toBe(0);
    expect(r.campaignId).toBeNull();
  });

  it('clawback: reverses unspent points and records debt for spent ones', async () => {
    // Player spent 40 of the 50: remaining 10.
    await pool.execute(
      'UPDATE point_lots SET points_remaining = 10 WHERE source_transaction_id = 1001'
    );
    expect(await campaignService.getBalance(7)).toBe(10);

    const r = await campaignService.revokeForTransaction(1001);
    expect(r.revoked).toBe(10);   // the 10 still unspent
    expect(r.debt).toBe(40);      // the 40 already spent becomes debt

    // Net position: owes 40.
    expect(await campaignService.getBalance(7)).toBe(-40);
  });

  it('clawback is idempotent: a second reversal does NOT double-penalise', async () => {
    const r = await campaignService.revokeForTransaction(1001);
    expect(r.revoked).toBe(0);
    expect(r.debt).toBe(0);
    // Still -40, NOT -80.
    expect(await campaignService.getBalance(7)).toBe(-40);
  });

  it('THROWS when the points tables are missing, so the payment path must catch', async () => {
    // The money path must never be blocked by the points path. payment.service
    // wraps every grant in try/catch precisely because this call can throw.
    // Proving it really does throw is what makes that wrapper load-bearing
    // rather than decorative.
    await pool.execute('RENAME TABLE point_lots TO point_lots_hidden');
    try {
      await expect(campaignService.grantForTopup({
        userId: 11, transactionId: 1004, amountBaht: 500, qualifiedAt: new Date(),
      })).rejects.toThrow();
    } finally {
      await pool.execute('RENAME TABLE point_lots_hidden TO point_lots');
    }
  });

  it('stats separate genuine redemption from clawback', async () => {
    const s = await campaignService.stats(1);
    expect(s.issued).toBe(50);        // originally granted
    expect(s.redeemed).toBe(40);      // genuinely spent by the player
    expect(s.clawedBack).toBe(50);    // whole grant reversed
    expect(s.outstanding).toBe(-40);  // true net liability
  });
});
