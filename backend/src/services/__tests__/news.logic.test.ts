import {
  newsStateAt, isNewsVisibleAt, parseYouTubeId, youtubeEmbedUrl,
  slugify, uniqueSlug, deriveExcerpt, validateMedia, isSafeImagePath,
  NewsWindow,
} from '../news.logic';

const at = (iso: string) => new Date(iso);
const post = (over: Partial<NewsWindow> = {}): NewsWindow => ({
  published_at: null, expires_at: null, deleted_at: null, ...over,
});

describe('newsStateAt', () => {
  const now = at('2026-07-22T12:00:00Z');

  it('is a draft with no publish time', () => {
    expect(newsStateAt(post(), now)).toBe('draft');
  });

  it('is scheduled before its publish time', () => {
    expect(newsStateAt(post({ published_at: at('2099-01-01T00:00:00Z') }), now)).toBe('scheduled');
  });

  it('is published once the publish time has passed', () => {
    expect(newsStateAt(post({ published_at: at('2026-07-01T00:00:00Z') }), now)).toBe('published');
  });

  it('is expired past expires_at', () => {
    expect(newsStateAt(post({
      published_at: at('2026-07-01T00:00:00Z'),
      expires_at: at('2026-07-10T00:00:00Z'),
    }), now)).toBe('expired');
  });

  it('reports deleted ahead of every other state', () => {
    expect(newsStateAt(post({
      published_at: at('2026-07-01T00:00:00Z'), deleted_at: at('2026-07-05T00:00:00Z'),
    }), now)).toBe('deleted');
  });

  it('only "published" is visible to players', () => {
    expect(isNewsVisibleAt(post({ published_at: at('2026-07-01T00:00:00Z') }), now)).toBe(true);
    expect(isNewsVisibleAt(post({ published_at: at('2099-01-01T00:00:00Z') }), now)).toBe(false);
    expect(isNewsVisibleAt(post(), now)).toBe(false);
  });

  // A NaN comparison is always false, so a naive check would treat a garbage
  // window as published instead of rejecting it.
  it('treats unparseable dates as draft, never published', () => {
    expect(newsStateAt(post({ published_at: new Date('nonsense') }), now)).toBe('draft');
    expect(newsStateAt(post({
      published_at: at('2026-07-01T00:00:00Z'), expires_at: new Date('nonsense'),
    }), now)).toBe('draft');
    expect(newsStateAt(post({ published_at: at('2026-07-01T00:00:00Z') }), new Date('nonsense'))).toBe('draft');
  });
});

describe('parseYouTubeId', () => {
  const ID = 'dQw4w9WgXcQ';

  it.each([
    ['bare id', ID],
    ['watch', `https://www.youtube.com/watch?v=${ID}`],
    ['watch with extra params', `https://www.youtube.com/watch?list=abc&v=${ID}&t=30`],
    ['youtu.be', `https://youtu.be/${ID}`],
    ['shorts', `https://www.youtube.com/shorts/${ID}`],
    ['embed', `https://www.youtube.com/embed/${ID}`],
    ['nocookie', `https://www.youtube-nocookie.com/embed/${ID}`],
    ['mobile', `https://m.youtube.com/watch?v=${ID}`],
    ['no scheme', `youtube.com/watch?v=${ID}`],
  ])('accepts %s', (_label, input) => {
    expect(parseYouTubeId(input)).toBe(ID);
  });

  // Storing anything but a bare id is what would turn a pasted iframe into
  // stored XSS, so hostile input must produce null, not a best effort.
  it.each([
    ['empty', ''],
    ['javascript url', 'javascript:alert(1)'],
    ['script tag', '<script>alert(1)</script>'],
    ['an iframe embed', `<iframe src="https://youtube.com/embed/${ID}"></iframe>`],
    ['a lookalike host', `https://youtube.com.evil.test/watch?v=${ID}`],
    ['a non-youtube host', 'https://vimeo.com/12345'],
    ['a short id', 'abc'],
    ['an over-long id', 'dQw4w9WgXcQEXTRA'],
  ])('rejects %s', (_label, input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });

  it('always embeds through the nocookie domain', () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
  });
});

describe('slugify / uniqueSlug', () => {
  it('lowercases and dashes a latin title', () => {
    expect(slugify('Patch Notes  v1.2!')).toBe('patch-notes-v12');
  });

  it('keeps Thai characters', () => {
    expect(slugify('อัปเดตใหม่')).toBe('อัปเดตใหม่');
  });

  it('falls back rather than returning an empty slug', () => {
    expect(slugify('!!!')).toBe('post');
    expect(slugify('')).toBe('post');
  });

  it('suffixes on collision', () => {
    expect(uniqueSlug('patch', new Set())).toBe('patch');
    expect(uniqueSlug('patch', new Set(['patch']))).toBe('patch-2');
    expect(uniqueSlug('patch', new Set(['patch', 'patch-2']))).toBe('patch-3');
  });
});

describe('deriveExcerpt', () => {
  it('returns null with no body', () => {
    expect(deriveExcerpt(null)).toBeNull();
  });

  it('strips markdown syntax', () => {
    expect(deriveExcerpt('# Title\n**bold** and [link](/a)')).toBe('Title bold and link');
  });

  it('truncates long text', () => {
    const out = deriveExcerpt('a'.repeat(500), 50)!;
    expect(out.length).toBe(50);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('validateMedia', () => {
  const img = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'image' as const, url: `/u/${i}.png` }));
  const vid = (n: number) => Array.from({ length: n }, () => ({ type: 'youtube' as const, url: 'dQw4w9WgXcQ' }));

  it('allows nothing at all', () => expect(validateMedia([])).toBeNull());
  it('allows up to 3 images', () => expect(validateMedia(img(3))).toBeNull());
  it('allows exactly one video', () => expect(validateMedia(vid(1))).toBeNull());
  it('rejects 4 images', () => expect(validateMedia(img(4))).not.toBeNull());
  it('rejects 2 videos', () => expect(validateMedia(vid(2))).not.toBeNull());
  it('rejects mixing images and video', () => expect(validateMedia([...img(1), ...vid(1)])).not.toBeNull());
});

describe('isSafeImagePath', () => {
  it('accepts a site-relative upload path', () => {
    expect(isSafeImagePath('/uploads/a.png')).toBe(true);
  });

  it.each([
    ['remote http', 'https://evil.test/a.png'],
    ['protocol-relative', '//evil.test/a.png'],
    ['javascript', 'javascript:alert(1)'],
    ['data uri', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['bare relative', 'a.png'],
    ['empty', ''],
  ])('rejects %s', (_l, v) => expect(isSafeImagePath(v)).toBe(false));
});
