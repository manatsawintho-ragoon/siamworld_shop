import { Request, Response, NextFunction } from 'express';
import { redis } from '../database/redis';

/**
 * Per-user purchase cooldown to prevent spam buying.
 * Uses Redis to track last purchase time per user.
 */
export function purchaseCooldown(cooldownSeconds: number = 5) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next();

    const key = `cooldown:purchase:${req.user.userId}`;
    try {
      const exists = await redis.get(key);
      if (exists) {
        const ttl = await redis.ttl(key);
        res.status(429).json({
          success: false,
          error: `กรุณารอ ${ttl} วินาทีก่อนซื้อสินค้าถัดไป`,
          code: 'PURCHASE_COOLDOWN',
          retryAfter: ttl,
        });
        return;
      }

      // Set cooldown after this request completes
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        if (body?.success === true) {
          redis.set(key, '1', 'EX', cooldownSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch {
      // If Redis fails, allow the request through
      next();
    }
  };
}

