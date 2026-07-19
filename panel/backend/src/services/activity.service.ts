import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';
import { IncomingEvent, sanitizeEvents } from '../utils/activity-events';

/**
 * Behavioural activity tracking for the panel. Telemetry rows live in the existing
 * `audit_logs` table under `category = 'activity'` (page views + tagged feature clicks),
 * kept separate from the accountability rows (`category = 'action'`) so the audit view
 * stays clean and retention can prune telemetry independently.
 *
 * Pure validation/normalization lives in ../utils/activity-events (unit tested there).
 */
export const activityService = {
  /**
   * Best-effort bulk insert of telemetry rows. Never throws to the caller — losing a
   * batch of analytics events must never break the user's request.
   */
  async recordEvents(userId: number, ip: string | undefined, events: IncomingEvent[]): Promise<number> {
    try {
      const rows = sanitizeEvents(events);
      if (rows.length === 0) return 0;
      const values = rows.map((r) => [userId, r.action, 'activity', r.details, ip || null]);
      await pool.query(
        'INSERT INTO audit_logs (user_id, action, category, details, ip_address) VALUES ?',
        [values]
      );
      return rows.length;
    } catch (e) {
      logger.error('Failed to record activity:', e);
      return 0;
    }
  },

  /**
   * Aggregated usage hotspots over a date window. `userId` optionally scopes to one
   * customer. Returns top pages, top features, and headline totals.
   */
  async getHotspots(opts: { from?: string; to?: string; userId?: number; limit?: number }) {
    const limit = Math.min(Math.max(opts.limit || 20, 1), 100);
    const where: string[] = [`category = 'activity'`];
    const params: any[] = [];
    if (opts.from) { where.push('created_at >= ?'); params.push(opts.from); }
    if (opts.to)   { where.push('created_at <= ?'); params.push(opts.to); }
    if (opts.userId) { where.push('user_id = ?'); params.push(opts.userId); }
    const whereSql = where.join(' AND ');

    const [pages] = await pool.execute<RowDataPacket[]>(
      `SELECT details AS path, COUNT(*) AS views, COUNT(DISTINCT user_id) AS users
         FROM audit_logs
        WHERE ${whereSql} AND action = 'page_view'
        GROUP BY details
        ORDER BY views DESC
        LIMIT ${limit}`,
      params
    );

    const [features] = await pool.execute<RowDataPacket[]>(
      `SELECT details AS feature, COUNT(*) AS clicks, COUNT(DISTINCT user_id) AS users
         FROM audit_logs
        WHERE ${whereSql} AND action = 'feature_click'
        GROUP BY details
        ORDER BY clicks DESC
        LIMIT ${limit}`,
      params
    );

    const [totals] = await pool.execute<RowDataPacket[]>(
      `SELECT
          SUM(action = 'page_view')     AS total_views,
          SUM(action = 'feature_click') AS total_clicks,
          COUNT(DISTINCT user_id)       AS active_users
         FROM audit_logs
        WHERE ${whereSql}`,
      params
    );

    return {
      pages,
      features,
      totals: {
        totalViews: Number(totals[0]?.total_views || 0),
        totalClicks: Number(totals[0]?.total_clicks || 0),
        activeUsers: Number(totals[0]?.active_users || 0),
      },
    };
  },

  /** Delete telemetry rows older than `days`. Accountability rows are untouched. */
  async pruneActivity(days = 90): Promise<number> {
    const [res]: any = await pool.execute(
      `DELETE FROM audit_logs WHERE category = 'activity' AND created_at < (NOW() - INTERVAL ? DAY)`,
      [days]
    );
    return res?.affectedRows || 0;
  },
};
