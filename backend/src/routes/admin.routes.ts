import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pool } from '../database/connection';
import { adminStatsService } from '../services/admin-stats.service';
import { shopService } from '../services/shop.service';
import { lootBoxService } from '../services/loot-box.service';
import { userService } from '../services/user.service';
import { walletService } from '../services/wallet.service';
import { serverService } from '../services/server.service';
import { settingsService } from '../services/settings.service';
import {
  createProductSchema, updateProductSchema,
  createServerSchema, updateServerSchema,
  updateSettingsSchema, createSlideSchema,
  createLootBoxSchema, updateLootBoxSchema,
  createLootBoxItemSchema, updateLootBoxItemSchema,
  createDownloadSchema, updateDownloadSchema,
  createRedeemCodeSchema, updateRedeemCodeSchema,
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
    await userService.updateUserRole(id, role);
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
    res.json({ success: true, product });
  } catch (err) { next(err); }
});

router.put('/products/:id', validate(updateProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const product = await shopService.updateProduct(id, req.body);
    res.json({ success: true, product });
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await shopService.deleteProduct(id);
    res.json({ success: true, message: 'Product deleted' });
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
    res.json({ success: true, server });
  } catch (err) { next(err); }
});

router.put('/servers/:id', validate(updateServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const server = await serverService.update(id, req.body);
    const rconManager = req.app.get('rconManager');
    await rconManager.reloadServers();
    res.json({ success: true, server });
  } catch (err) { next(err); }
});

router.delete('/servers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    await serverService.delete(id);
    const rconManager = req.app.get('rconManager');
    await rconManager.reloadServers();
    res.json({ success: true, message: 'Server deleted' });
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

router.get('/lootboxes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const boxes = await lootBoxService.getAllLootBoxes();
    res.json({ success: true, boxes });
  } catch (err) { next(err); }
});

router.post('/lootboxes', validate(createLootBoxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const box = await lootBoxService.createLootBox(req.body);
    res.status(201).json({ success: true, box });
  } catch (err) { next(err); }
});

router.put('/lootboxes/:id', validate(updateLootBoxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const box = await lootBoxService.updateLootBox(parseInt(req.params.id), req.body);
    res.json({ success: true, box });
  } catch (err) { next(err); }
});

router.delete('/lootboxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await lootBoxService.deleteLootBox(parseInt(req.params.id));
    res.json({ success: true, message: 'Loot box deleted' });
  } catch (err) { next(err); }
});

// ─── Loot Box Items ──────────────────────────────────────────

router.post('/lootboxes/:id/items', validate(createLootBoxItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await lootBoxService.createLootBoxItem(parseInt(req.params.id), req.body);
    res.status(201).json({ success: true, item });
  } catch (err) { next(err); }
});

router.put('/lootboxes/items/:itemId', validate(updateLootBoxItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await lootBoxService.updateLootBoxItem(parseInt(req.params.itemId), req.body);
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

router.delete('/lootboxes/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await lootBoxService.deleteLootBoxItem(parseInt(req.params.itemId));
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
    await pool.execute('DELETE FROM redeem_codes WHERE id = ?', [id]);
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

