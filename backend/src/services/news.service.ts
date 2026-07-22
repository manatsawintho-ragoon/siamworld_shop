import { RowDataPacket } from 'mysql2';
import { pool } from '../database/connection';
import { isNewsPublishedAt } from './news.logic';

/**
 * Player-facing news items rendered as hero-carousel slides. The publishing
 * predicate itself is pure and lives in news.logic.ts.
 */

export interface NewsRow extends RowDataPacket {
  id: number;
  title: string;
  excerpt: string | null;
  badge: string | null;
  accent: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  active: number;
  starts_at: Date | null;
  ends_at: Date | null;
}

const EDITABLE = [
  'title', 'excerpt', 'badge', 'accent',
  'image_url', 'link_url', 'sort_order', 'starts_at', 'ends_at',
] as const;

class NewsService {
  /** Everything, including hidden/expired items. Admin list only. */
  async getAll(): Promise<NewsRow[]> {
    const [rows] = await pool.execute<NewsRow[]>(
      'SELECT * FROM news ORDER BY sort_order ASC, id DESC'
    );
    return rows;
  }

  /**
   * Items a player should see right now. Window evaluation happens here in
   * Node rather than in SQL so it stays unit-testable, same rationale as
   * campaign.logic.ts.
   */
  async getPublished(now: Date = new Date()): Promise<NewsRow[]> {
    const [rows] = await pool.execute<NewsRow[]>(
      'SELECT * FROM news WHERE active = 1 ORDER BY sort_order ASC, id DESC'
    );
    return rows.filter(r => isNewsPublishedAt(r, now));
  }

  async getById(id: number): Promise<NewsRow | null> {
    const [rows] = await pool.execute<NewsRow[]>('SELECT * FROM news WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  async create(data: Record<string, any>): Promise<NewsRow | null> {
    const [result] = await pool.execute(
      `INSERT INTO news (title, excerpt, badge, accent, image_url, link_url, sort_order, active, starts_at, ends_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        data.title,
        data.excerpt ?? null,
        data.badge ?? null,
        data.accent ?? 'primary',
        data.image_url ?? null,
        data.link_url ?? null,
        data.sort_order ?? 0,
        data.active === undefined ? 1 : (data.active ? 1 : 0),
        data.starts_at ?? null,
        data.ends_at ?? null,
      ]
    );
    return this.getById((result as any).insertId);
  }

  async update(id: number, data: Record<string, any>): Promise<NewsRow | null> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const key of EDITABLE) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
    }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }

    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.getById(id);
  }

  async reorder(order: { id: number; sort_order: number }[]): Promise<void> {
    for (const item of order) {
      await pool.execute('UPDATE news SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
  }

  async remove(id: number): Promise<void> {
    await pool.execute('DELETE FROM news WHERE id = ?', [id]);
  }
}

export const newsService = new NewsService();
