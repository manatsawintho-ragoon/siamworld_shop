/**
 * Landing-page feature showcase ("ตัวอย่างฟีเจอร์" slider).
 * Authored in the panel admin UI, read publicly by the landing page.
 * Images are stored as base64 data URLs (same approach as payment slips) so no
 * file-storage volume is needed.
 */
import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ValidationError } from '../utils/errors';

export interface ShowcaseInput {
  title: string;
  description: string;
  imageData: string;
}

// data:[mime];base64,<payload> — only allow image mime types.
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/;

function validate(input: Partial<ShowcaseInput>, requireImage: boolean) {
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ValidationError('กรุณาระบุหัวข้อ');
    if (input.title.length > 200) throw new ValidationError('หัวข้อยาวเกิน 200 ตัวอักษร');
  }
  if (input.description !== undefined && input.description.length > 2000) {
    throw new ValidationError('คำอธิบายยาวเกินไป');
  }
  if (input.imageData !== undefined && input.imageData !== '') {
    if (!DATA_URL_RE.test(input.imageData)) throw new ValidationError('รูปภาพไม่ถูกต้อง (รองรับเฉพาะไฟล์รูปภาพ)');
  } else if (requireImage) {
    throw new ValidationError('กรุณาอัปโหลดรูปภาพ');
  }
}

class ShowcaseService {
  /** Admin view — all items, ordered for display. */
  async listAll(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, title, description, image_data, sort_order, is_active, updated_at FROM landing_showcase ORDER BY sort_order ASC, id ASC'
    );
    return rows;
  }

  /** Public view — active items only, ordered as displayed on the landing page. */
  async listActive(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, title, description, image_data FROM landing_showcase WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    return rows;
  }

  async create(input: ShowcaseInput): Promise<number> {
    validate(input, true);
    // New items go to the end of the list.
    const [[{ next }]] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM landing_showcase'
    ) as unknown as [{ next: number }[]];
    const [res] = await pool.execute<ResultSetHeader>(
      'INSERT INTO landing_showcase (title, description, image_data, sort_order) VALUES (?, ?, ?, ?)',
      [input.title.trim(), input.description ?? '', input.imageData, next]
    );
    return res.insertId;
  }

  async update(id: number, input: Partial<ShowcaseInput>): Promise<void> {
    validate(input, false);
    const sets: string[] = [];
    const vals: any[] = [];
    if (input.title !== undefined)       { sets.push('title = ?');       vals.push(input.title.trim()); }
    if (input.description !== undefined) { sets.push('description = ?'); vals.push(input.description); }
    if (input.imageData)                 { sets.push('image_data = ?');  vals.push(input.imageData); }
    if (!sets.length) return;
    vals.push(id);
    await pool.execute(`UPDATE landing_showcase SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async setActive(id: number, active: boolean): Promise<void> {
    await pool.execute('UPDATE landing_showcase SET is_active = ? WHERE id = ?', [active ? 1 : 0, id]);
  }

  async remove(id: number): Promise<void> {
    await pool.execute('DELETE FROM landing_showcase WHERE id = ?', [id]);
  }

  /** Persist a new display order from an explicit list of ids. */
  async reorder(ids: number[]): Promise<void> {
    if (!Array.isArray(ids) || !ids.length) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < ids.length; i++) {
        await conn.execute('UPDATE landing_showcase SET sort_order = ? WHERE id = ?', [i, ids[i]]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}

export const showcaseService = new ShowcaseService();
