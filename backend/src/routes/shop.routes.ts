import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { purchaseCooldown } from '../middleware/cooldown';
import { shopService } from '../services/shop.service';
import { lootBoxService } from '../services/loot-box.service';
import { buyProductSchema, openLootBoxSchema } from '../validators/schemas';

const router = Router();

router.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
    const products = await shopService.getProducts(serverId);
    res.json({ success: true, products });
  } catch (err) { next(err); }
});

router.get('/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const product = await shopService.getProduct(id);
    res.json({ success: true, product });
  } catch (err) { next(err); }
});

router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await shopService.getCategories();
    res.json({ success: true, categories });
  } catch (err) { next(err); }
});

router.get('/featured', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await shopService.getFeaturedProducts();
    res.json({ success: true, products });
  } catch (err) { next(err); }
});

router.post('/buy', authenticate, purchaseCooldown(5), validate(buyProductSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = req.app;
    const rconManager = app.get('rconManager');
    const playerTracker = app.get('playerTracker');
    const result = await shopService.buyProduct(
      req.user!.userId,
      req.user!.username,
      req.body.productId,
      req.body.serverId,
      playerTracker,
      rconManager,
      req.body.idempotencyKey
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ─── Loot Boxes ─────────────────────────────────────────────

router.get('/lootboxes', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const boxes = await lootBoxService.getLootBoxes();
    res.json({ success: true, boxes });
  } catch (err) { next(err); }
});

router.get('/lootboxes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const box = await lootBoxService.getLootBox(parseInt(req.params.id));
    res.json({ success: true, box });
  } catch (err) { next(err); }
});

router.post('/lootboxes/:id/open', authenticate, purchaseCooldown(3), validate(openLootBoxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lootBoxService.openBox(
      req.user!.userId,
      parseInt(req.params.id),
      req.body.idempotencyKey
    );
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

export default router;
