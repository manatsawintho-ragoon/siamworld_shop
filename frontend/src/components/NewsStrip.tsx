'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowRight, Newspaper, Pin } from 'lucide-react';
import { NEWS_CATEGORIES, formatNewsDate, type NewsCard } from '@/lib/news';

/**
 * "Latest news" strip for the homepage: the three most recent published posts,
 * pinned first. Deliberately a link-out to /news/[slug], not an inline reader -
 * News is its own surface, not a homepage widget.
 */
export default function NewsStrip() {
  const [news, setNews] = useState<NewsCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api('/public/news/latest')
      .then(d => setNews((d.news as NewsCard[]) || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || news.length === 0) return null;

  return (
    <section className="theme-card mb-5">
      <div className="px-3 sm:px-4 py-3 border-b border-border-muted flex items-center gap-2 sm:gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center flex-shrink-0">
          <Newspaper className="w-4 h-4 text-primary" strokeWidth={2.25} />
        </div>
        <h2 className="font-black text-foreground text-sm sm:text-base leading-tight truncate min-w-0">
          ข่าวสารล่าสุด
        </h2>
        <Link href="/news"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0">
          <span className="hidden sm:inline">ดูข่าวทั้งหมด</span><span className="sm:hidden">ทั้งหมด</span>
          <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {news.map(n => {
          const cat = NEWS_CATEGORIES[n.category] ?? NEWS_CATEGORIES.general;
          return (
            <Link key={n.id} href={`/news/${encodeURIComponent(n.slug)}`}
              className="group rounded-xl border border-border-muted overflow-hidden bg-surface hover:border-primary/40 transition-all">
              <div className="aspect-[16/9] bg-surface-hover relative overflow-hidden">
                {n.coverImage ? (
                  <img src={n.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Newspaper className="w-7 h-7 text-foreground-subtle/40" strokeWidth={1.75} />
                  </div>
                )}
                {n.pinned && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-black/60 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    <Pin className="w-2.5 h-2.5" strokeWidth={2.5} /> ปักหมุด
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cat.className}`}>{cat.label}</span>
                  <span className="text-[11px] text-foreground-subtle">{formatNewsDate(n.publishedAt)}</span>
                </div>
                <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{n.title}</h3>
                {n.excerpt && <p className="text-xs text-foreground-subtle mt-1 line-clamp-2">{n.excerpt}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
