import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { settingsService } from '../services/settings.service';
import { shopService } from '../services/shop.service';
import { serverService } from '../services/server.service';

const router = Router();

// Public settings (no auth required)
router.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allSettings = await settingsService.getAll();
    // Only expose non-sensitive settings
    const publicKeys = ['shop_name', 'shop_subtitle', 'shop_description', 'welcome_message', 'currency', 'currency_symbol', 'maintenance_mode', 'logo_url', 'favicon_url', 'banner_url', 'facebook_url', 'discord_invite', 'website_bg_url', 'server_ip'];
    const settings: Record<string, string> = {};
    for (const [key, value] of Object.entries(allSettings)) {
      if (publicKeys.includes(key)) {
        settings[key] = value;
      }
    }
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

router.get('/slides', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const slides = await settingsService.getSlides();
    const activeSlides = slides.filter((s: any) => s.active);
    res.json({ success: true, slides: activeSlides });
  } catch (err) { next(err); }
});

router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await shopService.getCategories();
    res.json({ success: true, categories });
  } catch (err) { next(err); }
});

router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    let products = await shopService.getProducts(serverId);
    if (categoryId) {
      products = products.filter((p: any) => p.category_id === categoryId);
    }
    res.json({ success: true, products });
  } catch (err) { next(err); }
});

router.get('/products/featured', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await shopService.getFeaturedProducts();
    res.json({ success: true, products });
  } catch (err) { next(err); }
});

router.get('/servers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const servers = await serverService.getAll();
    const publicServers = servers.map((s: any) => ({
      id: s.id,
      name: s.name,
      host: s.host,
      port: s.port,
      minecraft_version: s.minecraft_version,
      max_players: s.max_players,
      is_enabled: s.is_enabled
    }));
    res.json({ success: true, servers: publicServers });
  } catch (err) { next(err); }
});

router.get('/online-players', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playerTracker = req.app.get('playerTracker');
    const data = await playerTracker.getOnlinePlayers();
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/topup-ranking', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.username, SUM(t.amount) as total_topup 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.type = 'topup' AND t.status = 'success'
      GROUP BY t.user_id, u.username
      ORDER BY total_topup DESC 
      LIMIT 10
    `);
    res.json({ success: true, ranking: rows });
  } catch (err) { next(err); }
});

router.get('/downloads', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM downloads WHERE active = 1 ORDER BY sort_order ASC, created_at DESC');
    res.json({ success: true, downloads: rows });
  } catch (err) { next(err); }
});

// Recent purchases activity feed (public)
router.get('/recent-purchases', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.username, COALESCE(pr.name, '(ลบแล้ว)') as product_name, pr.image, p.price, p.created_at
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN products pr ON p.product_id = pr.id
      WHERE p.status = 'delivered'
      ORDER BY p.created_at DESC
      LIMIT 8
    `);
    res.json({ success: true, purchases: rows });
  } catch (err) { next(err); }
});

// Daily top-up leaderboard (today only, latest 5)
router.get('/daily-topup', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.execute(`
      SELECT u.username, SUM(t.amount) as total_topup, MAX(t.created_at) as last_topup
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.type = 'topup' AND t.status = 'success'
        AND DATE(t.created_at) = CURDATE()
      GROUP BY t.user_id, u.username
      ORDER BY last_topup DESC
      LIMIT 5
    `);
    res.json({ success: true, daily: rows });
  } catch (err) { next(err); }
});

// Recent loot box openings activity feed (public)
router.get('/recent-lootbox', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boxId = req.query.boxId ? parseInt(req.query.boxId as string) : null;
    const limit = boxId ? 20 : 8;
    const query = boxId
      ? `SELECT u.username, COALESCE(lb.name, '(ลบแล้ว)') as box_name, wi.item_name, wi.item_image, wi.item_rarity, wi.won_at
         FROM web_inventory wi JOIN users u ON wi.user_id = u.id LEFT JOIN loot_boxes lb ON wi.loot_box_id = lb.id
         WHERE wi.loot_box_id = ? ORDER BY wi.won_at DESC LIMIT ${limit}`
      : `SELECT u.username, COALESCE(lb.name, '(ลบแล้ว)') as box_name, wi.item_name, wi.item_image, wi.item_rarity, wi.won_at
         FROM web_inventory wi JOIN users u ON wi.user_id = u.id LEFT JOIN loot_boxes lb ON wi.loot_box_id = lb.id
         ORDER BY wi.won_at DESC LIMIT ${limit}`;
    const [rows] = boxId
      ? await pool.execute(query, [boxId])
      : await pool.execute(query);
    res.json({ success: true, openings: rows });
  } catch (err) { next(err); }
});

export default router;
