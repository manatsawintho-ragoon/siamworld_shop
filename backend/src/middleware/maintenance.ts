import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { logger } from '../utils/logger';

/**
 * Block state-changing player actions while the shop is in maintenance.
 *
 * `maintenance_mode` was published in /api/public/settings and honoured only by
 * the frontend, so it hid the UI without closing anything: purchases, top-ups,
 * loot boxes and redemptions all still worked for anyone calling the API
 * directly. That is the worst moment for them to run, because maintenance is
 * usually declared precisely when RCON or the database is half-broken and
 * deliveries are failing.
 *
 * Admins are exempt — the owner has to be able to test and fix the shop while it
 * is closed. Reads are untouched; only writes are refused.
 *
 * The settings read is served from settings.service's 15s cache, so this costs
 * no extra query on the hot path.
 */
export async function blockDuringMaintenance(req: Request, res: Response, next: NextFunction) {
  // The shop owner still needs a working shop while it is closed to players.
  if (req.user?.role === 'admin') return next();

  try {
    const mode = await settingsService.get('maintenance_mode');
    // Stored by the admin UI as 'true'/'false'; treat '1' as on too so a value
    // set by hand in the DB behaves the way an operator would expect.
    if (mode === 'true' || mode === '1') {
      res.status(503).json({
        success: false,
        error: 'ขณะนี้ระบบปิดปรับปรุงชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง',
        code: 'MAINTENANCE_MODE',
      });
      return;
    }
  } catch (err) {
    // Fail open: an unreadable setting must not take the shop down by itself.
    logger.warn('Maintenance check skipped - settings unavailable', {
      error: (err as Error).message,
    });
  }

  next();
}
