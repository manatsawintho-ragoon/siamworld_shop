import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { RowDataPacket, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../database/connection';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { readNewLines, CursorState } from './log-cursor';
import {
  parseProxyLine, normalizePath, isBotUA, refererLabel, bucketHour, bucketDay,
} from '../../utils/trafficLog';

/**
 * Rolls NGINX Proxy Manager access logs up into per-shop traffic counters.
 *
 * One proxy host per shop means one access log per shop, and each log line
 * carries $host, so shops are identified by hostname rather than by NPM's
 * internal proxy-host id. That keeps us independent of NPM's own database and
 * makes BYOD custom domains work with no extra mapping.
 */

const gunzip = promisify(zlib.gunzip);

const ACCESS_LOG_RE = /^proxy-host-\d+_access\.log$/;

/** Values kept per shop per day per kind; the long tail is scanner noise. */
const TOP_N_PER_DAY = 50;

/** One INSERT per this many rows, so a first backfill cannot exceed max_allowed_packet. */
const UPSERT_CHUNK = 1000;

export const TRAFFIC_HOURLY_RETENTION_DAYS = 400;
export const TRAFFIC_DIM_RETENTION_DAYS = 30;

interface HourAgg {
  requests: number; bytes: number;
  s2xx: number; s3xx: number; s4xx: number; s5xx: number;
  bots: number;
}
interface DimAgg { requests: number; bytes: number; s4xx: number; s5xx: number; }

interface HourEntry { shop: string; hour: string; agg: HourAgg; }
interface DimEntry { shop: string; day: string; kind: string; value: string; agg: DimAgg; }

const newHour = (): HourAgg => ({ requests: 0, bytes: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, bots: 0 });
const newDim = (): DimAgg => ({ requests: 0, bytes: 0, s4xx: 0, s5xx: 0 });

/**
 * Aggregates for one ingest pass, collapsed so each distinct bucket becomes a
 * single upsert row.
 *
 * Each entry carries its own key fields. Recovering them by splitting the map
 * key would be a trap: bucketHour() renders a MySQL DATETIME, which contains a
 * space, and a path or referrer value can contain almost anything. The map key
 * exists only to establish uniqueness, and nothing is ever parsed back out of it.
 */
class Batch {
  hours = new Map<string, HourEntry>();
  dims = new Map<string, DimEntry>();

  addRequest(shop: string, selfHost: string, line: string): boolean {
    const r = parseProxyLine(line);
    if (!r) return false;

    const hour = bucketHour(r.ts);
    const hKey = [shop, hour].join('|');
    const entry = this.hours.get(hKey) ?? { shop, hour, agg: newHour() };
    const h = entry.agg;
    h.requests++;
    h.bytes += r.bytesSent;
    if (r.status >= 500) h.s5xx++;
    else if (r.status >= 400) h.s4xx++;
    else if (r.status >= 300) h.s3xx++;
    else if (r.status >= 200) h.s2xx++;
    if (isBotUA(r.userAgent)) h.bots++;
    this.hours.set(hKey, entry);

    const day = bucketDay(r.ts);
    this.addDim(shop, day, 'path', normalizePath(r.uri), r);
    this.addDim(shop, day, 'referrer', refererLabel(r.referer, selfHost), r);
    return true;
  }

  private addDim(
    shop: string, day: string, kind: string, value: string,
    r: { bytesSent: number; status: number },
  ): void {
    const key = [shop, day, kind, value].join('|');
    const entry = this.dims.get(key) ?? { shop, day, kind, value, agg: newDim() };
    const d = entry.agg;
    d.requests++;
    d.bytes += r.bytesSent;
    if (r.status >= 500) d.s5xx++;
    else if (r.status >= 400) d.s4xx++;
    this.dims.set(key, entry);
  }
}

export interface IngestSummary {
  filesScanned: number;
  linesParsed: number;
  linesSkipped: number;
  shopsTouched: number;
}

export interface OverviewShop {
  shopName: string;
  domain: string | null;
  status: string | null;
  requests: number;
  bytesSent: number;
  s4xx: number;
  s5xx: number;
  botRequests: number;
  series: { day: string; requests: number }[];
}

class TrafficService {
  /** hostname -> shop_name, covering both the siamsite subdomain and any custom domain. */
  private async hostMap(): Promise<Map<string, string>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT shop_name, domain, custom_domain FROM subscriptions',
    );
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.domain) m.set(String(r.domain).toLowerCase(), r.shop_name);
      if (r.custom_domain) m.set(String(r.custom_domain).toLowerCase(), r.shop_name);
    }
    return m;
  }

  private async cursors(): Promise<Map<string, CursorState>> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT log_file, inode, byte_offset FROM traffic_cursor',
    );
    return new Map(
      rows.map(r => [r.log_file as string, { inode: Number(r.inode), offset: Number(r.byte_offset) }]),
    );
  }

  /**
   * Read every proxy-host access log forward from its cursor and roll the new
   * lines into the counters.
   *
   * Per file, the cursor advance and the counter upserts commit in one
   * transaction. The upserts are `counter = counter + VALUES(...)`, which is not
   * idempotent, so a crash between writing counters and advancing the cursor
   * would double-count on the next pass. Sharing a transaction closes that
   * window; the Redis lock around the cron job closes the concurrent-run one.
   */
  async ingest(): Promise<IngestSummary> {
    const summary: IngestSummary = {
      filesScanned: 0, linesParsed: 0, linesSkipped: 0, shopsTouched: 0,
    };

    let entries: string[];
    try {
      entries = (await fs.readdir(config.npmLogDir)).filter(f => ACCESS_LOG_RE.test(f));
    } catch (err) {
      logger.warn(
        `[Traffic] Cannot read ${config.npmLogDir}; is the npm_data volume mounted? ${(err as Error).message}`,
      );
      return summary;
    }

    const [hosts, cursors] = await Promise.all([this.hostMap(), this.cursors()]);
    const touched = new Set<string>();

    for (const file of entries) {
      const full = path.join(config.npmLogDir, file);
      const prev = cursors.get(file) ?? null;

      let result;
      try {
        result = await readNewLines(full, prev);
      } catch (err) {
        logger.warn(`[Traffic] Failed reading ${file}: ${(err as Error).message}`);
        continue;
      }
      if (result.missing) continue;
      summary.filesScanned++;

      // First sight of this log: pull in the rotated archives too, so the
      // feature has history the day it ships rather than a week later.
      const carried = prev === null ? await this.backfillLines(full) : [];
      const lines = carried.concat(result.lines);
      if (lines.length === 0 && prev !== null) continue;

      const batch = new Batch();
      for (const line of lines) {
        const parsed = parseProxyLine(line);
        // A line whose host maps to no subscription is the panel itself, the
        // fallback vhost, or a shop that has since been removed. Not an error.
        const shop = parsed ? hosts.get(parsed.host) : undefined;
        if (!parsed || !shop) { summary.linesSkipped++; continue; }
        if (batch.addRequest(shop, parsed.host, line)) {
          summary.linesParsed++;
          touched.add(shop);
        } else {
          summary.linesSkipped++;
        }
      }

      await this.commit(file, result.inode, result.offset, batch);

      if (result.cappedAt) {
        logger.info(`[Traffic] ${file} hit the per-pass byte cap; continuing next run.`);
      }
    }

    summary.shopsTouched = touched.size;
    return summary;
  }

  /** Uncompressed contents of this log's rotated archives, oldest generation first. */
  private async backfillLines(logPath: string): Promise<string[]> {
    const out: string[] = [];

    // logrotate keeps 4 weekly generations; .4 is the oldest.
    for (let i = 4; i >= 1; i--) {
      for (const candidate of [`${logPath}.${i}.gz`, `${logPath}.${i}`]) {
        let raw: Buffer;
        try {
          raw = await fs.readFile(candidate);
        } catch {
          continue;
        }
        try {
          const content = candidate.endsWith('.gz') ? Buffer.from(await gunzip(raw)) : raw;
          for (const l of content.toString('utf8').split('\n')) {
            if (l.length > 0) out.push(l);
          }
        } catch {
          logger.warn(`[Traffic] Skipping unreadable archive ${path.basename(candidate)}`);
        }
        break; // one generation, either compressed or not
      }
    }
    if (out.length) {
      logger.info(`[Traffic] Backfilled ${out.length} archived lines for ${path.basename(logPath)}`);
    }
    return out;
  }

  private async commit(file: string, inode: number, offset: number, batch: Batch): Promise<void> {
    const conn: PoolConnection = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const hourRows = [...batch.hours.values()].map(e => [
        e.shop, e.hour, e.agg.requests, e.agg.bytes,
        e.agg.s2xx, e.agg.s3xx, e.agg.s4xx, e.agg.s5xx, e.agg.bots,
      ]);
      for (let i = 0; i < hourRows.length; i += UPSERT_CHUNK) {
        await conn.query(
          `INSERT INTO traffic_hourly
             (shop_name, bucket_hour, requests, bytes_sent, s2xx, s3xx, s4xx, s5xx, bot_requests)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             requests     = requests     + VALUES(requests),
             bytes_sent   = bytes_sent   + VALUES(bytes_sent),
             s2xx         = s2xx         + VALUES(s2xx),
             s3xx         = s3xx         + VALUES(s3xx),
             s4xx         = s4xx         + VALUES(s4xx),
             s5xx         = s5xx         + VALUES(s5xx),
             bot_requests = bot_requests + VALUES(bot_requests)`,
          [[hourRows.slice(i, i + UPSERT_CHUNK)]],
        );
      }

      const dimRows = [...batch.dims.values()].map(e => [
        e.shop, e.day, e.kind, e.value, e.agg.requests, e.agg.bytes, e.agg.s4xx, e.agg.s5xx,
      ]);
      for (let i = 0; i < dimRows.length; i += UPSERT_CHUNK) {
        await conn.query(
          `INSERT INTO traffic_dim_daily
             (shop_name, bucket_day, kind, value, requests, bytes_sent, s4xx, s5xx)
           VALUES ?
           ON DUPLICATE KEY UPDATE
             requests   = requests   + VALUES(requests),
             bytes_sent = bytes_sent + VALUES(bytes_sent),
             s4xx       = s4xx       + VALUES(s4xx),
             s5xx       = s5xx       + VALUES(s5xx)`,
          [[dimRows.slice(i, i + UPSERT_CHUNK)]],
        );
      }

      await conn.query(
        `INSERT INTO traffic_cursor (log_file, inode, byte_offset)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE inode = VALUES(inode), byte_offset = VALUES(byte_offset)`,
        [file, inode, offset],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Keep only the busiest values per shop/day/kind. Without this the long tail
   * of vulnerability-scanner probes would dominate the row count while telling
   * an operator nothing the 4xx counter does not already say.
   */
  async pruneDimensions(): Promise<number> {
    const [groups] = await pool.query<RowDataPacket[]>(
      `SELECT shop_name, bucket_day, kind FROM traffic_dim_daily
        GROUP BY shop_name, bucket_day, kind HAVING COUNT(*) > ?`,
      [TOP_N_PER_DAY],
    );

    let removed = 0;
    for (const g of groups) {
      const [cut] = await pool.query<RowDataPacket[]>(
        `SELECT requests FROM traffic_dim_daily
          WHERE shop_name = ? AND bucket_day = ? AND kind = ?
          ORDER BY requests DESC LIMIT 1 OFFSET ?`,
        [g.shop_name, g.bucket_day, g.kind, TOP_N_PER_DAY - 1],
      );
      if (!cut.length) continue;
      const [res] = await pool.query<ResultSetHeader>(
        `DELETE FROM traffic_dim_daily
          WHERE shop_name = ? AND bucket_day = ? AND kind = ? AND requests < ?`,
        [g.shop_name, g.bucket_day, g.kind, cut[0].requests],
      );
      removed += res.affectedRows;
    }
    return removed;
  }

  async pruneOld(): Promise<{ hourly: number; dims: number }> {
    const [h] = await pool.query<ResultSetHeader>(
      'DELETE FROM traffic_hourly WHERE bucket_hour < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [TRAFFIC_HOURLY_RETENTION_DAYS],
    );
    const [d] = await pool.query<ResultSetHeader>(
      'DELETE FROM traffic_dim_daily WHERE bucket_day < DATE_SUB(CURDATE(), INTERVAL ? DAY)',
      [TRAFFIC_DIM_RETENTION_DAYS],
    );
    return { hourly: h.affectedRows, dims: d.affectedRows };
  }

  // ── Read side ────────────────────────────────────────────────

  /**
   * One row per shop with traffic in the window, plus fleet totals.
   *
   * LEFT JOIN, not INNER: traffic outlives the subscription row on purpose, so a
   * churned shop's history stays answerable. Such rows come back with a null
   * status and the UI marks them as removed.
   */
  async overview(days: number): Promise<{
    days: number; shops: OverviewShop[];
    totals: { requests: number; bytesSent: number; s4xx: number; s5xx: number; botRequests: number };
    generatedAt: string;
  }> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.shop_name         AS shopName,
              s.domain            AS domain,
              s.custom_domain     AS customDomain,
              s.status            AS status,
              SUM(t.requests)     AS requests,
              SUM(t.bytes_sent)   AS bytesSent,
              SUM(t.s4xx)         AS s4xx,
              SUM(t.s5xx)         AS s5xx,
              SUM(t.bot_requests) AS botRequests
         FROM traffic_hourly t
         LEFT JOIN subscriptions s ON s.shop_name = t.shop_name
        WHERE t.bucket_hour >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY t.shop_name, s.domain, s.custom_domain, s.status
        ORDER BY requests DESC`,
      [days],
    );

    const [spark] = await pool.query<RowDataPacket[]>(
      `SELECT shop_name AS shopName, DATE(bucket_hour) AS day, SUM(requests) AS requests
         FROM traffic_hourly
        WHERE bucket_hour >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY shop_name, DATE(bucket_hour)
        ORDER BY day ASC`,
      [days],
    );

    const byShop = new Map<string, { day: string; requests: number }[]>();
    for (const s of spark) {
      const list = byShop.get(s.shopName as string) ?? [];
      list.push({ day: toDayString(s.day), requests: Number(s.requests) });
      byShop.set(s.shopName as string, list);
    }

    const shops: OverviewShop[] = rows.map(r => ({
      shopName: r.shopName as string,
      domain: (r.customDomain || r.domain || null) as string | null,
      status: (r.status ?? null) as string | null,
      requests: Number(r.requests),
      bytesSent: Number(r.bytesSent),
      s4xx: Number(r.s4xx),
      s5xx: Number(r.s5xx),
      botRequests: Number(r.botRequests),
      series: byShop.get(r.shopName as string) ?? [],
    }));

    const totals = shops.reduce(
      (a, s) => ({
        requests: a.requests + s.requests,
        bytesSent: a.bytesSent + s.bytesSent,
        s4xx: a.s4xx + s.s4xx,
        s5xx: a.s5xx + s.s5xx,
        botRequests: a.botRequests + s.botRequests,
      }),
      { requests: 0, bytesSent: 0, s4xx: 0, s5xx: 0, botRequests: 0 },
    );

    return { days, shops, totals, generatedAt: new Date().toISOString() };
  }

  async shopDetail(shopName: string, days: number) {
    const [sub] = await pool.query<RowDataPacket[]>(
      `SELECT shop_name, domain, custom_domain, status, expires_at
         FROM subscriptions WHERE shop_name = ? LIMIT 1`,
      [shopName],
    );

    const [hourly] = await pool.query<RowDataPacket[]>(
      `SELECT bucket_hour AS bucket, requests, bytes_sent AS bytesSent,
              s2xx, s3xx, s4xx, s5xx, bot_requests AS botRequests
         FROM traffic_hourly
        WHERE shop_name = ? AND bucket_hour >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY bucket_hour ASC`,
      [shopName, days],
    );

    const [paths] = await pool.query<RowDataPacket[]>(
      `SELECT value, SUM(requests) AS requests, SUM(bytes_sent) AS bytesSent,
              SUM(s4xx) AS s4xx, SUM(s5xx) AS s5xx
         FROM traffic_dim_daily
        WHERE shop_name = ? AND kind = 'path'
          AND bucket_day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY value ORDER BY requests DESC LIMIT 25`,
      [shopName, days],
    );

    const [referrers] = await pool.query<RowDataPacket[]>(
      `SELECT value, SUM(requests) AS requests
         FROM traffic_dim_daily
        WHERE shop_name = ? AND kind = 'referrer'
          AND bucket_day >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY value ORDER BY requests DESC LIMIT 15`,
      [shopName, days],
    );

    const series = hourly.map(h => ({
      bucket: toBucketString(h.bucket),
      requests: Number(h.requests),
      bytesSent: Number(h.bytesSent),
      s2xx: Number(h.s2xx),
      s3xx: Number(h.s3xx),
      s4xx: Number(h.s4xx),
      s5xx: Number(h.s5xx),
      botRequests: Number(h.botRequests),
    }));

    const totals = series.reduce(
      (a, s) => ({
        requests: a.requests + s.requests,
        bytesSent: a.bytesSent + s.bytesSent,
        s2xx: a.s2xx + s.s2xx,
        s3xx: a.s3xx + s.s3xx,
        s4xx: a.s4xx + s.s4xx,
        s5xx: a.s5xx + s.s5xx,
        botRequests: a.botRequests + s.botRequests,
      }),
      { requests: 0, bytesSent: 0, s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, botRequests: 0 },
    );

    const peak = series.reduce<{ bucket: string; requests: number } | null>(
      (best, s) => (!best || s.requests > best.requests ? { bucket: s.bucket, requests: s.requests } : best),
      null,
    );

    const s = sub[0];
    return {
      shopName,
      domain: (s?.custom_domain || s?.domain || null) as string | null,
      status: (s?.status ?? null) as string | null,
      removed: !s,
      days,
      series,
      totals,
      peak,
      topPaths: paths.map(p => ({
        value: p.value as string,
        requests: Number(p.requests),
        bytesSent: Number(p.bytesSent),
        s4xx: Number(p.s4xx),
        s5xx: Number(p.s5xx),
      })),
      topReferrers: referrers.map(r => ({ value: r.value as string, requests: Number(r.requests) })),
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * mysql2 returns DATE/DATETIME as JS Date objects built from the server's
 * wall-clock reading. Buckets were written in Bangkok wall-clock, so the local
 * fields are already the values we want; formatting them with getUTC* here
 * would shift every label by the container's offset.
 */
function toDayString(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v);
}

function toBucketString(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${toDayString(v)} ${p(v.getHours())}:00:00`;
  }
  return String(v);
}

export const trafficService = new TrafficService();
