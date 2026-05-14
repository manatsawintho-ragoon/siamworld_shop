import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';

class SettingsService {
  private cache: Record<string, string> = {};
  private cacheTs = 0;
  private TTL = 60_000; // 1 min

  async getAll(): Promise<Record<string, string>> {
    if (Date.now() - this.cacheTs < this.TTL) return this.cache;
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT `key`, `value` FROM panel_settings');
    const result: Record<string, string> = {};
    for (const r of rows) result[r.key] = r.value ?? '';
    this.cache = result;
    this.cacheTs = Date.now();
    return result;
  }

  async get(key: string): Promise<string> {
    const all = await this.getAll();
    return all[key] ?? '';
  }

  async set(key: string, value: string): Promise<void> {
    await pool.execute(
      'INSERT INTO panel_settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=?, updated_at=NOW()',
      [key, value, value]
    );
    this.cache[key] = value;
  }

  async setMany(data: Record<string, string>): Promise<void> {
    if (!Object.keys(data).length) return;
    const values = Object.entries(data)
      .map(([k, v]) => `(${pool.escape(k)}, ${pool.escape(v)})`)
      .join(',');
    await pool.execute(
      `INSERT INTO panel_settings (\`key\`, \`value\`) VALUES ${values}
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = NOW()`
    );
    this.cacheTs = 0; // invalidate
  }
}

export const settingsService = new SettingsService();
