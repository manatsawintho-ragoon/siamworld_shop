/**
 * TEMPORARY end-to-end verification against a throwaway MySQL.
 * Not part of the normal suite (filename ends .itest.ts, jest matches *.test.ts).
 * Run explicitly:  npx jest --testMatch='**\/*.itest.ts'
 *
 * Setup:
 *   docker run -d --name news-mig-test -e MYSQL_ROOT_PASSWORD=root \
 *     -e MYSQL_DATABASE=shop -p 13307:3306 mysql:8.0
 *   # then apply init.sql + migrations/033_shop_news.sql
 *
 * GOTCHA: do NOT gate readiness on `mysqladmin ping` - it reports alive while
 * the container is still initialising. Poll a real query instead. Same trap
 * documented in campaign.e2e.itest.ts.
 *
 * Proves what the unit tests cannot: that the column list in news.service
 * actually matches the migration, and that getPublished's window filter really
 * hides unpublished rows coming back from MySQL.
 */
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '13307';
process.env.MYSQL_USER = 'root';
process.env.MYSQL_PASSWORD = 'root';
process.env.MYSQL_DATABASE = 'shop';

describe('news service against a real database', () => {
  let pool: any;
  let newsService: any;

  beforeAll(async () => {
    ({ pool } = await import('../../database/connection'));
    ({ newsService } = await import('../news.service'));
    await pool.execute('DELETE FROM news');
  });

  afterAll(async () => { await pool.end(); });

  it('round-trips every column the admin form writes', async () => {
    const created = await newsService.create({
      title: 'อัปเดตเซิร์ฟเวอร์',
      excerpt: 'ไอเท็มใหม่เพียบ',
      badge: 'ใหม่',
      accent: 'violet',
      image_url: 'https://example.com/a.png',
      link_url: '/shop',
      sort_order: 3,
      active: true,
      starts_at: null,
      ends_at: null,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.title).toBe('อัปเดตเซิร์ฟเวอร์');
    expect(created.excerpt).toBe('ไอเท็มใหม่เพียบ');
    expect(created.badge).toBe('ใหม่');
    expect(created.accent).toBe('violet');
    expect(created.link_url).toBe('/shop');
    expect(created.sort_order).toBe(3);
    expect(created.active).toBe(1);
  });

  it('defaults accent and active when the form omits them', async () => {
    const created = await newsService.create({ title: 'ไม่ระบุสี' });
    expect(created.accent).toBe('primary');
    expect(created.active).toBe(1);
  });

  it('partial update leaves untouched columns alone', async () => {
    const created = await newsService.create({ title: 'เดิม', excerpt: 'คงไว้', accent: 'sky' });
    const updated = await newsService.update(created.id, { active: false });

    expect(updated.active).toBe(0);
    expect(updated.title).toBe('เดิม');
    expect(updated.excerpt).toBe('คงไว้');
    expect(updated.accent).toBe('sky');
  });

  it('clearing a window bound writes NULL rather than dropping the field', async () => {
    const created = await newsService.create({
      title: 'มีกำหนด',
      starts_at: new Date('2026-01-01T00:00:00Z'),
      ends_at: new Date('2026-12-31T00:00:00Z'),
    });
    expect(created.starts_at).not.toBeNull();

    const cleared = await newsService.update(created.id, { starts_at: null, ends_at: null });
    expect(cleared.starts_at).toBeNull();
    expect(cleared.ends_at).toBeNull();
  });

  describe('getPublished', () => {
    beforeAll(async () => {
      await pool.execute('DELETE FROM news');
      await pool.execute(
        `INSERT INTO news (id, title, sort_order, active, starts_at, ends_at) VALUES
           (1, 'live-unbounded',  0, 1, NULL, NULL),
           (2, 'inactive',        1, 0, NULL, NULL),
           (3, 'not-yet',         2, 1, '2099-01-01 00:00:00', NULL),
           (4, 'expired',         3, 1, NULL, '2000-01-01 00:00:00'),
           (5, 'live-in-window',  4, 1, '2000-01-01 00:00:00', '2099-01-01 00:00:00')`
      );
    });

    it('returns only rows inside their publishing window', async () => {
      const titles = (await newsService.getPublished()).map((n: any) => n.title);
      expect(titles).toEqual(['live-unbounded', 'live-in-window']);
    });

    it('respects sort_order', async () => {
      const rows = await newsService.getPublished();
      expect(rows.map((n: any) => n.sort_order)).toEqual([0, 4]);
    });

    it('getAll still shows the hidden ones to the admin', async () => {
      expect((await newsService.getAll()).length).toBe(5);
    });

    it('reorder rewrites positions', async () => {
      await newsService.reorder([{ id: 5, sort_order: 0 }, { id: 1, sort_order: 1 }]);
      const titles = (await newsService.getPublished()).map((n: any) => n.title);
      expect(titles).toEqual(['live-in-window', 'live-unbounded']);
    });
  });
});
