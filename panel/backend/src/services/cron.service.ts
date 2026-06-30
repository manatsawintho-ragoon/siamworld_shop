import cron from 'node-cron';
import { redis } from '../database/redis';
import { notificationService } from './notification.service';
import { activityService } from './activity.service';

// Telemetry rows (page views / feature clicks) are kept this many days, then pruned.
const ACTIVITY_RETENTION_DAYS = 90;

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

  // Run hourly — suspend shops overdue past the (short) grace period. Hourly instead of
  // once-at-02:00 so an expired shop actually goes down within the hour, not up to a full
  // day later. The Redis lock keeps multi-replica runs from double-suspending.
  cron.schedule('0 * * * *', () => {
    withRedisLock('panel_cron_lock:suspend', 10 * 60, async () => {
      console.log('[Cron] Checking for expired shops to suspend...');
      await notificationService.suspendExpired();
    }).catch(err => console.error('[Cron] suspend failed:', err));
  });

  // Run daily at 03:00 — permanently delete shops suspended and unrenewed past the
  // delete threshold (default 7 days). DESTRUCTIVE; guarded to status='suspended' only.
  cron.schedule('0 3 * * *', () => {
    withRedisLock('panel_cron_lock:delete', 30 * 60, async () => {
      console.log('[Cron] Checking for long-suspended shops to permanently delete...');
      await notificationService.deleteExpired();
    }).catch(err => console.error('[Cron] delete failed:', err));
  });

  // Run daily at 04:00 — prune old activity-telemetry rows from audit_logs.
  // Only category='activity' rows are touched; accountability rows are kept indefinitely.
  cron.schedule('0 4 * * *', () => {
    withRedisLock('panel_cron_lock:prune_activity', 30 * 60, async () => {
      const removed = await activityService.pruneActivity(ACTIVITY_RETENTION_DAYS);
      console.log(`[Cron] Pruned ${removed} activity rows older than ${ACTIVITY_RETENTION_DAYS}d.`);
    }).catch(err => console.error('[Cron] prune_activity failed:', err));
  });

  console.log('[Cron] Jobs scheduled (notify: 09:00 daily, suspend: hourly, delete: 03:00 daily, prune-activity: 04:00 daily)');
}

/** Exposed so other services (deploy port allocation, etc.) can reuse the same primitive. */
export { withRedisLock };
