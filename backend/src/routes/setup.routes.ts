import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { setupService } from '../services/setup.service';
import { z } from 'zod';

const router = Router();

// Schema validations
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

// Public: Get setup status (no auth needed for initial setup check)
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await setupService.getSetupStatus();
    res.json({ success: true, ...status });
  } catch (err) { next(err); }
});

// Protected: all setup actions require admin
router.use(authenticate, authorize('admin'));

// Test AuthMe database connection
router.post('/test-db', validate(testAuthMeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await setupService.testAuthMeConnection(req.body);
    res.json({ ...result });
  } catch (err) { next(err); }
});

// Test RCON connection
router.post('/test-rcon', validate(testRconSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await setupService.testRconConnection(req.body);
    res.json({ ...result });
  } catch (err) { next(err); }
});

// Save server configuration
router.post('/save-server', validate(saveServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await setupService.saveServerConfig(req.body);
    // Reload RCON connections
    const rconManager = req.app.get('rconManager');
    if (rconManager) await rconManager.reloadServers();
    res.json({ success: true, message: 'Server configuration saved', ...result });
  } catch (err) { next(err); }
});

export default router;
