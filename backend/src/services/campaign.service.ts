/**
 * Campaign point ledger (DB layer).
 *
 * Decision logic lives in campaign.logic.ts; this file only talks to MySQL.
 *
 * INVARIANT: points never touch `wallets` or `transactions`. This service is
 * called AFTER a payment has committed and its failure must never propagate
 * back into the payment flow - see grantForTopup's contract below.
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  CampaignRule, selectCampaignAt, computeGrant, computeExpiry, planClawback,
} from './campaign.logic';

export interface PointLotRow extends RowDataPacket {
  id: number;
  campaign_id: number | null;
  points_granted: number;
  points_remaining: number;
  qualified_at: Date;
  expires_at: Date;
  reason: string | null;
}

const CAMPAIGN_COLS = `
  id, points_per_baht, min_topup_amount, starts_at, ends_at,
  daily_start_time, daily_end_time, weekday_mask,
  max_points_per_user, max_points_budget, points_expire_days,
  paused, active, deleted_at
`;

/** MySQL returns DECIMAL as string; normalize into the numeric shape logic expects. */
function toRule(r: RowDataPacket): CampaignRule {
  return {
    id: r.id,
    points_per_baht: parseFloat(r.points_per_baht),
    min_topup_amount: parseFloat(r.min_topup_amount),
    starts_at: new Date(r.starts_at),
    ends_at: new Date(r.ends_at),
    daily_start_time: r.daily_start_time,
    daily_end_time: r.daily_end_time,
    weekday_mask: r.weekday_mask,
    max_points_per_user: r.max_points_per_user,
    max_points_budget: r.max_points_budget,
    points_expire_days: r.points_expire_days,
    paused: r.paused,
    active: r.active,
    deleted_at: r.deleted_at ? new Date(r.deleted_at) : null,
  };
}

class CampaignService {
  /** Campaigns whose absolute range could contain `when`. Masks are applied in logic. */
  private async candidatesAt(when: Date): Promise<CampaignRule[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${CAMPAIGN_COLS} FROM campaigns
       WHERE deleted_at IS NULL AND active = 1 AND paused = 0
         AND starts_at <= ? AND ends_at >= ?`,
      [when, when]
    );
    return rows.map(toRule);
  }

  /** The campaign granting points right now, or null. Used by the UI banner too. */
  async getActiveCampaign(when: Date = new Date()): Promise<CampaignRule | null> {
    return selectCampaignAt(await this.candidatesAt(when), when);
  }

  /**
   * Grant campaign points for a completed top-up.
   *
   * CONTRACT: callers invoke this AFTER their payment transaction has committed,
   * wrapped in try/catch. It must never be called inside the payment transaction
   * - a points failure must not be able to roll back real money.
   *
   * Idempotency is enforced by UNIQUE(source_transaction_id, campaign_id): a
   * retried call for the same transaction is swallowed, not double-granted.
   */
  async grantForTopup(args: {
    userId: number; transactionId: number; amountBaht: number; qualifiedAt: Date;
  }): Promise<{ granted: number; campaignId: number | null }> {
    const { userId, transactionId, amountBaht, qualifiedAt } = args;

    const campaign = await this.getActiveCampaign(qualifiedAt);
    if (!campaign) return { granted: 0, campaignId: null };

    const [[userAgg]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points_granted), 0) AS total FROM point_lots
       WHERE user_id = ? AND campaign_id = ? AND points_granted > 0`,
      [userId, campaign.id]
    ) as unknown as [RowDataPacket[], unknown];

    const [[campAgg]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points_granted), 0) AS total FROM point_lots
       WHERE campaign_id = ? AND points_granted > 0`,
      [campaign.id]
    ) as unknown as [RowDataPacket[], unknown];

    const { points, capped } = computeGrant({
      amountBaht,
      campaign,
      userAlreadyGranted: Number(userAgg.total),
      campaignAlreadyGranted: Number(campAgg.total),
    });

    if (points <= 0) return { granted: 0, campaignId: campaign.id };

    try {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO point_lots
           (user_id, campaign_id, points_granted, points_remaining,
            rate_applied, qualified_at, expires_at, source_transaction_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          userId, campaign.id, points, points,
          campaign.points_per_baht, qualifiedAt, computeExpiry(campaign), transactionId,
        ]
      );
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        // Already granted for this transaction (retry or reconciler race). Not an error.
        return { granted: 0, campaignId: campaign.id };
      }
      throw e;
    }

    if (capped !== 'none') {
      logger.info('Campaign grant was capped', { userId, campaignId: campaign.id, capped, points });
    }
    return { granted: points, campaignId: campaign.id };
  }

  /**
   * Reverse the points granted for a top-up that was refunded or reversed.
   * Safe to call for transactions that never earned points.
   */
  async revokeForTransaction(transactionId: number): Promise<{ revoked: number; debt: number }> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [lots] = await conn.execute<RowDataPacket[]>(
        `SELECT id, user_id, campaign_id, points_granted, points_remaining
         FROM point_lots WHERE source_transaction_id = ? AND revoked_at IS NULL FOR UPDATE`,
        [transactionId]
      );
      if (lots.length === 0) { await conn.commit(); return { revoked: 0, debt: 0 }; }

      let revoked = 0;
      let debt = 0;

      for (const lot of lots) {
        const plan = planClawback(lot as any);

        // Stamp every selected lot as revoked, whether or not points_remaining
        // changed - a fully-spent lot (reduce=0, debt>0) must never be
        // re-selected by a retried or duplicate revoke call.
        if (plan.reduceRemainingBy > 0) {
          await conn.execute(
            'UPDATE point_lots SET points_remaining = points_remaining - ?, revoked_at = NOW() WHERE id = ?',
            [plan.reduceRemainingBy, lot.id]
          );
          revoked += plan.reduceRemainingBy;
        } else {
          await conn.execute(
            'UPDATE point_lots SET revoked_at = NOW() WHERE id = ?',
            [lot.id]
          );
        }
        if (plan.debtToRecord > 0) {
          // Debt never expires, so it cannot be waited out.
          await conn.execute(
            `INSERT INTO point_lots
               (user_id, campaign_id, points_granted, points_remaining,
                qualified_at, expires_at, reason)
             VALUES (?,?,?,?, NOW(), '2099-12-31 23:59:59', ?)`,
            [lot.user_id, lot.campaign_id, -plan.debtToRecord, -plan.debtToRecord,
             `clawback: transaction ${transactionId} reversed`]
          );
          debt += plan.debtToRecord;
        }
      }

      await conn.commit();
      logger.info('Campaign points revoked', { transactionId, revoked, debt });
      return { revoked, debt };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /** Spendable balance: unexpired lots only, including negative clawback debt. */
  async getBalance(userId: number): Promise<number> {
    const [[row]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points_remaining), 0) AS balance FROM point_lots
       WHERE user_id = ? AND expires_at > NOW()`,
      [userId]
    ) as unknown as [RowDataPacket[], unknown];
    return Number(row.balance);
  }

  /** Unexpired lots, soonest-expiring first, for the player's points page. */
  async getLots(userId: number): Promise<PointLotRow[]> {
    const [rows] = await pool.execute<PointLotRow[]>(
      `SELECT id, campaign_id, points_granted, points_remaining,
              qualified_at, expires_at, reason
       FROM point_lots
       WHERE user_id = ? AND expires_at > NOW() AND points_remaining != 0
       ORDER BY expires_at ASC`,
      [userId]
    );
    return rows;
  }

  // ─── Admin CRUD ──────────────────────────────────────────────

  /** Every campaign including paused and soft-deleted, newest first. */
  async listAll(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*,
              COALESCE((SELECT SUM(points_granted) FROM point_lots
                        WHERE campaign_id = c.id AND points_granted > 0), 0) AS points_issued,
              COALESCE((SELECT COUNT(DISTINCT user_id) FROM point_lots
                        WHERE campaign_id = c.id AND points_granted > 0), 0) AS participants
       FROM campaigns c
       WHERE c.deleted_at IS NULL
       ORDER BY c.starts_at DESC`
    );
    return rows;
  }

  async create(d: any): Promise<number> {
    const [r] = await pool.execute<ResultSetHeader>(
      `INSERT INTO campaigns
         (name, description, banner_image, points_per_baht, min_topup_amount,
          starts_at, ends_at, daily_start_time, daily_end_time, weekday_mask,
          max_points_per_user, max_points_budget, points_expire_days, paused, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.name, d.description ?? null, d.bannerImage ?? null, d.pointsPerBaht,
       d.minTopupAmount, d.startsAt, d.endsAt, d.dailyStartTime ?? null,
       d.dailyEndTime ?? null, d.weekdayMask ?? null, d.maxPointsPerUser ?? null,
       d.maxPointsBudget ?? null, d.pointsExpireDays, d.paused ? 1 : 0, d.active ? 1 : 0]
    );
    return r.insertId;
  }

  /**
   * Edits apply FORWARD ONLY. Already-issued lots keep their points, their
   * rate_applied and their expires_at - this method never touches point_lots.
   */
  async update(id: number, d: any): Promise<void> {
    await pool.execute(
      `UPDATE campaigns SET
         name=?, description=?, banner_image=?, points_per_baht=?, min_topup_amount=?,
         starts_at=?, ends_at=?, daily_start_time=?, daily_end_time=?, weekday_mask=?,
         max_points_per_user=?, max_points_budget=?, points_expire_days=?, paused=?, active=?
       WHERE id=?`,
      [d.name, d.description ?? null, d.bannerImage ?? null, d.pointsPerBaht,
       d.minTopupAmount, d.startsAt, d.endsAt, d.dailyStartTime ?? null,
       d.dailyEndTime ?? null, d.weekdayMask ?? null, d.maxPointsPerUser ?? null,
       d.maxPointsBudget ?? null, d.pointsExpireDays, d.paused ? 1 : 0,
       d.active ? 1 : 0, id]
    );
  }

  /** Soft-delete. Issued lots survive and stay spendable. */
  async softDelete(id: number): Promise<void> {
    await pool.execute('UPDATE campaigns SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  /** Dashboard figures for one campaign, including outstanding liability. */
  async stats(id: number): Promise<Record<string, number>> {
    const [[row]] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN points_granted > 0 THEN points_granted END), 0) AS issued,
         COALESCE(SUM(CASE WHEN points_granted > 0 AND expires_at > NOW()
                           THEN points_remaining END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN points_granted > 0 AND expires_at <= NOW()
                           THEN points_remaining END), 0) AS expired_unspent,
         COUNT(DISTINCT user_id) AS participants
       FROM point_lots WHERE campaign_id = ?`,
      [id]
    ) as unknown as [RowDataPacket[], unknown];
    const issued = Number(row.issued);
    return {
      issued,
      outstanding: Number(row.outstanding),
      expiredUnspent: Number(row.expired_unspent),
      participants: Number(row.participants),
      redeemed: issued - Number(row.outstanding) - Number(row.expired_unspent),
    };
  }

  /** Manual admin adjustment. Positive grants, negative deducts. Reason is mandatory. */
  async grantManual(userId: number, points: number, reason: string, expireDays: number): Promise<void> {
    const expiresAt = new Date(Date.now() + expireDays * 86_400_000);
    await pool.execute(
      `INSERT INTO point_lots
         (user_id, campaign_id, points_granted, points_remaining,
          qualified_at, expires_at, reason)
       VALUES (?, NULL, ?, ?, NOW(), ?, ?)`,
      [userId, points, points, expiresAt, reason]
    );
  }
}

export const campaignService = new CampaignService();
