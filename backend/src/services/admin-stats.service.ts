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
      totalPurchases: 'SELECT COUNT(*) as v FROM purchases',
      delivered: "SELECT COUNT(*) as v FROM purchases WHERE status='delivered'",
      failed: "SELECT COUNT(*) as v FROM purchases WHERE status='failed'",
      pending: "SELECT COUNT(*) as v FROM purchases WHERE status='pending'",
      refunded: "SELECT COUNT(*) as v FROM purchases WHERE status='refunded'",
      todayRevenue: "SELECT COALESCE(SUM(price),0) as v FROM purchases WHERE status='delivered' AND DATE(created_at)=CURDATE()",
      todayTopups: "SELECT COALESCE(SUM(amount),0) as v FROM transactions WHERE type='topup' AND status='success' AND DATE(created_at)=CURDATE()",
      todayUsers: 'SELECT COUNT(*) as v FROM users WHERE DATE(created_at)=CURDATE()',
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
      topProducts,
      recentPurchases,
      recentTransactions,
    };
  }
}

export const adminStatsService = new AdminStatsService();
