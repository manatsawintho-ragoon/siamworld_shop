import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import {
  newsStateAt, isNewsVisibleAt, NewsState,
  parseYouTubeId, youtubeEmbedUrl, slugify, uniqueSlug, deriveExcerpt,
  validateMedia, MediaInput, isSafeImagePath,
} from './news.logic';
import { renderMarkdown } from '../utils/markdown';
import { ValidationError, NotFoundError } from '../utils/errors';

/**
 * News: the player-facing blog (patch notes, events, maintenance). Separate
 * from the hero slideshow by design - this is a reading surface with its own
 * index and article pages. The carousel that belongs to News is the one INSIDE
 * an article, backed by news_media.
 *
 * Never called "announcements" anywhere: that name belongs to the operator
 * AnnouncementPopup, which is an unrelated system (design B8.3).
 */

export interface NewsRow extends RowDataPacket {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: string;
  cover_image: string | null;
  pinned: number;
  published_at: Date | null;
  expires_at: Date | null;
  view_count: number;
  author_id: number | null;
  deleted_at: Date | null;
  created_at: Date;
}

export interface MediaRow extends RowDataPacket {
  id: number;
  news_id: number;
  type: 'image' | 'youtube';
  url: string;
  caption: string | null;
  sort_order: number;
}

const EDITABLE = [
  'title', 'excerpt', 'body', 'category', 'cover_image',
  'pinned', 'published_at', 'expires_at',
] as const;

/** Shape sent to players. `body` is pre-rendered HTML, never raw markdown. */
function toPublic(n: NewsRow, media: MediaRow[], readerCount?: number) {
  return {
    id: n.id,
    slug: n.slug,
    title: n.title,
    excerpt: n.excerpt || deriveExcerpt(n.body),
    category: n.category,
    coverImage: n.cover_image,
    pinned: Boolean(n.pinned),
    publishedAt: n.published_at,
    viewCount: Number(n.view_count),
    readerCount,
    bodyHtml: renderMarkdown(n.body),
    media: media.map(m => ({
      type: m.type,
      // A youtube row stores the bare id; wrap it here so the client never
      // sees, or has to trust, an admin-supplied URL.
      url: m.type === 'youtube' ? youtubeEmbedUrl(m.url) : m.url,
      caption: m.caption,
    })),
  };
}

class NewsService {
  // ─── Reads ────────────────────────────────────────────────

  /** Admin list: every state, newest first, with computed lifecycle. */
  async getAll(now: Date = new Date()) {
    const [rows] = await pool.execute<NewsRow[]>(
      `SELECT * FROM news WHERE deleted_at IS NULL
       ORDER BY pinned DESC, COALESCE(published_at, created_at) DESC, id DESC`
    );
    const [counts] = await pool.execute<RowDataPacket[]>(
      'SELECT news_id, COUNT(*) AS n FROM news_reads GROUP BY news_id'
    );
    const readers = new Map(counts.map(c => [Number(c.news_id), Number(c.n)]));

    return rows.map(n => ({
      ...n,
      state: newsStateAt(n, now) as NewsState,
      reader_count: readers.get(n.id) ?? 0,
    }));
  }

  /**
   * Published posts for the index. Visibility is evaluated in Node so it stays
   * unit-testable, matching campaign/reward.
   */
  async getPublished(opts: { category?: string; limit?: number; offset?: number } = {}, now: Date = new Date()) {
    const [rows] = await pool.execute<NewsRow[]>(
      `SELECT * FROM news WHERE deleted_at IS NULL
       ORDER BY pinned DESC, published_at DESC, id DESC`
    );
    let visible = rows.filter(n => isNewsVisibleAt(n, now));
    if (opts.category) visible = visible.filter(n => n.category === opts.category);

    const total = visible.length;
    const offset = opts.offset ?? 0;
    const page = visible.slice(offset, offset + (opts.limit ?? 12));

    const mediaByNews = await this.mediaFor(page.map(n => n.id));
    return {
      total,
      news: page.map(n => toPublic(n, mediaByNews.get(n.id) ?? [])),
    };
  }

  /**
   * One article by slug. Returns null for anything not currently published, so
   * drafts and scheduled posts cannot be read by guessing a URL.
   * `gone` distinguishes a soft-deleted post, which must serve 410 rather than
   * a silent 404 (design B5).
   */
  async getBySlug(slug: string, now: Date = new Date()): Promise<
    { gone: true } | { gone: false; article: ReturnType<typeof toPublic> } | null
  > {
    const [rows] = await pool.execute<NewsRow[]>('SELECT * FROM news WHERE slug = ?', [slug]);
    if (rows.length === 0) return null;

    const row = rows[0];
    if (row.deleted_at !== null) return { gone: true };
    if (!isNewsVisibleAt(row, now)) return null;

    const media = (await this.mediaFor([row.id])).get(row.id) ?? [];
    const [[readers]] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM news_reads WHERE news_id = ?', [row.id]
    );
    return { gone: false, article: toPublic(row, media, Number(readers.n)) };
  }

  private async mediaFor(newsIds: number[]): Promise<Map<number, MediaRow[]>> {
    const map = new Map<number, MediaRow[]>();
    if (newsIds.length === 0) return map;
    // Ids are numbers straight from the DB, so inlining them is injection-safe
    // and avoids building a variadic placeholder list.
    const ids = newsIds.map(n => Number(n)).filter(Number.isFinite).join(',');
    const [rows] = await pool.query<MediaRow[]>(
      `SELECT * FROM news_media WHERE news_id IN (${ids}) ORDER BY sort_order ASC, id ASC`
    );
    for (const m of rows) {
      const list = map.get(m.news_id) ?? [];
      list.push(m);
      map.set(m.news_id, list);
    }
    return map;
  }

  /** Latest N published, for the homepage strip. */
  async getLatest(limit = 3, now: Date = new Date()) {
    const { news } = await this.getPublished({ limit }, now);
    return news;
  }

  // ─── View / read tracking ─────────────────────────────────

  /**
   * `view_count` is refresh-inflatable and is therefore only ever labelled
   * "views". `news_reads` is the honest metric: its primary key makes a repeat
   * read a no-op, so the reader list cannot be padded by reloading.
   */
  async recordView(newsId: number, userId: number | null): Promise<void> {
    await pool.execute('UPDATE news SET view_count = view_count + 1 WHERE id = ?', [newsId]);
    if (userId) {
      await pool.execute(
        'INSERT INTO news_reads (news_id, user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE read_at = read_at',
        [newsId, userId]
      );
    }
  }

  /** Who has read a post. Admin only - it names players. */
  async getReaders(newsId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, nr.read_at
       FROM news_reads nr JOIN users u ON u.id = nr.user_id
       WHERE nr.news_id = ? ORDER BY nr.read_at DESC LIMIT 500`,
      [newsId]
    );
    return rows;
  }

  // ─── Writes ───────────────────────────────────────────────

  private async takenSlugs(excludeId?: number): Promise<Set<string>> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, slug FROM news'
    );
    return new Set(rows.filter(r => r.id !== excludeId).map(r => String(r.slug)));
  }

  /**
   * Normalise media before it is stored: YouTube input of any form collapses to
   * a bare id, images must be same-origin. Rejecting here (not just in the UI)
   * is what makes the stored data trustworthy at render time.
   */
  private normaliseMedia(media: MediaInput[] | undefined): MediaInput[] {
    if (!media || media.length === 0) return [];

    const problem = validateMedia(media);
    if (problem) throw new ValidationError(problem);

    return media.map(m => {
      if (m.type === 'youtube') {
        const id = parseYouTubeId(m.url);
        if (!id) throw new ValidationError(`ลิงก์ YouTube ไม่ถูกต้อง: ${m.url}`);
        return { type: 'youtube' as const, url: id, caption: m.caption ?? null };
      }
      if (!isSafeImagePath(m.url)) {
        throw new ValidationError('รูปภาพต้องเป็นไฟล์ที่อัปโหลดในเว็บเท่านั้น (ขึ้นต้นด้วย /)');
      }
      return { type: 'image' as const, url: m.url.trim(), caption: m.caption ?? null };
    });
  }

  private async replaceMedia(newsId: number, media: MediaInput[]): Promise<void> {
    await pool.execute('DELETE FROM news_media WHERE news_id = ?', [newsId]);
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      await pool.execute(
        'INSERT INTO news_media (news_id, type, url, caption, sort_order) VALUES (?,?,?,?,?)',
        [newsId, m.type, m.url, m.caption ?? null, i]
      );
    }
  }

  async create(data: Record<string, any>, authorId: number | null): Promise<NewsRow | null> {
    const media = this.normaliseMedia(data.media);
    const slug = uniqueSlug(slugify(data.slug || data.title), await this.takenSlugs());

    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO news (slug, title, excerpt, body, category, cover_image,
                         pinned, published_at, expires_at, author_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        slug, data.title, data.excerpt ?? null, data.body ?? null,
        data.category ?? 'general', data.cover_image ?? null,
        data.pinned ? 1 : 0, data.published_at ?? null, data.expires_at ?? null,
        authorId,
      ]
    );
    await this.replaceMedia(res.insertId, media);
    return this.getRawById(res.insertId);
  }

  async update(id: number, data: Record<string, any>): Promise<NewsRow | null> {
    const current = await this.getRawById(id);
    if (!current) throw new NotFoundError('ไม่พบข่าวนี้');

    const fields: string[] = [];
    const values: any[] = [];
    for (const key of EDITABLE) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'pinned' ? (data[key] ? 1 : 0) : data[key]);
      }
    }

    // Changing the slug of a published post breaks inbound links, so it is
    // blocked unless the caller explicitly opts in (design B5).
    if (data.slug !== undefined && data.slug !== current.slug) {
      const isPublished = current.published_at !== null && current.published_at.getTime() <= Date.now();
      if (isPublished && !data.allowSlugChange) {
        throw new ValidationError('ข่าวนี้เผยแพร่แล้ว การแก้ URL จะทำให้ลิงก์เดิมเสีย ถ้าต้องการแก้จริงให้ยืนยันอีกครั้ง');
      }
      fields.push('slug = ?');
      values.push(uniqueSlug(slugify(data.slug), await this.takenSlugs(id)));
    }

    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    if (data.media !== undefined) await this.replaceMedia(id, this.normaliseMedia(data.media));

    return this.getRawById(id);
  }

  async getRawById(id: number): Promise<NewsRow | null> {
    const [rows] = await pool.execute<NewsRow[]>('SELECT * FROM news WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  /**
   * Admin editor payload: the raw row plus its media in the SAME shape the
   * editor submits back (youtube as the bare stored id, not the embed URL). The
   * public getBySlug hides drafts, so the editor cannot reuse it - it must be
   * able to load a post in any state.
   */
  async getForEdit(id: number, now: Date = new Date()) {
    const row = await this.getRawById(id);
    if (!row) return null;
    const media = (await this.mediaFor([id])).get(id) ?? [];
    return {
      ...row,
      state: newsStateAt(row, now) as NewsState,
      media: media.map(m => ({ type: m.type, url: m.url, caption: m.caption })),
    };
  }

  /** Soft-delete so inbound links can serve 410 instead of a silent 404. */
  async remove(id: number): Promise<void> {
    await pool.execute('UPDATE news SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  async restore(id: number): Promise<void> {
    await pool.execute('UPDATE news SET deleted_at = NULL WHERE id = ?', [id]);
  }

  /** Copy a post as a fresh draft - for recurring events (design B6). */
  async duplicate(id: number, authorId: number | null): Promise<NewsRow | null> {
    const src = await this.getRawById(id);
    if (!src) throw new NotFoundError('ไม่พบข่าวนี้');

    const media = (await this.mediaFor([id])).get(id) ?? [];
    const slug = uniqueSlug(slugify(`${src.title}-copy`), await this.takenSlugs());

    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO news (slug, title, excerpt, body, category, cover_image,
                         pinned, published_at, expires_at, author_id)
       VALUES (?,?,?,?,?,?,0,NULL,NULL,?)`,
      [slug, `${src.title} (คัดลอก)`, src.excerpt, src.body, src.category, src.cover_image, authorId]
    );
    await this.replaceMedia(
      res.insertId,
      media.map(m => ({ type: m.type, url: m.url, caption: m.caption }))
    );
    return this.getRawById(res.insertId);
  }

  /** Soft-deleted posts, for the admin restore list. */
  async getDeleted() {
    const [rows] = await pool.execute<NewsRow[]>(
      'SELECT * FROM news WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    );
    return rows;
  }
}

export const newsService = new NewsService();
