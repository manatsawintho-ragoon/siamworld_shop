import { Request, Response, NextFunction } from 'express';
import { redis } from '../database/redis';
import { logger } from '../utils/logger';

/**
 * Per-user cooldown to prevent spam / burst abuse of expensive endpoints.
 *
 * The slot is claimed ATOMICALLY on the way in with `SET key 1 EX n NX`, which
 * succeeds for exactly one request and fails for every other one racing it. The
 * previous implementation read the key first and only wrote it when the response
 * was serialised, so N requests fired in parallel all observed "no cooldown"
 * before any of them had written — two browser tabs, or a scripted burst, walked
 * straight through. That mattered most on the paid paths: /payment/slip/verify
 * and /payment/truemoney/redeem each spend the shop owner's EasySlip quota, and
 * the purchase / loot-box cooldowns are what keep the stock races narrow.
 *
 * The claim is deliberately NOT released when the request fails. On the slip
 * path the external call — and therefore the quota spend — has already happened
 * by the time any validation can reject it, so releasing on failure would hand
 * the burst straight back. Waiting out the window after a bad attempt is the
 * point, not a side effect.
 *
 * Redis being unreachable still fails open: an outage must not stop the shop
 * from selling. That is the same trade-off the previous version made.
 */
export function purchaseCooldown(cooldownSeconds: number = 5, namespace: string = 'purchase') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next();

    const key = `cooldown:${namespace}:${req.user.userId}`;
    try {
      // 'NX' => only set when absent. 'OK' for the winner, null for the losers.
      const claimed = await redis.set(key, '1', 'EX', cooldownSeconds, 'NX');
      if (claimed !== 'OK') {
        // TTL can come back -2 when the key expires between the failed claim and
        // this read; report at least 1s rather than "wait -2 seconds".
        const ttl = Math.max(await redis.ttl(key), 1);
        res.status(429).json({
          success: false,
          error: `กรุณารอ ${ttl} วินาที ก่อนทำรายการถัดไป`,
          code: 'PURCHASE_COOLDOWN',
          retryAfter: ttl,
        });
        return;
      }

      next();
    } catch (err) {
      logger.warn('Cooldown check skipped - Redis unavailable', {
        namespace,
        userId: req.user.userId,
        error: (err as Error).message,
      });
      next();
    }
  };
}
