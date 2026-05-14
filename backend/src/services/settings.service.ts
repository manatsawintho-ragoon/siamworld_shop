import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';

// Keys stored encrypted at rest in the settings table.
// encrypt/decrypt is transparent — callers always work with plaintext.
const SENSITIVE_SETTINGS = new Set(['easyslip_api_key', 'smtp_password']);

function maybeDecrypt(key: string, value: string): string {
  if (!SENSITIVE_SETTINGS.has(key)) return value;
  if (isEncrypted(value)) {
    try { return decrypt(value); } catch { return value; } // corrupt entry — return as-is
  }
  return value; // legacy plain-text — pass through until next save
}

class SettingsService {
  async getAll(): Promise<Record<string, string>> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT `key`, `value` FROM settings');
    const settings: Record<string, string> = {};
    for (const row of rows) { settings[row.key] = maybeDecrypt(row.key, row.value); }
    return settings;
  }

  async get(key: string): Promise<string | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT `value` FROM settings WHERE `key` = ?', [key]);
    if (rows.length === 0) return null;
    return maybeDecrypt(key, rows[0].value);
  }

  async set(key: string, value: string) {
    const stored = SENSITIVE_SETTINGS.has(key) ? encrypt(value) : value;
    await pool.execute(
      'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
      [key, stored, stored]
    );
  }

  async setMultiple(settings: Record<string, string>) {
    for (const [key, value] of Object.entries(settings)) {
      await this.set(key, value);
    }
  }

  // Slides
  async getSlides() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM slides WHERE active = 1 ORDER BY sort_order ASC'
    );
    return rows;
  }

  async getAllSlides() {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM slides ORDER BY sort_order ASC');
    return rows;
  }

  async createSlide(data: { title?: string; image_url: string; link_url?: string; sort_order?: number }) {
    const [result] = await pool.execute(
      'INSERT INTO slides (title, image_url, link_url, sort_order) VALUES (?,?,?,?)',
      [data.title || null, data.image_url, data.link_url || null, data.sort_order || 0]
    );
    return { id: (result as any).insertId, ...data };
  }

  async reorderSlides(order: { id: number; sort_order: number }[]) {
    for (const item of order) {
      await pool.execute('UPDATE slides SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
  }

  async updateSlide(id: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: (string | number)[] = [];
    for (const key of ['title', 'image_url', 'link_url', 'sort_order']) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
    }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE slides SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  }

  async deleteSlide(id: number) {
    await pool.execute('DELETE FROM slides WHERE id = ?', [id]);
  }
}

export const settingsService = new SettingsService();
