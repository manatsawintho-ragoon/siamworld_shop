import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import { config } from '../config';
import { logger } from '../utils/logger';
import { settingsService } from './settings.service';

const execAsync = promisify(exec);

/** Where dumps live. Bind-mounted into panel-backend as /deploy, so it survives a rebuild. */
const ARCHIVE_DIR = path.join(config.deployDir, 'archives');

/** How long a customer can still download their data after teardown. */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * A shop name reaches here from the subscriptions table, but it is interpolated
 * into a shell command, so re-validate at the boundary rather than trusting the
 * caller. Matches the charset new-customer.sh allows.
 */
const SHOP_NAME_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;

/** Archive file names are generated here; anything else must not resolve to a path. */
const FILE_NAME_RE = /^[a-z0-9-]+-\d{8}-\d{6}\.sql\.gz$/;

export interface ArchiveRow extends RowDataPacket {
  id: number;
  user_id: number;
  shop_name: string;
  domain: string;
  file_name: string;
  size_bytes: number;
  reason: 'expired' | 'admin_delete' | 'manual';
  created_at: Date;
  expires_at: Date;
  downloaded_at: Date | null;
}

class ArchiveService {
  private async retentionDays(): Promise<number> {
    const raw = await settingsService.get('archive_retention_days');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
  }

  /**
   * Dump a shop's database to a gzipped file and record it.
   *
   * Called from deployService.removeShop() so it covers every teardown path
   * (the expiry cron and the admin delete button alike) rather than relying on
   * each caller to remember.
   *
   * Never throws: a failed dump must not block the teardown it precedes, or a
   * shop whose MySQL is already dead could never be removed and would sit on
   * disk forever. Returns null when nothing was archived.
   */
  async createArchive(
    shopName: string,
    opts: { userId: number; domain: string; reason?: ArchiveRow['reason'] }
  ): Promise<{ fileName: string; sizeBytes: number } | null> {
    if (!SHOP_NAME_RE.test(shopName)) {
      logger.error(`[Archive] Refusing to archive suspicious shop name: ${shopName}`);
      return null;
    }

    const container = `sw-${shopName}-mysql-1`;
    try {
      const { stdout: state } = await execAsync(
        `docker inspect "${container}" --format '{{.State.Status}}' 2>/dev/null || echo missing`
      );
      const status = state.trim();
      // A suspended shop's MySQL is stopped, not gone. Start it just long enough
      // to dump, then leave it as we found it.
      const wasStopped = status === 'exited' || status === 'created';
      if (status === 'missing') {
        logger.warn(`[Archive] ${shopName}: no MySQL container, nothing to archive`);
        return null;
      }
      if (wasStopped) {
        await execAsync(`docker start "${container}"`, { timeout: 60000 });
        await this.waitForMysql(container);
      }

      await fsp.mkdir(ARCHIVE_DIR, { recursive: true });
      // YYYYMMDD-HHMMSS. Take exactly 14 digits: slicing one further would keep
      // the millisecond dot and the name would stop matching FILE_NAME_RE,
      // making the archive undownloadable.
      const stamp = new Date().toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 14)
        .replace(/^(\d{8})(\d{6})$/, '$1-$2');
      const fileName = `${shopName}-${stamp}.sql.gz`;
      const outPath = path.join(ARCHIVE_DIR, fileName);

      // --single-transaction keeps the dump consistent without locking the shop
      // out mid-write; --routines/--events so a restore is actually complete.
      await execAsync(
        `docker exec "${container}" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" ` +
          `--single-transaction --routines --events --databases "$MYSQL_DATABASE"' ` +
          `| gzip -9 > "${outPath}"`,
        { timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024 * 64, shell: '/bin/bash' }
      );

      const { size } = await fsp.stat(outPath);
      // gzip of an empty/failed dump is still ~20 bytes, so treat a tiny file as
      // a failure rather than handing the customer a useless archive.
      if (size < 1024) {
        await fsp.rm(outPath, { force: true });
        logger.error(`[Archive] ${shopName}: dump was ${size} bytes, discarding`);
        return null;
      }

      const days = await this.retentionDays();
      await pool.execute(
        `INSERT INTO shop_archives (user_id, shop_name, domain, file_name, size_bytes, reason, expires_at)
         VALUES (?,?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [opts.userId, shopName, opts.domain, fileName, size, opts.reason ?? 'expired', days]
      );

      if (wasStopped) {
        await execAsync(`docker stop "${container}"`, { timeout: 60000 }).catch(() => { /* best effort */ });
      }

      logger.info(`[Archive] ${shopName}: ${fileName} (${(size / 1048576).toFixed(1)}MB, kept ${days}d)`);
      return { fileName, sizeBytes: size };
    } catch (err) {
      logger.error(`[Archive] ${shopName} failed:`, (err as Error).message);
      return null;
    }
  }

  /** Poll until mysqladmin ping succeeds, so the dump does not race a cold start. */
  private async waitForMysql(container: string, attempts = 20): Promise<void> {
    for (let i = 0; i < attempts; i++) {
      try {
        await execAsync(
          `docker exec "${container}" sh -c 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent'`,
          { timeout: 10000 }
        );
        return;
      } catch {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    throw new Error(`${container} did not become ready`);
  }

  async listForUser(userId: number): Promise<ArchiveRow[]> {
    const [rows] = await pool.execute<ArchiveRow[]>(
      `SELECT * FROM shop_archives WHERE user_id=? AND expires_at > NOW() ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  async listAll(): Promise<ArchiveRow[]> {
    const [rows] = await pool.execute<ArchiveRow[]>(
      `SELECT * FROM shop_archives ORDER BY created_at DESC LIMIT 200`
    );
    return rows;
  }

  /**
   * Resolve an archive to an on-disk path for download.
   *
   * `userId` scopes the lookup to the owner; admins pass null to bypass. The
   * file name is matched against the generated-name pattern AND the resolved
   * path is re-checked to be inside ARCHIVE_DIR, so a crafted name cannot walk
   * out of the directory even if the pattern is ever loosened.
   */
  async resolveForDownload(
    fileName: string,
    userId: number | null
  ): Promise<{ path: string; row: ArchiveRow } | null> {
    if (!FILE_NAME_RE.test(fileName)) return null;

    const sql = userId === null
      ? `SELECT * FROM shop_archives WHERE file_name=? AND expires_at > NOW()`
      : `SELECT * FROM shop_archives WHERE file_name=? AND expires_at > NOW() AND user_id=?`;
    const params = userId === null ? [fileName] : [fileName, userId];
    const [rows] = await pool.execute<ArchiveRow[]>(sql, params);
    if (!rows.length) return null;

    const full = path.resolve(ARCHIVE_DIR, fileName);
    if (!full.startsWith(path.resolve(ARCHIVE_DIR) + path.sep)) return null;
    if (!fs.existsSync(full)) return null;

    await pool.execute('UPDATE shop_archives SET downloaded_at=NOW() WHERE id=?', [rows[0].id]);
    return { path: full, row: rows[0] };
  }

  /**
   * Delete archives past their retention date, and any file on disk with no
   * matching row. Without the second half a failed INSERT would strand the
   * dump forever, which is the exact class of leak this whole change is about.
   */
  async pruneExpired(): Promise<{ rows: number; orphanFiles: number }> {
    const [expired] = await pool.execute<ArchiveRow[]>(
      'SELECT * FROM shop_archives WHERE expires_at <= NOW()'
    );
    for (const row of expired) {
      await fsp.rm(path.join(ARCHIVE_DIR, row.file_name), { force: true }).catch(() => { /* already gone */ });
    }
    const [res] = await pool.execute<ResultSetHeader>(
      'DELETE FROM shop_archives WHERE expires_at <= NOW()'
    );

    let orphanFiles = 0;
    try {
      const [known] = await pool.execute<ArchiveRow[]>('SELECT file_name FROM shop_archives');
      const keep = new Set(known.map(r => r.file_name));
      for (const f of await fsp.readdir(ARCHIVE_DIR)) {
        if (!f.endsWith('.sql.gz') || keep.has(f)) continue;
        await fsp.rm(path.join(ARCHIVE_DIR, f), { force: true });
        orphanFiles++;
      }
    } catch { /* dir may not exist yet */ }

    return { rows: res.affectedRows, orphanFiles };
  }

  /** Total bytes currently held in archives, for the storage dashboard. */
  async totalBytes(): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(size_bytes),0) AS total FROM shop_archives'
    );
    return Number(rows[0]?.total ?? 0);
  }
}

export const archiveService = new ArchiveService();
