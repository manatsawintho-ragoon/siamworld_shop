/**
 * Pure News logic. No DB, no ambient clock, no I/O.
 *
 * Same split as campaign.logic.ts / reward.logic.ts: decisions live here so
 * they can be unit tested directly, the SQL lives in news.service.ts.
 */

export interface NewsWindow {
  published_at: Date | null;
  expires_at: Date | null;
  deleted_at: Date | null;
}

export type NewsState = 'draft' | 'scheduled' | 'published' | 'expired' | 'deleted';

/**
 * Lifecycle is COMPUTED from timestamps, never toggled by a job. That is what
 * guarantees a late cron cannot leave a maintenance notice up after the
 * maintenance ended.
 *
 * NaN guards: an unparseable DATETIME compares false against everything, so a
 * naive check would treat a garbage window as published rather than reject it.
 */
export function newsStateAt(n: NewsWindow, when: Date): NewsState {
  if (n.deleted_at !== null) return 'deleted';

  const t = when.getTime();
  if (Number.isNaN(t)) return 'draft';

  if (n.published_at === null) return 'draft';
  const pub = n.published_at.getTime();
  if (Number.isNaN(pub)) return 'draft';
  if (t < pub) return 'scheduled';

  if (n.expires_at !== null) {
    const exp = n.expires_at.getTime();
    if (Number.isNaN(exp)) return 'draft';
    if (t > exp) return 'expired';
  }
  return 'published';
}

/** Only 'published' is visible to players. */
export function isNewsVisibleAt(n: NewsWindow, when: Date): boolean {
  return newsStateAt(n, when) === 'published';
}

/**
 * Extract a YouTube video id from any of the forms an admin might paste.
 *
 * Returns the bare 11-char id or null. We store ONLY the id and re-wrap it
 * server-side into a youtube-nocookie embed. Storing a user-supplied URL or
 * iframe would be a stored-XSS hole, and admins here hold wallet controls, so
 * that would be a full compromise (design B3).
 */
export function parseYouTubeId(input: string): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  // Already a bare id.
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

  let u: URL;
  try {
    u = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const allowed = ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'];
  if (!allowed.includes(host)) return null;

  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = u.pathname.split('/').filter(Boolean)[0] ?? null;
  } else {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') candidate = u.searchParams.get('v');
    else if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'v') candidate = parts[1] ?? null;
  }

  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

/** Player-facing embed URL. Never built from raw admin input. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/**
 * URL-safe slug. Thai is kept verbatim: it is safe once percent-encoded and
 * makes far better links for a Thai audience than a transliteration would.
 */
export function slugify(title: string): string {
  const base = (title || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    // \p{M} (combining marks) is essential for Thai: vowel signs and tone
    // marks like ั and ่ are marks, not letters, so a \p{L}-only class
    // silently strips them and turns "อัปเดตใหม่" into "อปเดตใหม".
    .replace(/[^\p{L}\p{M}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return base || 'post';
}

/**
 * Resolve a slug collision by suffixing -2, -3, ... `taken` is every slug
 * already in use, excluding the row being edited.
 */
export function uniqueSlug(desired: string, taken: Set<string>): string {
  if (!taken.has(desired)) return desired;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${desired}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${desired}-${Date.now()}`;
}

/** Card text when the admin left excerpt blank: first meaningful line of body. */
export function deriveExcerpt(body: string | null, max = 200): string | null {
  if (!body) return null;
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // links -> label
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export type MediaKind = 'image' | 'youtube';
export interface MediaInput { type: MediaKind; url: string; caption?: string | null; }

/**
 * A post is EITHER up to 3 images OR exactly one video, never mixed.
 * Enforced here (and therefore in the Zod schema) rather than only in the UI:
 * mixing would need a carousel that also pauses video and manages autoplay
 * and focus, which is disproportionate complexity for no requested benefit.
 */
export function validateMedia(media: MediaInput[]): string | null {
  if (media.length === 0) return null;

  const images = media.filter(m => m.type === 'image');
  const videos = media.filter(m => m.type === 'youtube');

  if (images.length > 0 && videos.length > 0) return 'ใส่รูปภาพกับวิดีโอพร้อมกันไม่ได้ เลือกอย่างใดอย่างหนึ่ง';
  if (images.length > 3) return 'ใส่รูปภาพได้สูงสุด 3 รูป';
  if (videos.length > 1) return 'ใส่วิดีโอได้ 1 คลิปเท่านั้น';
  return null;
}

/**
 * Same-origin image paths only: uploads or relative paths. Blocking arbitrary
 * remote URLs also removes SSRF and mixed-content surface (design B3).
 */
export function isSafeImagePath(url: string): boolean {
  if (typeof url !== 'string') return false;
  const v = url.trim();
  if (!v) return false;
  if (v.startsWith('//')) return false;          // protocol-relative -> remote
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false; // any scheme, incl. javascript:
  return v.startsWith('/');
}
