import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';

class AdminStatsService {
  async getDashboardStats() {
    const queries = {
      revenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered'",
      topups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success'",
      lootboxRevenue: "SELECT COALESCE(SUM(ABS(amount)),0) as v FROM transactions WHERE type='purchase' AND status='success' AND description LIKE 'เปิดกล่อง%'",
      users: 'SELECT COUNT(*) as v FROM users',
      activeProducts: 'SELECT COUNT(*) as v FROM products WHERE active=1',
      totalPurchases: "SELECT COUNT(*) as v FROM purchases WHERE status='delivered'",
      delivered: "SELECT COUNT(*) as v FROM purchases WHERE status='delivered'",
      failed: "SELECT COUNT(*) as v FROM purchases WHERE status='failed'",
      pending: "SELECT COUNT(*) as v FROM purchases WHERE status='pending'",
      refunded: "SELECT COUNT(*) as v FROM purchases WHERE status='refunded'",
      todayRevenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered' AND DATE(created_at)=CURDATE()",
      todayTopups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success' AND DATE(created_at)=CURDATE()",
      todayUsers: 'SELECT COUNT(*) as v FROM users WHERE DATE(created_at)=CURDATE()',
      monthNewUsers: 'SELECT COUNT(*) as v FROM users WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())',
      totalLootboxOpened: 'SELECT COUNT(*) as v FROM web_inventory',
      totalRedeemUsed: 'SELECT COUNT(*) as v FROM redeem_logs',
      activeRedeemCodes: "SELECT COUNT(*) as v FROM redeem_codes WHERE active=1",
      todayPurchases: "SELECT COUNT(*) as v FROM purchases WHERE status='delivered' AND DATE(created_at)=CURDATE()",
      monthRevenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())",
      monthTopups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())",
    };

    const results: Record<string, number> = {};
    for (const [key, sql] of Object.entries(queries)) {
      const [rows] = await pool.execute<RowDataPacket[]>(sql);
      results[key] = parseFloat(rows[0].v) || 0;
    }

    // Top products
    const [topProducts] = await pool.execute<RowDataPacket[]>(
      `SELECT pr.name, COUNT(*) as purchase_count, SUM(p.price) as total_revenue
       FROM purchases p JOIN products pr ON p.product_id = pr.id WHERE p.status='delivered'
       GROUP BY pr.id, pr.name ORDER BY purchase_count DESC LIMIT 5`
    );

    // Top loot boxes
    const [topLootBoxes] = await pool.execute<RowDataPacket[]>(
      `SELECT lb.name, COUNT(*) as open_count, SUM(lb.price) as total_revenue
       FROM web_inventory wi JOIN loot_boxes lb ON wi.loot_box_id = lb.id
       GROUP BY wi.loot_box_id, lb.name ORDER BY open_count DESC LIMIT 5`
    );

    // Recent purchases (shop only)
    const [recentPurchases] = await pool.execute<RowDataPacket[]>(
      `SELECT p.id, p.price, p.status, p.created_at, u.username, pr.name as product_name, s.name as server_name
       FROM purchases p JOIN users u ON p.user_id = u.id JOIN products pr ON p.product_id = pr.id
       JOIN servers s ON p.server_id = s.id ORDER BY p.created_at DESC LIMIT 10`
    );

    // Recent transactions (all types: topup, lootbox, shop purchase)
    const [recentTransactions] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.type, t.amount, t.description, t.status, t.created_at, u.username
       FROM transactions t JOIN users u ON t.user_id = u.id
       WHERE t.status = 'success'
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

    // Monthly chart data (last 12 months)
    const [monthlyChart] = await pool.execute<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(m.month_date, '%Y-%m') as month_key,
         DATE_FORMAT(m.month_date, '%b %y') as month_label,
         COALESCE(nu.cnt, 0) as new_users,
         COALESCE(tp.total, 0) as topup_amount,
         COALESCE(rv.total, 0) as revenue_amount
       FROM (
         SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m-01') as month_date
         FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
               UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11) nums
       ) m
       LEFT JOIN (
         SELECT DATE_FORMAT(created_at, '%Y-%m-01') as md, COUNT(*) as cnt FROM users GROUP BY md
       ) nu ON m.month_date = nu.md
       LEFT JOIN (
         SELECT DATE_FORMAT(created_at, '%Y-%m-01') as md, SUM(amount) as total FROM transactions
         WHERE type='topup' AND status='success' GROUP BY md
       ) tp ON m.month_date = tp.md
       LEFT JOIN (
         SELECT DATE_FORMAT(created_at, '%Y-%m-01') as md, SUM(price) as total FROM purchases
         WHERE status='delivered' GROUP BY md
       ) rv ON m.month_date = rv.md
       ORDER BY m.month_date ASC`
    );

    // Activity feed (union of recent activities)
    const [activityFeed] = await pool.execute<RowDataPacket[]>(
      `(SELECT 'purchase' as activity_type, u.username, pr.name as detail, p.price as amount, p.created_at
        FROM purchases p JOIN users u ON p.user_id = u.id JOIN products pr ON p.product_id = pr.id
        WHERE p.status='delivered' ORDER BY p.created_at DESC LIMIT 5)
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
        ORDER BY wi.won_at DESC LIMIT 5)
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
      monthlyChart,
      topupRankAlltime,
      topupRankMonth,
      topupRankToday,
      activityFeed,
    };
  }
}

export const adminStatsService = new AdminStatsService();
