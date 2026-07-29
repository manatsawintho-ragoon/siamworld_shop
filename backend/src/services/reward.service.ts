import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { campaignService } from './campaign.service';
import { planBurn, isRewardVisibleAt, checkRedeemable, RedeemBlock } from './reward.logic';

export interface RewardRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  point_cost: number;
  stock: number | null;
  per_user_limit: number | null;
  command: string;
  requires_campaign_id: number | null;
  visible_from: Date | null;
  visible_until: Date | null;
  active: number;
  sort_order: number;
  deleted_at: Date | null;
  created_at: Date;
}

/** Design A11: "New" badge on recently added rewards. */
const NEW_BADGE_DAYS = 7;

const BLOCK_MESSAGES: Record<RedeemBlock, string> = {
  not_found:           'ไม่พบของรางวัลนี้',
  not_visible:         'ของรางวัลนี้ยังไม่เปิดให้แลก',
  sold_out:            'ของรางวัลนี้หมดแล้ว',
  per_user_limit:      'คุณแลกของรางวัลนี้ครบตามจำนวนที่กำหนดแล้ว',
  insufficient_points: 'point ของคุณไม่พอ',
  campaign_required:   'ของรางวัลนี้แลกได้เฉพาะช่วงแคมเปญที่กำหนดเท่านั้น',
};

const EDITABLE = [
  'name', 'description', 'image', 'point_cost', 'stock', 'per_user_limit',
  'command', 'requires_campaign_id', 'visible_from', 'visible_until', 'sort_order',
] as const;

class RewardService {
  // ─── Catalog ──────────────────────────────────────────────

  /** Everything, including hidden and soft-deleted. Admin only. */
  async getAll(): Promise<RewardRow[]> {
    const [rows] = await pool.execute<RewardRow[]>(
      'SELECT * FROM rewards WHERE deleted_at IS NULL ORDER BY sort_order ASC, id DESC'
    );
    return rows;
  }

  async getById(id: number): Promise<RewardRow | null> {
    const [rows] = await pool.execute<RewardRow[]>(
      'SELECT * FROM rewards WHERE id = ? AND deleted_at IS NULL', [id]
    );
    return rows[0] ?? null;
  }

  /**
   * The player-facing catalog. Visibility is evaluated in Node (not SQL) so it
   * stays unit-testable, matching campaign/news.
   *
   * `command` is never exposed - it is an RCON payload, and leaking it would
   * tell players exactly what the server runs.
   */
  async getCatalog(userId: number | null, now: Date = new Date()) {
    const [rows] = await pool.execute<RewardRow[]>(
      'SELECT * FROM rewards WHERE deleted_at IS NULL AND active = 1 ORDER BY sort_order ASC, id DESC'
    );
    const visible = rows.filter(r => isRewardVisibleAt(r, now));

    let redeemedByReward = new Map<number, number>();
    if (userId) {
      const [counts] = await pool.execute<RowDataPacket[]>(
        `SELECT reward_id, COUNT(*) AS n FROM reward_redemptions
         WHERE user_id = ? AND status <> 'failed' GROUP BY reward_id`,
        [userId]
      );
      redeemedByReward = new Map(counts.map(c => [Number(c.reward_id), Number(c.n)]));
    }

    const activeCampaign = await campaignService.getActiveCampaign();

    return visible.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      image: r.image,
      pointCost: Number(r.point_cost),
      stock: r.stock === null ? null : Number(r.stock),
      perUserLimit: r.per_user_limit === null ? null : Number(r.per_user_limit),
      alreadyRedeemed: redeemedByReward.get(r.id) ?? 0,
      requiresCampaignId: r.requires_campaign_id,
      campaignLocked: r.requires_campaign_id !== null && r.requires_campaign_id !== (activeCampaign?.id ?? null),
      isNew: r.created_at instanceof Date
        && !Number.isNaN(r.created_at.getTime())
        && (now.getTime() - r.created_at.getTime()) < NEW_BADGE_DAYS * 86_400_000,
    }));
  }

  // ─── Redemption ───────────────────────────────────────────

  /**
   * Spend points on a reward.
   *
   * Ordering inside the transaction is deliberate and mirrors
   * wallet.service.spend: lock the lots, verify affordability under that lock,
   * decrement stock conditionally, then burn. Nothing here calls RCON and
   * nothing refunds - delivery happens later at claim time, exactly like a
   * loot-box win, so there is no window where an RCON timeout costs a player
   * their points.
   */
  async redeem(userId: number, rewardId: number, idempotencyKey?: string | null): Promise<{
    redemptionId: number;
    inventoryId: number;
    pointsSpent: number;
    rewardName: string;
    duplicate?: boolean;
  }> {
    // Fast path for a retried request: if this key already produced a
    // redemption, return it rather than charging again.
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(idempotencyKey, userId);
      if (existing) return existing;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Design A6: banned users must not redeem. Login already refuses them,
      // but a JWT minted before the ban stays valid until it expires, so the
      // spend path has to check for itself rather than trust the token.
      const [[userRow]] = await conn.execute<RowDataPacket[]>(
        'SELECT banned_at, deleted_at FROM users WHERE id = ?', [userId]
      );
      if (!userRow) throw new NotFoundError('ไม่พบผู้ใช้นี้');
      if (userRow.banned_at || userRow.deleted_at) {
        throw new ValidationError('บัญชีนี้ถูกระงับการใช้งาน ไม่สามารถแลกของรางวัลได้');
      }

      const [rewardRows] = await conn.execute<RewardRow[]>(
        'SELECT * FROM rewards WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [rewardId]
      );
      if (rewardRows.length === 0) throw new NotFoundError(BLOCK_MESSAGES.not_found);
      const reward = rewardRows[0];
      const pointCost = Number(reward.point_cost);

      // Lock this user's spendable lots oldest-expiring-first. This is the
      // concurrency boundary: two simultaneous redeems serialise here, so the
      // second sees the balance the first already reduced.
      const [lots] = await conn.execute<RowDataPacket[]>(
        `SELECT id, points_remaining FROM point_lots
         WHERE user_id = ? AND expires_at > NOW() AND points_remaining > 0
         ORDER BY expires_at ASC, id ASC
         FOR UPDATE`,
        [userId]
      );

      // Balance must include negative clawback debt, which is excluded from the
      // burnable set above. Summing only burnable lots would let a player with
      // an outstanding debt spend as if the debt did not exist.
      const [[balRow]] = await conn.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(points_remaining), 0) AS balance FROM point_lots
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      );
      const balance = Number(balRow.balance);

      const [[redeemedRow]] = await conn.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM reward_redemptions
         WHERE user_id = ? AND reward_id = ? AND status <> 'failed'`,
        [userId, rewardId]
      );

      const activeCampaign = await campaignService.getActiveCampaign();

      const block = checkRedeemable({
        visible: isRewardVisibleAt(reward, new Date()),
        stock: reward.stock === null ? null : Number(reward.stock),
        perUserLimit: reward.per_user_limit === null ? null : Number(reward.per_user_limit),
        alreadyRedeemed: Number(redeemedRow.n),
        balance,
        pointCost,
        requiresCampaignId: reward.requires_campaign_id,
        activeCampaignId: activeCampaign?.id ?? null,
      });
      if (block) throw new ValidationError(BLOCK_MESSAGES[block]);

      const steps = planBurn(lots.map(l => ({ id: Number(l.id), points_remaining: Number(l.points_remaining) })), pointCost);
      // Unreachable if checkRedeemable passed, but a partial burn would charge
      // for an unaffordable reward, so fail loudly rather than trust that.
      if (!steps) throw new ValidationError(BLOCK_MESSAGES.insufficient_points);

      // Conditional decrement is the oversell defense: if another transaction
      // took the last unit between our SELECT and here, affectedRows is 0.
      if (reward.stock !== null) {
        const [stockRes] = await conn.execute<ResultSetHeader>(
          'UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0', [rewardId]
        );
        if (stockRes.affectedRows === 0) throw new ValidationError(BLOCK_MESSAGES.sold_out);
      }

      const [invRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO web_inventory
           (user_id, loot_box_id, loot_box_item_id, source, reward_id,
            item_name, item_image, item_command, item_rarity, status)
         VALUES (?, NULL, NULL, 'reward', ?, ?, ?, ?, 'common', 'PENDING')`,
        [userId, rewardId, reward.name, reward.image, reward.command]
      );
      const inventoryId = invRes.insertId;

      let redemptionId: number;
      try {
        const [redRes] = await conn.execute<ResultSetHeader>(
          `INSERT INTO reward_redemptions
             (user_id, reward_id, point_cost, status, inventory_id, idempotency_key)
           VALUES (?,?,?,'pending',?,?)`,
          [userId, rewardId, pointCost, inventoryId, idempotencyKey || null]
        );
        redemptionId = redRes.insertId;
      } catch (e: any) {
        // Another request with the same key won the race. Roll back this one
        // and return theirs, so a double-click never double-charges.
        if (e?.code === 'ER_DUP_ENTRY' && idempotencyKey) {
          await conn.rollback();
          const existing = await this.findByIdempotencyKey(idempotencyKey, userId);
          if (existing) return existing;
        }
        throw e;
      }

      for (const step of steps) {
        await conn.execute(
          'UPDATE point_lots SET points_remaining = points_remaining - ? WHERE id = ?',
          [step.points, step.lotId]
        );
        await conn.execute(
          'INSERT INTO point_spends (user_id, redemption_id, lot_id, points) VALUES (?,?,?,?)',
          [userId, redemptionId, step.lotId, step.points]
        );
      }

      await conn.commit();
      logger.info('Reward redeemed', { userId, rewardId, redemptionId, pointCost });
      return { redemptionId, inventoryId, pointsSpent: pointCost, rewardName: reward.name };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  private async findByIdempotencyKey(key: string, userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rr.id, rr.inventory_id, rr.point_cost, r.name
       FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
       WHERE rr.idempotency_key = ? AND rr.user_id = ?`,
      [key, userId]
    );
    if (rows.length === 0) return null;
    return {
      redemptionId: Number(rows[0].id),
      inventoryId: Number(rows[0].inventory_id),
      pointsSpent: Number(rows[0].point_cost),
      rewardName: String(rows[0].name),
      duplicate: true,
    };
  }

  /** A player's own redemption history. */
  async getUserRedemptions(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rr.id, rr.point_cost, rr.status, rr.created_at,
              r.name AS reward_name, r.image AS reward_image,
              wi.status AS inventory_status
       FROM reward_redemptions rr
       JOIN rewards r ON r.id = rr.reward_id
       LEFT JOIN web_inventory wi ON wi.id = rr.inventory_id
       WHERE rr.user_id = ?
       ORDER BY rr.created_at DESC LIMIT 100`,
      [userId]
    );
    return rows;
  }

  /** Admin redemption log across all players. */
  async getAllRedemptions(limit = 200) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rr.id, rr.user_id, rr.point_cost, rr.status, rr.created_at,
              u.username, r.name AS reward_name,
              wi.status AS inventory_status, wi.id AS inventory_id
       FROM reward_redemptions rr
       JOIN users u ON u.id = rr.user_id
       JOIN rewards r ON r.id = rr.reward_id
       LEFT JOIN web_inventory wi ON wi.id = rr.inventory_id
       ORDER BY rr.created_at DESC LIMIT ?`,
      [String(limit)]
    );
    return rows;
  }

  // ─── Admin CRUD ───────────────────────────────────────────

  async create(data: Record<string, any>): Promise<RewardRow | null> {
    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO rewards
         (name, description, image, point_cost, stock, per_user_limit, command,
          requires_campaign_id, visible_from, visible_until, active, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.name, data.description ?? null, data.image ?? null,
        data.point_cost, data.stock ?? null, data.per_user_limit ?? null,
        data.command, data.requires_campaign_id ?? null,
        data.visible_from ?? null, data.visible_until ?? null,
        data.active === undefined ? 1 : (data.active ? 1 : 0),
        data.sort_order ?? 0,
      ]
    );
    return this.getById(res.insertId);
  }

  async update(id: number, data: Record<string, any>): Promise<RewardRow | null> {
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of EDITABLE) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
    }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE rewards SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.getById(id);
  }

  /** Soft-delete: pending redemptions and issued inventory must survive. */
  async remove(id: number): Promise<void> {
    await pool.execute('UPDATE rewards SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  async reorder(order: { id: number; sort_order: number }[]): Promise<void> {
    for (const item of order) {
      await pool.execute('UPDATE rewards SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
  }

  /**
   * Outstanding point liability and redemption stats - design A10 calls the
   * liability out as the headline number an owner must see.
   */
  async getStats(): Promise<Record<string, number>> {
    const [[out]] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(points_remaining),0) AS v FROM point_lots WHERE expires_at > NOW()'
    );
    const [[spent]] = await pool.execute<RowDataPacket[]>(
      "SELECT COALESCE(SUM(point_cost),0) AS v FROM reward_redemptions WHERE status <> 'failed'"
    );
    const [[count]] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS v FROM reward_redemptions WHERE status <> 'failed'"
    );
    const [[pending]] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS v FROM reward_redemptions rr
       JOIN web_inventory wi ON wi.id = rr.inventory_id
       WHERE wi.status = 'PENDING'`
    );
    return {
      outstandingPoints: Number(out.v),
      pointsSpent: Number(spent.v),
      redemptions: Number(count.v),
      pendingClaims: Number(pending.v),
    };
  }
}

export const rewardService = new RewardService();
