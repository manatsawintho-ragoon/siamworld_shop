'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import { Newspaper, Pin, Eye, ChevronLeft, ChevronRight, PlayCircle, ArrowRight } from 'lucide-react';
import {
  NEWS_CATEGORIES, NEWS_CATEGORY_ORDER, formatNewsDate,
  type NewsCard, type NewsCategory,
} from '@/lib/news';
import { proxyImage, onProxyError } from '@/lib/imageProxy';

interface Pagination { page: number; limit: number; total: number; totalPages: number }

function NewsCardItem({ n, featured = false }: { n: NewsCard; featured?: boolean }) {
  const cat = NEWS_CATEGORIES[n.category] ?? NEWS_CATEGORIES.general;
  return (
    <Link href={`/news/${encodeURIComponent(n.slug)}`}
      className="group theme-card overflow-hidden hover:border-primary/40 transition-all flex flex-col">
      <div className={`${featured ? 'aspect-[16/8]' : 'aspect-[16/9]'} bg-surface-hover relative overflow-hidden`}>
        {n.coverImage ? (
          <img src={proxyImage(n.coverImage, 640)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={onProxyError} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Newspaper className="w-8 h-8 text-foreground-subtle/40" strokeWidth={1.75} />
          </div>
        )}
        {n.pinned && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-black/60 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
            <Pin className="w-2.5 h-2.5" strokeWidth={2.5} /> ปักหมุด
          </span>
        )}
        {n.media.some(m => m.type === 'youtube') && (
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="w-11 h-11 text-white/90 drop-shadow-lg" strokeWidth={1.5} />
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cat.className}`}>{cat.label}</span>
          <span className="text-[11px] text-foreground-subtle">{formatNewsDate(n.publishedAt)}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-foreground-subtle">
            <Eye className="w-3 h-3" strokeWidth={2.25} /> {n.viewCount.toLocaleString()}
          </span>
        </div>
        <h3 className={`font-black text-foreground leading-snug line-clamp-2 ${featured ? 'text-base sm:text-lg' : 'text-sm'}`}>
          {n.title}
        </h3>
        {n.excerpt && <p className="text-xs text-foreground-subtle mt-1.5 line-clamp-2 flex-1">{n.excerpt}</p>}
        <span className="mt-3 inline-flex items-center gap-1.5 text-primary text-[11px] font-bold">
          อ่านต่อ <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}

export default function NewsIndexPage() {
  const [news, setNews] = useState<NewsCard[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [category, setCategory] = useState<NewsCategory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '12' });
    if (category) qs.set('category', category);
    api(`/public/news?${qs}`)
      .then(d => {
        setNews((d.news as NewsCard[]) || []);
        setPagination((d.pagination as Pagination) ?? null);
      })
      .catch(() => { setNews([]); setPagination(null); })
      .finally(() => setLoading(false));
  }, [page, category]);

  useEffect(load, [load]);

  // Only the first page carries a hero slot; paging past it is a plain grid.
  const featured = page === 1 && !category ? news[0] : undefined;
  const rest = featured ? news.slice(1) : news;
  const videoPosts = news.filter(n => n.media.some(m => m.type === 'youtube'));

  return (
    <MainLayout>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-primary/12 flex items-center justify-center flex-shrink-0">
          <Newspaper className="w-5 h-5 text-primary" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-foreground leading-tight">ข่าวสารและอัปเดต</h1>
          <p className="text-xs text-foreground-subtle mt-0.5">แพตช์โน้ต กิจกรรม และประกาศจากเซิร์ฟเวอร์</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="filter-strip mb-5 pb-1">
        <button onClick={() => { setCategory(null); setPage(1); }}
          className={`px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
            category === null ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-foreground-muted hover:text-foreground'}`}>
          ทั้งหมด
        </button>
        {NEWS_CATEGORY_ORDER.map(c => (
          <button key={c} onClick={() => { setCategory(c); setPage(1); }}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              category === c ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-foreground-muted hover:text-foreground'}`}>
            {NEWS_CATEGORIES[c].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="theme-card overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-border-muted" />
              <div className="p-4 space-y-2">
                <div className="h-2.5 bg-border rounded-full w-1/3" />
                <div className="h-3 bg-border rounded-full w-3/4" />
                <div className="h-2 bg-border-muted rounded-full w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-20 theme-card">
          <div className="w-14 h-14 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto mb-3">
            <Newspaper className="w-6 h-6 text-foreground-subtle" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-bold text-foreground">ยังไม่มีข่าวสารในหมวดนี้</p>
          <p className="text-xs text-foreground-subtle mt-1">กลับมาดูใหม่อีกครั้งเร็ว ๆ นี้</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {featured && (
            <div className="mb-5">
              <NewsCardItem n={featured} featured />
            </div>
          )}

          {/* Featured videos: only worth a section when a post actually has one. */}
          {videoPosts.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/12 flex items-center justify-center flex-shrink-0">
                  <PlayCircle className="w-4 h-4 text-rose-500" strokeWidth={2.25} />
                </div>
                <h2 className="font-black text-foreground text-sm sm:text-base">วิดีโอแนะนำ</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videoPosts.slice(0, 3).map(n => <NewsCardItem key={`v-${n.id}`} n={n} />)}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rest.map(n => <NewsCardItem key={n.id} n={n} />)}
          </div>
        </motion.div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-foreground-muted disabled:opacity-40 hover:border-primary/40 transition-all"
            aria-label="หน้าก่อนหน้า">
            <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <span className="text-xs font-bold text-foreground-muted px-3">
            หน้า {pagination.page} จาก {pagination.totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
            className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-foreground-muted disabled:opacity-40 hover:border-primary/40 transition-all"
            aria-label="หน้าถัดไป">
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </MainLayout>
  );
}
