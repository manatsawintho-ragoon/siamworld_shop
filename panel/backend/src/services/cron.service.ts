import { logger } from '../utils/logger';
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
      logger.info(`[Cron] Lock ${lockKey} held by another replica; skipping this run.`);
      return false;
    }
    acquired = true;
    await fn();
    return true;
  } catch (err) {
    logger.error(`[Cron] Job ${lockKey} failed:`, err);
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
      logger.info('[Cron] Running expiry notifications...');
      await notificationService.sendExpiryNotifications();
    }).catch(err => logger.error('[Cron] notify failed:', err));
  });

  // Run hourly — suspend shops overdue past the (short) grace period. Hourly instead of
  // once-at-02:00 so an expired shop actually goes down within the hour, not up to a full
  // day later. The Redis lock keeps multi-replica runs from double-suspending.
  cron.schedule('0 * * * *', () => {
    withRedisLock('panel_cron_lock:suspend', 10 * 60, async () => {
      logger.info('[Cron] Checking for expired shops to suspend...');
      await notificationService.suspendExpired();
    }).catch(err => logger.error('[Cron] suspend failed:', err));
  });

  // Run daily at 03:00 — permanently delete shops suspended and unrenewed past the
  // delete threshold (default 7 days). DESTRUCTIVE; guarded to status='suspended' only.
  cron.schedule('0 3 * * *', () => {
    withRedisLock('panel_cron_lock:delete', 30 * 60, async () => {
      logger.info('[Cron] Checking for long-suspended shops to permanently delete...');
      await notificationService.deleteExpired();
    }).catch(err => logger.error('[Cron] delete failed:', err));
  });

  // Run daily at 04:00 — prune old activity-telemetry rows from audit_logs.
  // Only category='activity' rows are touched; accountability rows are kept indefinitely.
  cron.schedule('0 4 * * *', () => {
    withRedisLock('panel_cron_lock:prune_activity', 30 * 60, async () => {
      const removed = await activityService.pruneActivity(ACTIVITY_RETENTION_DAYS);
      logger.info(`[Cron] Pruned ${removed} activity rows older than ${ACTIVITY_RETENTION_DAYS}d.`);
    }).catch(err => logger.error('[Cron] prune_activity failed:', err));
  });

  // Run daily at 04:30 — drop expired shop archives, and any dump file left on
  // disk without a row. A retention feature that never collects is just a
  // slower version of the leak it replaced.
  cron.schedule('30 4 * * *', () => {
    withRedisLock('panel_cron_lock:prune_archives', 30 * 60, async () => {
      const { archiveService } = await import('./archive.service');
      const { rows, orphanFiles } = await archiveService.pruneExpired();
      if (rows || orphanFiles) {
        logger.info(`[Cron] Pruned ${rows} expired archive(s) and ${orphanFiles} orphan file(s).`);
      }
    }).catch(err => logger.error('[Cron] prune_archives failed:', err));
  });

  // Every 10 minutes — roll new NPM access-log lines into per-shop traffic
  // counters. Cheap: the busiest shop writes ~2.7MB/day, so a pass reads tens of
  // kilobytes. The lock matters more than usual here because the rollup upserts
  // are additive, so a concurrent second run would double-count.
  cron.schedule('*/10 * * * *', () => {
    withRedisLock('panel_cron_lock:traffic_ingest', 9 * 60, async () => {
      const { trafficService } = await import('./traffic/traffic.service');
      const s = await trafficService.ingest();
      if (s.linesParsed) {
        logger.info(
          `[Cron] Traffic: ${s.linesParsed} lines across ${s.shopsTouched} shop(s) ` +
          `from ${s.filesScanned} log(s), ${s.linesSkipped} skipped.`,
        );
      }
    }).catch(err => logger.error('[Cron] traffic_ingest failed:', err));
  });

  // Run daily at 04:15 — trim traffic rollups: drop the long tail of scanner
  // probes from the daily dimensions, then drop rows past retention.
  cron.schedule('15 4 * * *', () => {
    withRedisLock('panel_cron_lock:prune_traffic', 30 * 60, async () => {
      const { trafficService } = await import('./traffic/traffic.service');
      const trimmed = await trafficService.pruneDimensions();
      const { hourly, dims } = await trafficService.pruneOld();
      logger.info(`[Cron] Traffic prune: ${trimmed} tail row(s), ${hourly} hourly, ${dims} daily expired.`);
    }).catch(err => logger.error('[Cron] prune_traffic failed:', err));
  });

  // Run daily at 05:30 — report disk pressure while it is still cheap to fix.
  // The VPS reached 88% with nobody watching; this is the tripwire.
  cron.schedule('30 5 * * *', () => {
    withRedisLock('panel_cron_lock:disk_check', 10 * 60, async () => {
      const { storageService } = await import('./storage.service');
      const r = await storageService.getReport(true);
      const orphanBytes = r.orphanImages.reduce((n, i) => n + i.sizeBytes, 0);
      const msg = `[Cron] Disk ${r.disk.usedPercent}% used, ${r.orphanImages.length} orphan image(s) ` +
                  `(${(orphanBytes / 1e9).toFixed(2)}GB), ${(r.docker.reclaimableBytes / 1e9).toFixed(2)}GB reclaimable.`;
      if (r.level === 'critical') logger.error(msg);
      else if (r.level === 'warn') logger.warn(msg);
      else logger.info(msg);
    }).catch(err => logger.error('[Cron] disk_check failed:', err));
  });

  logger.info('[Cron] Jobs scheduled (notify: 09:00, suspend: hourly, delete: 03:00, traffic-ingest: */10min, prune-activity: 04:00, prune-traffic: 04:15, prune-archives: 04:30, disk-check: 05:30)');
}

/** Exposed so other services (deploy port allocation, etc.) can reuse the same primitive. */
export { withRedisLock };
