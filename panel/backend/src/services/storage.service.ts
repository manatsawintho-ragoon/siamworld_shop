import { exec } from 'child_process';
import { promisify } from 'util';
import { RowDataPacket } from 'mysql2';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { archiveService } from './archive.service';

const execAsync = promisify(exec);

/**
 * Disk accounting for the host.
 *
 * The VPS reached 88% before anyone noticed, because nothing reported on it:
 * a removed customer's images stayed behind indefinitely and there was no
 * surface showing that. This service is what makes that visible, and the
 * thresholds are what make it noisy before it is urgent.
 */
export interface OrphanImage { repository: string; sizeBytes: number; }

export interface StorageReport {
  disk: { totalBytes: number; usedBytes: number; availBytes: number; usedPercent: number };
  docker: { imagesBytes: number; volumesBytes: number; buildCacheBytes: number; reclaimableBytes: number };
  archivesBytes: number;
  orphanImages: OrphanImage[];
  shops: { shopName: string; status: string; volumeBytes: number }[];
  level: 'ok' | 'warn' | 'critical';
  generatedAt: string;
}

const WARN_PERCENT = 75;
const CRITICAL_PERCENT = 85;

/** `docker system df` prints human sizes; turn "1.234GB" into bytes. */
function parseSize(s: string): number {
  const m = /^([\d.]+)\s*([KMGT]?)i?B$/i.exec(s.trim());
  if (!m) return 0;
  const mult: Record<string, number> = { '': 1, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };
  return Math.round(parseFloat(m[1]) * (mult[m[2].toUpperCase()] ?? 1));
}

class StorageService {
  private cache: StorageReport | null = null;
  private cacheTs = 0;
  /** Shelling out to docker/du is not free; a minute of staleness is fine for a dashboard. */
  private TTL = 60_000;

  async getReport(force = false): Promise<StorageReport> {
    if (!force && this.cache && Date.now() - this.cacheTs < this.TTL) return this.cache;

    const [disk, docker, orphanImages, shops, archivesBytes] = await Promise.all([
      this.disk(),
      this.docker(),
      this.orphanImages(),
      this.shopVolumes(),
      archiveService.totalBytes().catch(() => 0),
    ]);

    const level: StorageReport['level'] =
      disk.usedPercent >= CRITICAL_PERCENT ? 'critical'
      : disk.usedPercent >= WARN_PERCENT ? 'warn'
      : 'ok';

    this.cache = { disk, docker, orphanImages, shops, archivesBytes, level, generatedAt: new Date().toISOString() };
    this.cacheTs = Date.now();
    return this.cache;
  }

  private async disk() {
    // -B1 gives bytes, so there is nothing to parse loosely.
    const { stdout } = await execAsync("df -B1 --output=size,used,avail,pcent / | tail -1");
    const [size, used, avail, pcent] = stdout.trim().split(/\s+/);
    return {
      totalBytes: Number(size) || 0,
      usedBytes: Number(used) || 0,
      availBytes: Number(avail) || 0,
      usedPercent: parseInt(pcent, 10) || 0,
    };
  }

  private async docker() {
    const empty = { imagesBytes: 0, volumesBytes: 0, buildCacheBytes: 0, reclaimableBytes: 0 };
    try {
      const { stdout } = await execAsync('docker system df --format "{{.Type}}|{{.Size}}|{{.Reclaimable}}"');
      const out = { ...empty };
      for (const line of stdout.trim().split('\n')) {
        const [type, size, reclaimable] = line.split('|');
        const bytes = parseSize(size ?? '');
        // Reclaimable reads like "7.91GB (52%)"; the size is the leading token.
        const rec = parseSize((reclaimable ?? '').split(' ')[0] ?? '');
        if (type === 'Images') out.imagesBytes = bytes;
        else if (type === 'Local Volumes') out.volumesBytes = bytes;
        else if (type === 'Build Cache') out.buildCacheBytes = bytes;
        out.reclaimableBytes += rec;
      }
      return out;
    } catch (err) {
      logger.error('[Storage] docker system df failed:', (err as Error).message);
      return empty;
    }
  }

  /**
   * Shop images with no subscription behind them. This is the leak that filled
   * the disk, so it gets its own line on the dashboard rather than being buried
   * in a reclaimable total.
   *
   * Mirrors deploy/sw-gc.sh: keep anything with a subscription row (ANY status,
   * so suspended shops survive) or a container.
   */
  private async orphanImages(): Promise<OrphanImage[]> {
    try {
      const [subs] = await pool.execute<RowDataPacket[]>('SELECT shop_name FROM subscriptions');
      // No rows means we cannot tell orphan from live; report nothing rather
      // than flagging the whole fleet for deletion.
      if (!subs.length) return [];
      const keep = new Set(subs.map(r => String(r.shop_name)));

      const { stdout: psOut } = await execAsync(`docker ps -a --format '{{.Names}}'`);
      for (const name of psOut.split('\n')) {
        const m = /^sw-(.+?)-(?:backend|frontend|mysql|redis)-1$/.exec(name.trim());
        if (m) keep.add(m[1]);
      }

      const { stdout } = await execAsync(`docker images --format '{{.Repository}}|{{.Size}}'`);
      const out: OrphanImage[] = [];
      for (const line of stdout.trim().split('\n')) {
        const [repo, size] = line.split('|');
        if (!repo?.startsWith('sw-')) continue;
        const shop = repo.replace(/^sw-/, '').replace(/-(backend|frontend)$/, '');
        if (keep.has(shop)) continue;
        out.push({ repository: repo, sizeBytes: parseSize(size ?? '') });
      }
      return out.sort((a, b) => b.sizeBytes - a.sizeBytes);
    } catch (err) {
      logger.error('[Storage] orphan scan failed:', (err as Error).message);
      return [];
    }
  }

  /** Per-shop MySQL volume footprint, so an outlier tenant is obvious. */
  private async shopVolumes() {
    try {
      const [subs] = await pool.execute<RowDataPacket[]>(
        'SELECT shop_name, status FROM subscriptions ORDER BY shop_name'
      );
      // `docker system df -v` already knows every volume's size. Reading it is
      // one call and needs no helper image; shelling out to `du` in a throwaway
      // container would silently re-pull a base image we deliberately removed.
      const sizes = new Map<string, number>();
      const { stdout } = await execAsync('docker system df -v --format "{{json .Volumes}}"', {
        maxBuffer: 1024 * 1024 * 8,
      });
      try {
        for (const v of JSON.parse(stdout.trim() || '[]') as { Name: string; Size: string }[]) {
          sizes.set(v.Name, parseSize(v.Size));
        }
      } catch { /* format varies by engine version; fall through to zeros */ }

      return subs.map(s => {
        const shop = String(s.shop_name);
        return {
          shopName: shop,
          status: String(s.status),
          volumeBytes:
            (sizes.get(`sw-${shop}_mysql_data`) ?? 0) +
            (sizes.get(`sw-${shop}_redis_data`) ?? 0) +
            (sizes.get(`sw-${shop}_image_cache`) ?? 0),
        };
      });
    } catch {
      return [];
    }
  }
}

export const storageService = new StorageService();
