/**
 * Operator announcements. Authored in the panel admin UI and polled by every
 * customer shop via GET /api/announcements/active. Publishing one broadcasts it
 * to all shops (a "what's new" popup in each shop's admin panel).
 */
import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type AnnouncementLevel = 'info' | 'update' | 'important';
const LEVELS: AnnouncementLevel[] = ['info', 'update', 'important'];

function normLevel(v: unknown): AnnouncementLevel {
  return LEVELS.includes(v as AnnouncementLevel) ? (v as AnnouncementLevel) : 'update';
}

class AnnouncementService {
  /** All announcements (admin view), newest first. */
  async listAll(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, title, body, level, is_published, published_at, created_at, updated_at FROM announcements ORDER BY created_at DESC'
    );
    return rows;
  }

  /** Published announcements only (what shops fetch), newest published first. */
  async listActive(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, title, body, level, published_at
         FROM announcements
        WHERE is_published = 1
        ORDER BY published_at DESC, id DESC`
    );
    return rows;
  }

  async create(title: string, body: string, level: unknown): Promise<number> {
    const [res] = await pool.execute<ResultSetHeader>(
      'INSERT INTO announcements (title, body, level) VALUES (?, ?, ?)',
      [title.trim(), body, normLevel(level)]
    );
    return res.insertId;
  }

  async update(id: number, title: string, body: string, level: unknown): Promise<void> {
    await pool.execute(
      'UPDATE announcements SET title = ?, body = ?, level = ? WHERE id = ?',
      [title.trim(), body, normLevel(level), id]
    );
  }

  /** Publish/unpublish; publishing stamps published_at so shops can order by it. */
  async setPublished(id: number, published: boolean): Promise<void> {
    if (published) {
      await pool.execute(
        'UPDATE announcements SET is_published = 1, published_at = COALESCE(published_at, NOW()) WHERE id = ?',
        [id]
      );
    } else {
      await pool.execute('UPDATE announcements SET is_published = 0 WHERE id = ?', [id]);
    }
  }

  async remove(id: number): Promise<void> {
    await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
  }
}

export const announcementService = new AnnouncementService();
