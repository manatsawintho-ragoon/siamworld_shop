import cron from 'node-cron';
import { redis } from '../database/redis';
import { notificationService } from './notification.service';

/**
 * Run `fn` only if we can acquire `lockKey` in Redis. Prevents multi-replica double-runs
 * for daily jobs. Lock TTL is a fail-safe in case the process crashes mid-run.
 */
async function withRedisLock(lockKey: string, ttlSec: number, fn: () => Promise<void>): Promise<boolean> {
  let acquired = false;
  try {
    const res = await redis.set(lockKey, `${process.pid}@${Date.now()}`, 'EX', ttlSec, 'NX');
    if (!res) {
      console.log(`[Cron] Lock ${lockKey} held by another replica; skipping this run.`);
      return false;
    }
    acquired = true;
    await fn();
    return true;
  } catch (err) {
    console.error(`[Cron] Job ${lockKey} failed:`, err);
    throw err;
  } finally {
    if (acquired) {
      try { await redis.del(lockKey); } catch { /* TTL will reap it */ }
    }
  }
}

export function startCronJobs(): void {
  // Run daily at 09:00 — check expiry & send LINE notifications
  cron.schedule('0 9 * * *', () => {
    withRedisLock('panel_cron_lock:notify', 30 * 60, async () => {
      console.log('[Cron] Running expiry notifications...');
      await notificationService.sendExpiryNotifications();
    }).catch(err => console.error('[Cron] notify failed:', err));
  });

  // Run daily at 02:00 — suspend shops overdue by grace period
  cron.schedule('0 2 * * *', () => {
    withRedisLock('panel_cron_lock:suspend', 30 * 60, async () => {
      console.log('[Cron] Checking for expired shops to suspend...');
      await notificationService.suspendExpired();
    }).catch(err => console.error('[Cron] suspend failed:', err));
  });

  console.log('[Cron] Jobs scheduled (notify: 09:00, suspend: 02:00)');
}

/** Exposed so other services (deploy port allocation, etc.) can reuse the same primitive. */
export { withRedisLock };
