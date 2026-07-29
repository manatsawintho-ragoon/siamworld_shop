/**
 * Shared News types and display config. Single source for category labels and
 * colours so the strip, the index, the article page and the admin editor can
 * never disagree - same rule as lib/rarity.ts.
 */

export type NewsCategory = 'update' | 'event' | 'maintenance' | 'patch' | 'general';

export interface NewsMedia {
  type: 'image' | 'youtube';
  /** For youtube this is already a full youtube-nocookie embed URL. */
  url: string;
  caption?: string | null;
}

export interface NewsCard {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  category: NewsCategory;
  coverImage: string | null;
  pinned: boolean;
  publishedAt: string | null;
  viewCount: number;
  media: NewsMedia[];
}

export interface NewsArticle extends NewsCard {
  bodyHtml: string;
  readerCount?: number;
}

export const NEWS_CATEGORIES: Record<NewsCategory, { label: string; className: string }> = {
  update:      { label: 'อัปเดต',     className: 'bg-sky-500/15 text-sky-500' },
  event:       { label: 'กิจกรรม',    className: 'bg-violet-500/15 text-violet-500' },
  maintenance: { label: 'ปิดปรับปรุง', className: 'bg-amber-500/15 text-amber-600' },
  patch:       { label: 'แพตช์โน้ต',  className: 'bg-emerald-500/15 text-emerald-600' },
  general:     { label: 'ทั่วไป',      className: 'bg-foreground/10 text-foreground-muted' },
};

export const NEWS_CATEGORY_ORDER: NewsCategory[] = ['update', 'patch', 'event', 'maintenance', 'general'];

/** "22 ก.ค. 2569" - Thai Buddhist-era short date, matching the rest of the shop. */
export function formatNewsDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatNewsDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
