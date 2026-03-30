import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { setupService } from '../services/setup.service';
import { settingsService } from '../services/settings.service';
import { z } from 'zod';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────

const testAuthMeSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().positive().default(3306),
  user: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
  database: z.string().min(1).max(255),
  table: z.string().min(1).max(255).default('authme'),
});

const testRconSchema = z.object({
  host: z.string().min(1).max(255),
  rcon_port: z.number().int().positive(),
  rcon_password: z.string().min(1).max(255),
});

const saveServerSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1).max(255),
  port: z.number().int().positive().optional(),
  rcon_port: z.number().int().positive(),
  rcon_password: z.string().min(1).max(255),
  minecraft_version: z.string().max(50).optional(),
  max_players: z.number().int().positive().optional(),
});

const initAdminSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
  password: z.string().min(6).max(100),
});

const saveSetupSettingsSchema = z.object({
  shop_name: z.string().min(1).max(100),
  shop_subtitle: z.string().max(200).optional(),
  currency_symbol: z.string().max(10).optional(),
});

// ── Public routes (no auth) ────────────────────────────────────

router.get('/status', asyncHandler(async (_req, res) => {
  const status = await setupService.getSetupStatus();
  res.json({ success: true, ...status });
}));

router.post('/init-admin', validate(initAdminSchema), asyncHandler(async (req, res) => {
  const result = await setupService.initAdmin(req.body.username, req.body.password);
  res.json({ success: true, ...result });
}));

// ── Protected routes (admin JWT required) ─────────────────────

router.use(authenticate, authorize('admin'));

router.post('/test-db', validate(testAuthMeSchema), asyncHandler(async (req, res) => {
  const result = await setupService.testAuthMeConnection(req.body);
  res.json({ ...result });
}));

router.post('/test-rcon', validate(testRconSchema), asyncHandler(async (req, res) => {
  const result = await setupService.testRconConnection(req.body);
  res.json({ ...result });
}));

router.get('/authme-info', asyncHandler(async (_req, res) => {
  const info = await setupService.getAuthMeInfo();
  res.json({ success: true, ...info });
}));

router.post('/save-settings', validate(saveSetupSettingsSchema), asyncHandler(async (req, res) => {
  const { shop_name, shop_subtitle, currency_symbol } = req.body;
  const settings: Record<string, string> = { shop_name };
  if (shop_subtitle !== undefined) settings.shop_subtitle = shop_subtitle;
  if (currency_symbol !== undefined) settings.currency_symbol = currency_symbol;
  await settingsService.setMultiple(settings);
  res.json({ success: true });
}));

router.post('/save-server', validate(saveServerSchema), asyncHandler(async (req, res) => {
  const result = await setupService.saveServerConfig(req.body);
  const rconManager = req.app.get('rconManager');
  if (rconManager) await rconManager.reloadServers();
  res.json({ success: true, message: 'Server configuration saved', ...result });
}));

export default router;
