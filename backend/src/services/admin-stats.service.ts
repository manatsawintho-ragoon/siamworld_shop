import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';

class AdminStatsService {
  async getDashboardStats() {
    // `is_test = 0` throughout: an admin buying their own item to confirm the
    // RCON command delivers it in-game is a test, not a sale, and must not move
    // any number on this page. The flag is stamped at purchase time (see
    // services/test-purchase.ts) rather than derived from users.role here, so
    // changing someone's role never rewrites revenue history.
    //
    // Admin TOP-UPS are deliberately NOT excluded - a self-credit still counts
    // as income, matching migration 037.
    const queries = {
      revenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered' AND is_test=0",
      topups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success'",
      lootboxRevenue: "SELECT COALESCE(SUM(ABS(amount)),0) as v FROM transactions WHERE type='purchase' AND status='success' AND is_test=0 AND description LIKE 'เปิดกล่อง%'",
      users: 'SELECT COUNT(*) as v FROM users',
      activeProducts: 'SELECT COUNT(*) as v FROM products WHERE active=1',
      totalPurchases: "SELECT COALESCE(SUM(quantity),0) as v FROM purchases WHERE status='delivered' AND is_test=0",
      delivered: "SELECT COALESCE(SUM(quantity),0) as v FROM purchases WHERE status='delivered' AND is_test=0",
      failed: "SELECT COUNT(*) as v FROM purchases WHERE status='failed' AND is_test=0",
      pending: "SELECT COUNT(*) as v FROM purchases WHERE status='pending' AND is_test=0",
      refunded: "SELECT COUNT(*) as v FROM purchases WHERE status='refunded' AND is_test=0",
      todayRevenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered' AND is_test=0 AND DATE(created_at)=CURDATE()",
      todayTopups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success' AND DATE(created_at)=CURDATE()",
      todayUsers: 'SELECT COUNT(*) as v FROM users WHERE DATE(created_at)=CURDATE()',
      monthNewUsers: 'SELECT COUNT(*) as v FROM users WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())',
      // Scoped to actual loot-box opens: reward-shop redemptions also land in
      // web_inventory (source='reward', loot_box_id NULL) and were being counted
      // here as box opens.
      totalLootboxOpened: 'SELECT COUNT(*) as v FROM web_inventory WHERE is_test=0 AND loot_box_id IS NOT NULL',
      totalRedeemUsed: 'SELECT COUNT(*) as v FROM redeem_logs',
      activeRedeemCodes: "SELECT COUNT(*) as v FROM redeem_codes WHERE active=1",
      todayPurchases: "SELECT COALESCE(SUM(quantity),0) as v FROM purchases WHERE status='delivered' AND is_test=0 AND DATE(created_at)=CURDATE()",
      monthRevenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered' AND is_test=0 AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())",
      monthTopups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())",
    };

    // Run the scalar aggregates concurrently instead of ~21 serial round trips.
    // They are independent single-value reads, so the pool executes them in
    // parallel and total latency drops to roughly the slowest single query.
    const results: Record<string, number> = {};
    await Promise.all(
      Object.entries(queries).map(async ([key, sql]) => {
        const [rows] = await pool.execute<RowDataPacket[]>(sql);
        results[key] = parseFloat(rows[0].v) || 0;
      })
    );

    // Top products
    const [topProducts] = await pool.execute<RowDataPacket[]>(
      `SELECT pr.name, pr.image, COALESCE(SUM(p.quantity),0) as purchase_count, SUM(p.price) as total_revenue
       FROM purchases p LEFT JOIN products pr ON p.product_id = pr.id
       WHERE p.status='delivered' AND p.is_test=0 AND pr.id IS NOT NULL
       GROUP BY pr.id, pr.name, pr.image ORDER BY purchase_count DESC LIMIT 5`
    );

    // Top loot boxes. loot_box_id IS NOT NULL keeps reward-shop redemptions,
    // which share this table, out of the box ranking.
    const [topLootBoxes] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(lb.name, '(ลบแล้ว)') as name, lb.image, COUNT(*) as open_count, SUM(lb.price) as total_revenue
       FROM web_inventory wi LEFT JOIN loot_boxes lb ON wi.loot_box_id = lb.id
       WHERE wi.is_test=0 AND wi.loot_box_id IS NOT NULL
       GROUP BY wi.loot_box_id, lb.name, lb.image ORDER BY open_count DESC LIMIT 5`
    );

    // Recent purchases (shop only). Test buys are hidden here on purpose - they
    // live on /admin/purchases, which owns rcon_response and is where the owner
    // actually confirms a test delivery worked.
    const [recentPurchases] = await pool.execute<RowDataPacket[]>(
      `SELECT p.id, p.price, p.quantity, p.status, p.created_at, u.username, COALESCE(pr.name, '(ลบแล้ว)') as product_name, s.name as server_name
       FROM purchases p JOIN users u ON p.user_id = u.id LEFT JOIN products pr ON p.product_id = pr.id
       JOIN servers s ON p.server_id = s.id WHERE p.is_test=0 ORDER BY p.created_at DESC LIMIT 10`
    );

    // Recent transactions (all types: topup, lootbox, shop purchase)
    const [recentTransactions] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.type, t.amount, t.description, t.status, t.created_at, u.username
       FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE t.status = 'success' AND t.is_test = 0
       ORDER BY t.created_at DESC LIMIT 15`
    );

    // Topup rankings
    const rankingBase = `SELECT u.username, SUM(t.amount) as total_amount, COUNT(*) as tx_count
       FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE t.type = 'topup' AND t.status = 'success'`;

    const [topupRankAlltime] = await pool.execute<RowDataPacket[]>(
      `${rankingBase} GROUP BY t.user_id, u.username ORDER BY total_amount DESC LIMIT 5`
    );
    const [topupRankMonth] = await pool.execute<RowDataPacket[]>(
      `${rankingBase} AND MONTH(t.created_at)=MONTH(CURDATE()) AND YEAR(t.created_at)=YEAR(CURDATE())
       GROUP BY t.user_id, u.username ORDER BY total_amount DESC LIMIT 5`
    );
    const [topupRankToday] = await pool.execute<RowDataPacket[]>(
      `${rankingBase} AND DATE(t.created_at)=CURDATE()
       GROUP BY t.user_id, u.username ORDER BY total_amount DESC LIMIT 5`
    );

    // Recent topup transactions for the "เติมล่าสุด" card
    const [recentTopups] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.amount, t.method, t.description, t.created_at, u.username
       FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE t.type='topup' AND t.status='success'
       ORDER BY t.created_at DESC LIMIT 5`
    );

    // Recently registered users (with IP from authme)
    const [recentUsers] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.role, u.created_at, a.ip, a.regip
       FROM users u LEFT JOIN authme a ON LOWER(u.username) = LOWER(a.username)
       ORDER BY u.created_at DESC LIMIT 10`
    );

    // The daily/weekly/monthly series used to be built here and shipped with
    // every dashboard load. They now live behind GET /admin/stats/series so the
    // first paint carries less, and so the range presets (7/30/90d) can grow
    // without growing this payload. See buildSeries() below.


    // ── Month-over-month comparison (this calendar month vs all of last month) ──
    // Each metric returns { thisMonth, lastMonth, delta, pct }. Scan is bounded to
    // created_at >= last-month-start so it stays index-friendly. pct guards against
    // divide-by-zero: no baseline + activity => +100%, no baseline + nothing => 0%.
    const TS = "DATE_FORMAT(CURDATE(),'%Y-%m-01')";                       // this-month start
    const LS = "DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH,'%Y-%m-01')";    // last-month start
    const cmpSql = (table: string, expr: string, where: string, dateCol = 'created_at') => `
      SELECT
        COALESCE(SUM(CASE WHEN ${dateCol} >= ${TS} THEN ${expr} END),0) AS this_month,
        COALESCE(SUM(CASE WHEN ${dateCol} >= ${LS} AND ${dateCol} < ${TS} THEN ${expr} END),0) AS last_month
      FROM ${table}
      WHERE ${where ? where + ' AND ' : ''}${dateCol} >= ${LS}`;

    const compareDefs: Record<string, string> = {
      topups:        cmpSql('transactions', 'amount',      "type='topup' AND status='success'"),
      itemRevenue:   cmpSql('purchases',    'price',       "status='delivered' AND is_test=0"),
      gachaRevenue:  cmpSql('transactions', 'ABS(amount)', "type='purchase' AND status='success' AND is_test=0 AND description LIKE 'เปิดกล่อง%'"),
      newUsers:      cmpSql('users',        '1',           ''),
      itemsSold:     cmpSql('purchases',    'quantity',    "status='delivered' AND is_test=0"),
      lootboxOpened: cmpSql('web_inventory','1',           'is_test=0 AND loot_box_id IS NOT NULL', 'won_at'),
      redeemUsed:    cmpSql('redeem_logs',  '1',           '', 'redeemed_at'),
    };

    // Spent = item + gacha. Previously scoped with `u.role != 'admin'`, which
    // meant promoting a player to admin silently erased everything they had ever
    // spent. is_test is stamped at purchase time, so it says the same thing
    // without rewriting history - and it drops the users join.
    const spentSql = `
      SELECT
        COALESCE(SUM(CASE WHEN x.dt >= ${TS} THEN x.amt END),0) AS this_month,
        COALESCE(SUM(CASE WHEN x.dt >= ${LS} AND x.dt < ${TS} THEN x.amt END),0) AS last_month
      FROM (
        SELECT p.price AS amt, p.created_at AS dt
          FROM purchases p
          WHERE p.status='delivered' AND p.is_test=0 AND p.created_at >= ${LS}
        UNION ALL
        SELECT ABS(t.amount) AS amt, t.created_at AS dt
          FROM transactions t
          WHERE t.type='purchase' AND t.status='success' AND t.is_test=0
            AND t.description LIKE 'เปิดกล่อง%' AND t.created_at >= ${LS}
      ) x`;

    const buildCmp = (thisRaw: unknown, lastRaw: unknown) => {
      const t = Number(thisRaw) || 0;
      const l = Number(lastRaw) || 0;
      const delta = Math.round((t - l) * 100) / 100;
      const pct = l > 0 ? Math.round((delta / l) * 1000) / 10 : (t > 0 ? 100 : 0);
      return { thisMonth: t, lastMonth: l, delta, pct };
    };

    const comparison: Record<string, ReturnType<typeof buildCmp>> = {};
    await Promise.all([
      ...Object.entries(compareDefs).map(async ([key, sql]) => {
        const [rows] = await pool.execute<RowDataPacket[]>(sql);
        comparison[key] = buildCmp(rows[0].this_month, rows[0].last_month);
      }),
      (async () => {
        const [spentRows] = await pool.execute<RowDataPacket[]>(spentSql);
        comparison.spent = buildCmp(spentRows[0].this_month, spentRows[0].last_month);
      })(),
    ]);

    // Activity feed (union of recent activities)
    const [activityFeed] = await pool.execute<RowDataPacket[]>(
      `(SELECT 'purchase' as activity_type, u.username, COALESCE(pr.name, '(ลบแล้ว)') as detail, p.price as amount, p.created_at
        FROM purchases p JOIN users u ON p.user_id = u.id LEFT JOIN products pr ON p.product_id = pr.id
        WHERE p.status='delivered' AND p.is_test=0 ORDER BY p.created_at DESC LIMIT 5)
       UNION ALL
       (SELECT 'topup' as activity_type, u.username, t.method as detail, t.amount, t.created_at
        FROM transactions t JOIN users u ON t.user_id = u.id
        WHERE t.type='topup' AND t.status='success' ORDER BY t.created_at DESC LIMIT 5)
       UNION ALL
       (SELECT 'redeem' as activity_type, u.username, rc.code as detail, COALESCE(rc.point_amount,0) as amount, rl.redeemed_at as created_at
        FROM redeem_logs rl JOIN users u ON rl.user_id = u.id JOIN redeem_codes rc ON rl.code_id = rc.id
        ORDER BY rl.redeemed_at DESC LIMIT 5)
       UNION ALL
       (SELECT 'gacha' as activity_type, u.username, wi.item_name as detail, 0 as amount, wi.won_at as created_at
        FROM web_inventory wi JOIN users u ON wi.user_id = u.id
        WHERE wi.is_test=0 ORDER BY wi.won_at DESC LIMIT 5)
       ORDER BY created_at DESC LIMIT 15`
    );


    return {
      totalRevenue: results.revenue,
      totalTopups: results.topups,
      totalLootboxRevenue: results.lootboxRevenue,
      totalUsers: results.users,
      activeProducts: results.activeProducts,
      totalPurchases: results.totalPurchases,
      deliveredPurchases: results.delivered,
      failedPurchases: results.failed,
      pendingPurchases: results.pending,
      refundedPurchases: results.refunded,
      todayRevenue: results.todayRevenue,
      todayTopups: results.todayTopups,
      todayNewUsers: results.todayUsers,
      monthNewUsers: results.monthNewUsers,
      totalLootboxOpened: results.totalLootboxOpened,
      totalRedeemUsed: results.totalRedeemUsed,
      activeRedeemCodes: results.activeRedeemCodes,
      todayPurchases: results.todayPurchases,
      monthRevenue: results.monthRevenue,
      monthTopups: results.monthTopups,
      topProducts,
      topLootBoxes,
      recentPurchases,
      recentTransactions,
      recentTopups,
      recentUsers,
      topupRankAlltime,
      topupRankMonth,
      topupRankToday,
      activityFeed,
      comparison,
    };
  }

  async getFinancialSummary() {
    const [[outstanding]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(w.balance), 0) AS total
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE u.role != 'admin'`
    );
    // Spend is scoped by is_test, not by the buyer's current role: role-based
    // scoping made a player's entire spending history disappear the moment they
    // were promoted. `totalOutstanding` above still reads role, correctly - it
    // is a snapshot of who holds a balance right now, not a historical total.
    const [[itemSpend]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(p.price), 0) AS total
       FROM purchases p
       WHERE p.status = 'delivered' AND p.is_test = 0`
    );
    const [[gachaSpend]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
       FROM transactions t
       WHERE t.type = 'purchase' AND t.status = 'success' AND t.is_test = 0
         AND t.description LIKE 'เปิดกล่อง%'`
    );
    return {
      totalOutstanding: Number(outstanding.total || 0),
      totalSpent: Number(itemSpend.total || 0) + Number(gachaSpend.total || 0),
    };
  }

  /**
   * Timeline series for the dashboard chart.
   *
   * Replaces three hardcoded series that used to ride along with every
   * getDashboardStats() call and built their calendar spine as an inline
   * `SELECT 0 n UNION SELECT 1 UNION ...` - 30 terms for a month, and it would
   * have needed 90 for a quarter. Here each metric is one ordinary grouped
   * query and the spine is filled in TypeScript.
   *
   * TIMEZONE: "today" comes from MySQL's CURDATE(), not the Node clock. The app
   * container and the database can disagree about the date (different TZ, or
   * simply either side of midnight), and a spine anchored to the wrong one
   * silently drops today's bucket off the end of the chart. Bucketing itself
   * stays on MySQL DATE()/week/month in the database's own timezone, which is
   * what every other query on this page already uses.
   */
  async getSeries(range: SeriesRange): Promise<SeriesResult> {
    const cfg = SERIES_CONFIG[range];

    const [[nowRow]] = await pool.execute<RowDataPacket[]>('SELECT CURDATE() AS today');
    const today = toYmd(nowRow.today);

    const buckets = buildBuckets(today, cfg);
    const from = buckets[0].key;
    // Lower bound for every query below. Bounded scans keep these index-friendly
    // rather than aggregating the whole table and throwing most of it away.
    const since = from;

    const [newUsers, topups, revenue] = await Promise.all([
      groupBy(cfg.sqlBucket('created_at'), 'COUNT(*)', 'users', '1=1', since),
      groupBy(cfg.sqlBucket('created_at'), 'SUM(amount)', 'transactions',
              "type='topup' AND status='success'", since),
      groupBy(cfg.sqlBucket('created_at'), 'SUM(price)', 'purchases',
              "status='delivered' AND is_test=0", since),
    ]);

    return {
      range,
      from,
      to: today,
      points: buckets.map(b => ({
        key: b.key,
        label: b.label,
        newUsers: newUsers.get(b.key) ?? 0,
        topupAmount: topups.get(b.key) ?? 0,
        revenueAmount: revenue.get(b.key) ?? 0,
      })),
    };
  }
}

// ─── Series helpers ───────────────────────────────────────────

export const SERIES_RANGES = ['7d', '30d', '90d', 'week', 'month'] as const;
export type SeriesRange = (typeof SERIES_RANGES)[number];

export interface SeriesPoint {
  key: string;
  label: string;
  newUsers: number;
  topupAmount: number;
  revenueAmount: number;
}
export interface SeriesResult {
  range: SeriesRange;
  from: string;
  to: string;
  points: SeriesPoint[];
}

export const isSeriesRange = (v: unknown): v is SeriesRange =>
  typeof v === 'string' && (SERIES_RANGES as readonly string[]).includes(v);

interface SeriesConfig {
  unit: 'day' | 'week' | 'month';
  count: number;
  /** SQL expression bucketing a timestamp column into this series' key format. */
  sqlBucket: (col: string) => string;
}

const SERIES_CONFIG: Record<SeriesRange, SeriesConfig> = {
  '7d':   { unit: 'day',   count: 7,  sqlBucket: c => `DATE_FORMAT(${c}, '%Y-%m-%d')` },
  '30d':  { unit: 'day',   count: 30, sqlBucket: c => `DATE_FORMAT(${c}, '%Y-%m-%d')` },
  '90d':  { unit: 'day',   count: 90, sqlBucket: c => `DATE_FORMAT(${c}, '%Y-%m-%d')` },
  // Weeks start Monday, matching MySQL WEEKDAY() which the old query used.
  'week': { unit: 'week',  count: 12, sqlBucket: c => `DATE_FORMAT(DATE_SUB(DATE(${c}), INTERVAL WEEKDAY(${c}) DAY), '%Y-%m-%d')` },
  'month':{ unit: 'month', count: 12, sqlBucket: c => `DATE_FORMAT(${c}, '%Y-%m-01')` },
};

/** MySQL DATE columns arrive as a JS Date; normalise to a plain YYYY-MM-DD. */
function toYmd(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                     'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/**
 * The zero-filled spine, oldest first, ending on the bucket containing today.
 *
 * Dates are stepped with UTC arithmetic on a date-only value so a DST or
 * timezone shift can never move a bucket by a day - the strings in and out are
 * calendar dates, never instants.
 */
function buildBuckets(today: string, cfg: SeriesConfig): { key: string; label: string }[] {
  const base = new Date(`${today}T00:00:00Z`);
  const out: { key: string; label: string }[] = [];

  for (let i = cfg.count - 1; i >= 0; i--) {
    const d = new Date(base);
    if (cfg.unit === 'day') {
      d.setUTCDate(d.getUTCDate() - i);
    } else if (cfg.unit === 'week') {
      // Snap to Monday, then step back whole weeks.
      const dow = (d.getUTCDay() + 6) % 7;          // Mon=0 ... Sun=6
      d.setUTCDate(d.getUTCDate() - dow - i * 7);
    } else {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - i);
    }

    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;

    let label: string;
    if (cfg.unit === 'day') {
      label = `${day}/${m}`;
    } else if (cfg.unit === 'week') {
      const end = new Date(d);
      end.setUTCDate(end.getUTCDate() + 6);
      const ed = String(end.getUTCDate()).padStart(2, '0');
      const em = String(end.getUTCMonth() + 1).padStart(2, '0');
      label = `${day}/${m}-${ed}/${em}`;
    } else {
      // Thai Buddhist year, 2 digits, matching the rest of the admin UI.
      label = `${THAI_MONTHS[d.getUTCMonth()]} ${String((y + 543) % 100).padStart(2, '0')}`;
    }
    out.push({ key, label });
  }
  return out;
}

/**
 * One grouped aggregate, returned as bucket-key -> number.
 *
 * `bucketExpr` and `where` are code-controlled literals (SERIES_CONFIG above),
 * never user input; `since` is the only caller-derived value and it is bound.
 */
async function groupBy(
  bucketExpr: string,
  agg: string,
  table: string,
  where: string,
  since: string,
): Promise<Map<string, number>> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${bucketExpr} AS k, COALESCE(${agg}, 0) AS v
       FROM ${table}
      WHERE ${where} AND created_at >= ?
      GROUP BY k`,
    [since]
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(toYmd(r.k), Number(r.v) || 0);
  return map;
}

export const adminStatsService = new AdminStatsService();
