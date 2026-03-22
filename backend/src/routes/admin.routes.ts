import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { adminStatsService } from '../services/admin-stats.service';
import { shopService } from '../services/shop.service';
import { lootBoxService } from '../services/loot-box.service';
import { userService } from '../services/user.service';
import { walletService } from '../services/wallet.service';
import { serverService } from '../services/server.service';
import { settingsService } from '../services/settings.service';
import { auditService } from '../services/audit.service';
import {
  createProductSchema, updateProductSchema,
  createServerSchema, updateServerSchema,
  updateSettingsSchema, createSlideSchema,
  createLootBoxSchema, updateLootBoxSchema,
  createLootBoxItemSchema, updateLootBoxItemSchema,
  createDownloadSchema, updateDownloadSchema,
  createRedeemCodeSchema, updateRedeemCodeSchema,
  createLootBoxCategorySchema, updateLootBoxCategorySchema,
} from '../validators/schemas';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// ─── Dashboard ──────────────────
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminStatsService.getDashboardStats();
    res.json({ success: true, stats });
  } catch (err) { next(err); }
});

router.get('/financial-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await adminStatsService.getFinancialSummary();
    res.json({ success: true, ...summary });
  } catch (err) { next(err); }
});

// ─── Activity Logs ──────────────

/** Audit log retention stats — row counts + size estimate per tier */
router.get('/logs/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT
        SUM(action_type = 'user_login')  AS login_count,
        SUM(action_type != 'user_login') AS admin_count,
        COUNT(*)                         AS total_count,
        MIN(created_at)                  AS oldest,
        MAX(created_at)                  AS newest,
        ROUND(
          (SELECT data_length + index_length
           FROM   information_schema.TABLES
           WHERE  table_schema = DATABASE() AND table_name = 'audit_logs') / 1024 / 1024
        , 2) AS size_mb
      FROM audit_logs
    `);
    res.json({ success: true, stats: rows[0] });
  } catch (err) { next(err); }
});

/** Manual purge — delete all audit_logs older than 7 days */
router.delete('/logs/purge', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 7 DAY'
    );
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) { next(err); }
});

router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const type   = (req.query.type as string) || 'all';
    const role   = (req.query.role as string) || 'all';
    const search = ((req.query.search as string) || '').trim();

    // WHERE helpers for user-joined subqueries
    const roleWhere   = role === 'admin' ? `AND u.role = 'admin'` : role === 'member' ? `AND u.role = 'user'` : '';
    const searchWhere = search ? 'AND u.username LIKE ?' : '';
    const sp          = search ? [`%${search}%`] : [];

    // WHERE helpers for audit_logs (stores role/username directly)
    const auditRoleWhere   = role === 'admin' ? `AND al.role = 'admin'` : role === 'member' ? `AND al.role = 'user'` : '';
    const auditSearchWhere = search ? 'AND al.username LIKE ?' : '';

    const parts: { sql: string; params: any[] }[] = [];

    if (type === 'all' || type === 'register') {
      parts.push({
        sql: `SELECT u.id as user_id, u.username, u.role,
              'register' as action_type, 'สมัครสมาชิก' as description,
              NULL as amount, NULL as ref_id, NULL as status_extra, u.created_at as ts
              FROM users u WHERE 1=1 ${roleWhere} ${searchWhere}`,
        params: [...sp],
      });
    }
    if (type === 'all' || type === 'topup') {
      parts.push({
        sql: `SELECT t.user_id, u.username, u.role,
              'topup' as action_type, COALESCE(t.description, 'เติมเงิน') as description,
              t.amount as amount, t.reference as ref_id, NULL as status_extra, t.created_at as ts
              FROM transactions t JOIN users u ON t.user_id = u.id
              WHERE t.type = 'topup' AND t.status = 'success' ${roleWhere} ${searchWhere}`,
        params: [...sp],
      });
    }
    if (type === 'all' || type === 'purchase') {
      parts.push({
        sql: `SELECT p.user_id, u.username, u.role,
              'purchase' as action_type, CONCAT('ซื้อ: ', pr.name) as description,
              p.price as amount, CAST(p.id AS CHAR) as ref_id, p.status as status_extra, p.created_at as ts
              FROM purchases p JOIN users u ON p.user_id = u.id JOIN products pr ON p.product_id = pr.id
              WHERE 1=1 ${roleWhere} ${searchWhere}`,
        params: [...sp],
      });
    }
    if (type === 'all' || type === 'lootbox') {
      parts.push({
        sql: `SELECT t.user_id, u.username, u.role,
              'lootbox' as action_type, t.description,
              ABS(t.amount) as amount, t.reference as ref_id, NULL as status_extra, t.created_at as ts
              FROM transactions t JOIN users u ON t.user_id = u.id
              WHERE t.type = 'purchase' AND t.status = 'success' AND t.description LIKE 'เปิดกล่อง%' ${roleWhere} ${searchWhere}`,
        params: [...sp],
      });
    }
    if (type === 'all' || type === 'redeem') {
      parts.push({
        sql: `SELECT rl.user_id, u.username, u.role,
              'redeem' as action_type, CONCAT('ใช้โค้ด: ', rc.code) as description,
              rc.point_amount as amount, rc.code as ref_id, rc.reward_type as status_extra, rl.redeemed_at as ts
              FROM redeem_logs rl JOIN users u ON rl.user_id = u.id JOIN redeem_codes rc ON rl.code_id = rc.id
              WHERE 1=1 ${roleWhere} ${searchWhere}`,
        params: [...sp],
      });
    }
    // Admin audit logs — includes all admin_* action types + user_login
    if (type === 'all' || type === 'admin_action' || type === 'user_login') {
      const auditTypeWhere = type === 'user_login'
        ? `AND al.action_type = 'user_login'`
        : type === 'admin_action'
          ? `AND al.action_type != 'user_login'`
          : '';
      // Skip audit_logs if role filter = member AND type is specifically admin_action
      const skipAudit = type === 'admin_action' && role === 'member';
      if (!skipAudit) {
        parts.push({
          sql: `SELECT al.user_id, al.username, al.role,
                al.action_type, al.description,
                al.amount, al.ref_id, NULL as status_extra, al.created_at as ts
                FROM audit_logs al
                WHERE 1=1 ${auditTypeWhere} ${auditRoleWhere} ${auditSearchWhere}`,
          params: [...sp],
        });
      }
    }

    if (parts.length === 0) {
      return res.json({ success: true, logs: [], pagination: { page, totalPages: 0, total: 0 } });
    }

    const union     = parts.map(p => p.sql).join(' UNION ALL ');
    const allParams = parts.flatMap(p => p.params);

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM (${union}) as _combined`, allParams
    );
    const total = parseInt((countRows[0] as any).total) || 0;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM (${union}) as _combined ORDER BY ts DESC LIMIT ${limit} OFFSET ${offset}`,
      allParams
    );

    res.json({ success: true, logs: rows, pagination: { page, totalPages: Math.ceil(total / limit), total } });
  } catch (err) { next(err); }
});

// ─── Users ──────────────────────
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;
    const users = await userService.getAllUsers(page, limit, search);
    res.json({ success: true, ...users });
  } catch (err) { next(err); }
});

router.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const user = await userService.getProfile(id);
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.get('/users/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const type = req.query.type as 'topup' | 'purchase' | 'redeem' || 'topup';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const history = await userService.getUserHistory(id, type, page, limit);
    res.json({ success: true, ...history });
  } catch (err) { next(err); }
});

router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { email, password, balance, role } = req.body;
    const balanceNum = balance !== undefined ? Number(balance) : undefined;

    // Snapshot balance before update for audit diff
    const [walletSnap] = await pool.execute<RowDataPacket[]>('SELECT balance FROM wallets WHERE user_id = ?', [id]);
    const [targetUser] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [id]);
    const targetUsername = (targetUser[0] as any)?.username || `ID ${id}`;
    const balanceBefore = walletSnap.length > 0 ? parseFloat((walletSnap[0] as any).balance) : 0;

    await userService.updateUserProfile(id, { email, password, balance: balanceNum, role });

    // Separate audit entries for each type of change
    if (balanceNum !== undefined && balanceNum !== balanceBefore) {
      const diff = balanceNum - balanceBefore;
      auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_wallet_adjust', description: `แก้ไขยอดเงิน ${targetUsername}: ${balanceBefore.toFixed(2)} → ${balanceNum.toFixed(2)}`, amount: Math.abs(diff), refId: String(id), meta: { target: targetUsername, before: balanceBefore, after: balanceNum, diff } });
    }
    if (password) {
      auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_user_edit', description: `รีเซ็ตรหัสผ่าน ${targetUsername}`, refId: String(id) });
    }
    if (role) {
      auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_user_role', description: `เปลี่ยน Role ${targetUsername} → ${role}`, refId: String(id), meta: { target: targetUsername, newRole: role } });
    }
    if (email !== undefined && !password && !role && balanceNum === undefined) {
      auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_user_edit', description: `แก้ไขอีเมล ${targetUsername}`, refId: String(id) });
    }

    res.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (err) { next(err); }
});

router.put('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    if (id === req.user!.userId && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลด Role ของตัวเองได้' });
    }
    const [targetUser] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [id]);
    const targetUsername = (targetUser[0] as any)?.username || `ID ${id}`;
    await userService.updateUserRole(id, role);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_user_role', description: `เปลี่ยน Role ${targetUsername} → ${role}`, refId: String(id), meta: { target: targetUsername, newRole: role } });
    res.json({ success: true, message: 'Role updated' });
  } catch (err) { next(err); }
});

router.post('/users/:id/topup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { amount, description } = req.body;
    const wallet = await walletService.topup(id, amount, 'admin', undefined, description || 'Admin adjust', 'admin_adjust');
    res.json({ success: true, wallet });
  } catch (err) { next(err); }
});

// ─── Products ───────────────────
router.get('/products', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await shopService.getAllProducts();
    res.json({ success: true, products });
  } catch (err) { next(err); }
});

router.post('/products', validate(createProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await shopService.createProduct(req.body);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_product_create', description: `เพิ่มสินค้า: ${product.name}`, refId: String(product.id), meta: { price: product.price } });
    res.json({ success: true, product });
  } catch (err) { next(err); }
});

router.put('/products/:id', validate(updateProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const product = await shopService.updateProduct(id, req.body);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_product_update', description: `แก้ไขสินค้า: ${product.name}`, refId: String(id), meta: { price: product.price } });
    res.json({ success: true, product });
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT name FROM products WHERE id = ?', [id]);
    const name = (rows[0] as any)?.name || `ID ${id}`;
    await shopService.deleteProduct(id);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_product_delete', description: `ลบสินค้า: ${name}`, refId: String(id) });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
});

// ─── Product Buyers ─────────────
router.get('/products/:id/buyers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [purchases] = await pool.execute<RowDataPacket[]>(
      `SELECT p.id, p.price, p.status, p.created_at, u.username, s.name as server_name
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       JOIN servers s ON p.server_id = s.id
       WHERE p.product_id = ?
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [id]
    );
    res.json({ success: true, purchases });
  } catch (err) { next(err); }
});

// ─── Categories ─────────────────
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [categories] = await pool.execute<RowDataPacket[]>('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    res.json({ success: true, categories });
  } catch (err) { next(err); }
});

router.post('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, icon, sort_order } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, message: 'name and slug are required' });
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO categories (name, slug, icon, sort_order) VALUES (?, ?, ?, ?)',
      [name, slug.toLowerCase().replace(/\s+/g, '-'), icon || null, sort_order || 0]
    );
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.json({ success: true, category: rows[0] });
  } catch (err) { next(err); }
});

router.put('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { name, slug, icon, sort_order } = req.body;
    await pool.execute(
      'UPDATE categories SET name=?, slug=?, icon=?, sort_order=? WHERE id=?',
      [name, slug ? slug.toLowerCase().replace(/\s+/g, '-') : slug, icon || null, sort_order ?? 0, id]
    );
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, category: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
});

// ─── Purchases ──────────────────
router.get('/purchases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const data = await shopService.getPurchases(page, limit);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.post('/purchases/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const rconManager = req.app.get('rconManager');
    const playerTracker = req.app.get('playerTracker');
    const result = await shopService.retryDelivery(id, rconManager, playerTracker);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/purchases/:id/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const result = await shopService.adminRefund(id);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ─── Servers ────────────────────
router.get('/servers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const servers = await serverService.getAll();
    res.json({ success: true, servers });
  } catch (err) { next(err); }
});

// Must be before /servers/:id to avoid 'health' being treated as an id
router.get('/servers/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await serverService.healthCheckAll();
    res.json({ success: true, health });
  } catch (err) { next(err); }
});

router.get('/servers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const server = await serverService.getById(id);
    res.json({ success: true, server });
  } catch (err) { next(err); }
});

router.post('/servers', validate(createServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = await serverService.create(req.body);
    const rconManager = req.app.get('rconManager');
    await rconManager.reloadServers();
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_server_create', description: `เพิ่มเซิร์ฟเวอร์: ${(server as any).name} (${req.body.host}:${req.body.rcon_port})`, refId: String((server as any).id) });
    res.json({ success: true, server });
  } catch (err) { next(err); }
});

router.put('/servers/:id', validate(updateServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const server = await serverService.update(id, req.body);
    const rconManager = req.app.get('rconManager');
    await rconManager.reloadServers();
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_server_update', description: `แก้ไขเซิร์ฟเวอร์: ${(server as any).name}`, refId: String(id) });
    res.json({ success: true, server });
  } catch (err) { next(err); }
});

router.delete('/servers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [srows] = await pool.execute<RowDataPacket[]>('SELECT name FROM servers WHERE id = ?', [id]);
    const sname = (srows[0] as any)?.name || `ID ${id}`;
    await serverService.delete(id);
    const rconManager = req.app.get('rconManager');
    await rconManager.reloadServers();
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_server_delete', description: `ลบเซิร์ฟเวอร์: ${sname}`, refId: String(id) });
    res.json({ success: true, message: 'Server deleted' });
  } catch (err) { next(err); }
});

router.patch('/servers/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT name, enabled FROM servers WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Server not found' });
    const newEnabled = !rows[0].enabled;
    const sname = (rows[0] as any).name || `ID ${id}`;
    await pool.execute('UPDATE servers SET enabled = ? WHERE id = ?', [newEnabled ? 1 : 0, id]);
    const rconManager = req.app.get('rconManager');
    await rconManager.reloadServers();
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_server_toggle', description: `${newEnabled ? 'เปิด' : 'ปิด'}เซิร์ฟเวอร์: ${sname}`, refId: String(id) });
    res.json({ success: true, is_enabled: newEnabled });
  } catch (err) { next(err); }
});

router.post('/servers/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const rconManager = req.app.get('rconManager');
    const healthy = await rconManager.healthCheck(id);
    res.json({ success: true, healthy, message: healthy ? 'Connection successful' : 'Connection failed' });
  } catch (err) { next(err); }
});

// ─── Settings ───────────────────
router.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsMap = await settingsService.getAll();
    const settings = Object.entries(settingsMap).map(([key, value]) => ({ key, value }));
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

router.put('/settings', validate(updateSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record: Record<string, string> = {};
    for (const { key, value } of req.body.settings) {
      record[key] = value;
    }
    await settingsService.setMultiple(record);
    const settings = await settingsService.getAll();
    const keys = req.body.settings.map((s: any) => s.key).join(', ');
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_settings', description: `แก้ไข Settings: ${keys}`, meta: { keys: req.body.settings } });
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

// ─── Slides ─────────────────────
router.get('/slides', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const slides = await settingsService.getAllSlides();
    res.json({ success: true, slides });
  } catch (err) { next(err); }
});

router.post('/slides', validate(createSlideSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slide = await settingsService.createSlide(req.body);
    res.json({ success: true, slide });
  } catch (err) { next(err); }
});

router.put('/slides/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order } = req.body as { order: { id: number; sort_order: number }[] };
    if (!Array.isArray(order)) { res.status(400).json({ success: false, message: 'Invalid order' }); return; }
    await settingsService.reorderSlides(order);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/slides/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const slide = await settingsService.updateSlide(id, req.body);
    res.json({ success: true, slide });
  } catch (err) { next(err); }
});

router.delete('/slides/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await settingsService.deleteSlide(id);
    res.json({ success: true, message: 'Slide deleted' });
  } catch (err) { next(err); }
});

// ─── RCON Console ───────────────
router.post('/rcon/command', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serverId, command } = req.body;
    if (!serverId || !command) {
      return res.status(400).json({ success: false, message: 'serverId and command are required' });
    }
    const rconManager = req.app.get('rconManager');
    const response = await rconManager.sendCommand(serverId, command);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_rcon_cmd', description: `RCON command: ${command}`, refId: String(serverId), meta: { serverId, command, response: response?.slice(0, 200) } });
    res.json({ success: true, response });
  } catch (err) { next(err); }
});

// ─── RCON Logs ──────────────────
router.get('/rcon-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
    const offset = (page - 1) * limit;

    let query = `SELECT rl.*, s.name as server_name FROM rcon_logs rl JOIN servers s ON rl.server_id = s.id`;
    const params: (string | number)[] = [];
    if (serverId) { query += ' WHERE rl.server_id = ?'; params.push(serverId); }
    query += ' ORDER BY rl.created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const [rows] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM rcon_logs';
    const countParams: (string | number)[] = [];
    if (serverId) { countQuery += ' WHERE server_id = ?'; countParams.push(serverId); }
    const [countResult] = await pool.execute(countQuery, countParams) as any;

    res.json({ success: true, logs: rows, pagination: { page, totalPages: Math.ceil(countResult[0].total / limit), total: countResult[0].total } });
  } catch (err) { next(err); }
});

// ─── RCON Queue Status ──────────
router.get('/rcon/queue-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rconManager = req.app.get('rconManager');
    const status = rconManager.getQueueStatus();
    res.json({ success: true, status });
  } catch (err) { next(err); }
});

// ─── Loot Boxes ──────────────────────────────────────────────

// ─── Loot Box Categories ─────────────────────────────────────

router.get('/lootboxes/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await lootBoxService.getAllCategories();
    res.json({ success: true, categories });
  } catch (err) { next(err); }
});

router.put('/lootboxes/categories/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) { res.status(400).json({ success: false, message: 'Invalid order' }); return; }
    await lootBoxService.reorderCategories(order);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/lootboxes/categories', validate(createLootBoxCategorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await lootBoxService.createCategory(req.body);
    res.status(201).json({ success: true, category });
  } catch (err) { next(err); }
});

router.put('/lootboxes/categories/:id', validate(updateLootBoxCategorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await lootBoxService.updateCategory(parseInt(req.params.id), req.body);
    res.json({ success: true, category });
  } catch (err) { next(err); }
});

router.delete('/lootboxes/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await lootBoxService.deleteCategory(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Loot Boxes ──────────────────────────────────────────────

router.get('/lootboxes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [boxes, categories] = await Promise.all([
      lootBoxService.getAllLootBoxes(),
      lootBoxService.getAllCategories(),
    ]);
    res.json({ success: true, boxes, categories });
  } catch (err) { next(err); }
});

router.put('/lootboxes/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) { res.status(400).json({ success: false, message: 'Invalid order' }); return; }
    await lootBoxService.reorderLootBoxes(order);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/lootboxes', validate(createLootBoxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const box = await lootBoxService.createLootBox(req.body);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_lootbox_create', description: `เพิ่มกล่อง: ${box.name}`, refId: String(box.id), meta: { price: box.price } });
    res.status(201).json({ success: true, box });
  } catch (err) { next(err); }
});

router.put('/lootboxes/:id', validate(updateLootBoxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const box = await lootBoxService.updateLootBox(id, req.body);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_lootbox_update', description: `แก้ไขกล่อง: ${box.name}`, refId: String(id), meta: { price: box.price } });
    res.json({ success: true, box });
  } catch (err) { next(err); }
});

router.delete('/lootboxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [lbrows] = await pool.execute<RowDataPacket[]>('SELECT name FROM loot_boxes WHERE id = ?', [id]);
    const lbname = (lbrows[0] as any)?.name || `ID ${id}`;
    await lootBoxService.deleteLootBox(id);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_lootbox_delete', description: `ลบกล่อง: ${lbname}`, refId: String(id) });
    res.json({ success: true, message: 'Loot box deleted' });
  } catch (err) { next(err); }
});

// ─── Loot Box Items ──────────────────────────────────────────

router.post('/lootboxes/:id/items', validate(createLootBoxItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boxId = parseInt(req.params.id);
    const item = await lootBoxService.createLootBoxItem(boxId, req.body);
    const [lbrows] = await pool.execute<RowDataPacket[]>('SELECT name FROM loot_boxes WHERE id = ?', [boxId]);
    const lbname = (lbrows[0] as any)?.name || `กล่อง ${boxId}`;
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_lootbox_item_create', description: `เพิ่มไอเท็ม "${item.name}" ในกล่อง ${lbname}`, refId: String(item.id), meta: { boxId, boxName: lbname, rarity: item.rarity, weight: item.weight } });
    res.status(201).json({ success: true, item });
  } catch (err) { next(err); }
});

router.put('/lootboxes/items/:itemId', validate(updateLootBoxItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const item = await lootBoxService.updateLootBoxItem(itemId, req.body);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_lootbox_item_update', description: `แก้ไขไอเท็ม "${item.name}"`, refId: String(itemId), meta: { rarity: item.rarity, weight: item.weight } });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

router.delete('/lootboxes/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const [irows] = await pool.execute<RowDataPacket[]>('SELECT name, loot_box_id FROM loot_box_items WHERE id = ?', [itemId]);
    const iname = (irows[0] as any)?.name || `ID ${itemId}`;
    await lootBoxService.deleteLootBoxItem(itemId);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_lootbox_item_delete', description: `ลบไอเท็ม "${iname}"`, refId: String(itemId) });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) { next(err); }
});

// ─── Inventory management ────────────────────────────────────

router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, status } = req.query;
    let query = `SELECT wi.*, u.username, lb.name as box_name
                 FROM web_inventory wi
                 JOIN users u ON wi.user_id = u.id
                 JOIN loot_boxes lb ON wi.loot_box_id = lb.id`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (userId) { conditions.push('wi.user_id = ?'); params.push(parseInt(userId as string)); }
    if (status) { conditions.push('wi.status = ?'); params.push(status as string); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY wi.won_at DESC LIMIT 200';
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, inventory: rows });
  } catch (err) { next(err); }
});

// ─── Downloads ──────────────────────────────────────────────

router.get('/downloads', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM downloads ORDER BY sort_order ASC, created_at DESC');
    res.json({ success: true, downloads: rows });
  } catch (err) { next(err); }
});

router.post('/downloads', validate(createDownloadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename, description, file_size, download_url, category, active, sort_order } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO downloads (filename, description, file_size, download_url, category, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [filename, description || '', file_size || '', download_url, category || '', active !== false ? 1 : 0, sort_order || 0]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM downloads WHERE id = ?', [id]);
    res.json({ success: true, download: (rows as any[])[0] });
  } catch (err) { next(err); }
});

router.put('/downloads/:id', validate(updateDownloadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { filename, description, file_size, download_url, category, active, sort_order } = req.body;
    await pool.execute(
      'UPDATE downloads SET filename=?, description=?, file_size=?, download_url=?, category=?, active=?, sort_order=?, updated_at=NOW() WHERE id=?',
      [filename, description || '', file_size || '', download_url, category || '', active !== false ? 1 : 0, sort_order || 0, id]
    );
    const [rows] = await pool.execute('SELECT * FROM downloads WHERE id = ?', [id]);
    res.json({ success: true, download: (rows as any[])[0] });
  } catch (err) { next(err); }
});

router.delete('/downloads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await pool.execute('DELETE FROM downloads WHERE id = ?', [id]);
    res.json({ success: true, message: 'Download deleted' });
  } catch (err) { next(err); }
});

// ─── Redeem Codes ───────────────────────────────────────────

router.get('/codes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rc.*, 
        (SELECT COUNT(*) FROM redeem_logs rl WHERE rl.code_id = rc.id) as actual_used
       FROM redeem_codes rc ORDER BY rc.created_at DESC`
    );
    res.json({ success: true, codes: rows });
  } catch (err) { next(err); }
});

router.post('/codes', validate(createRedeemCodeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, description, command, max_uses, active, expires_at, reward_type, point_amount } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO redeem_codes (code, description, reward_type, point_amount, command, max_uses, active, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [code, description || null, reward_type || 'rcon', point_amount || null, command || null, max_uses ?? 1, active !== false ? 1 : 0, expires_at || null]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM redeem_codes WHERE id = ?', [id]);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_code_create', description: `สร้างโค้ด: ${code} (${reward_type === 'point' ? `+${point_amount} ฿` : 'RCON'})`, refId: String(id), meta: { code, reward_type, point_amount, max_uses } });
    res.json({ success: true, code: (rows as any[])[0] });
  } catch (err) { next(err); }
});

router.put('/codes/:id', validate(updateRedeemCodeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const fields: string[] = [];
    const values: any[] = [];
    const allowed = ['code', 'description', 'reward_type', 'point_amount', 'command', 'max_uses', 'active', 'expires_at'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'active') {
          fields.push(`${key}=?`);
          values.push(req.body[key] ? 1 : 0);
        } else {
          fields.push(`${key}=?`);
          values.push(req.body[key]);
        }
      }
    }
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    values.push(id);
    await pool.execute(`UPDATE redeem_codes SET ${fields.join(', ')}, updated_at=NOW() WHERE id=?`, values);
    const [rows] = await pool.execute('SELECT * FROM redeem_codes WHERE id = ?', [id]);
    res.json({ success: true, code: (rows as any[])[0] });
  } catch (err) { next(err); }
});

router.delete('/codes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [crows] = await pool.execute<RowDataPacket[]>('SELECT code FROM redeem_codes WHERE id = ?', [id]);
    const codeName = (crows[0] as any)?.code || `ID ${id}`;
    await pool.execute('DELETE FROM redeem_codes WHERE id = ?', [id]);
    auditService.log({ userId: req.user!.userId, username: req.user!.username, actionType: 'admin_code_delete', description: `ลบโค้ด: ${codeName}`, refId: String(id) });
    res.json({ success: true, message: 'Code deleted' });
  } catch (err) { next(err); }
});

// Get redeem logs for a specific code
router.get('/codes/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.execute(
      `SELECT rl.*, u.username FROM redeem_logs rl 
       JOIN users u ON rl.user_id = u.id 
       WHERE rl.code_id = ? ORDER BY rl.redeemed_at DESC`,
      [id]
    );
    res.json({ success: true, logs: rows });
  } catch (err) { next(err); }
});

export default router;

