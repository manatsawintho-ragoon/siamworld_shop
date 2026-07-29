'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  Newspaper, Eye, Users, ArrowLeft, ChevronLeft, ChevronRight, Pin, Calendar,
} from 'lucide-react';
import { NEWS_CATEGORIES, formatNewsDateTime, type NewsArticle } from '@/lib/news';

/**
 * In-article image carousel. This - not the homepage hero - is the carousel
 * News owns: several images belonging to one post, like product extra images.
 */
function MediaCarousel({ media }: { media: NewsArticle['media'] }) {
  const [index, setIndex] = useState(0);
  const images = media.filter(m => m.type === 'image');

  if (images.length === 0) return null;

  const go = (delta: number) => setIndex(i => (i + delta + images.length) % images.length);
  const current = images[index];

  return (
    <figure className="mb-6">
      <div className="relative rounded-2xl overflow-hidden bg-surface-hover group/media">
        <img src={current.url} alt={current.caption || ''} className="w-full max-h-[460px] object-contain bg-black/5" />

        {images.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="รูปก่อนหน้า"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-gray-800 shadow-lg flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity">
              <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button onClick={() => go(1)} aria-label="รูปถัดไป"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-gray-800 shadow-lg flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setIndex(i)} aria-label={`รูปที่ ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          </>
        )}
      </div>
      {current.caption && (
        <figcaption className="text-xs text-foreground-subtle text-center mt-2">{current.caption}</figcaption>
      )}
    </figure>
  );
}

/**
 * The embed URL is built server-side from a stored 11-char id, never from
 * admin-supplied markup, and is sandboxed here as a second layer.
 */
function VideoEmbed({ media }: { media: NewsArticle['media'] }) {
  const video = media.find(m => m.type === 'youtube');
  if (!video) return null;

  return (
    <figure className="mb-6">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <iframe
          src={video.url}
          title={video.caption || 'video'}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allowFullScreen
        />
      </div>
      {video.caption && (
        <figcaption className="text-xs text-foreground-subtle text-center mt-2">{video.caption}</figcaption>
      )}
    </figure>
  );
}

export default function NewsArticlePage() {
  const params = useParams();
  const slug = String(params?.slug ?? '');

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing' | 'gone'>('loading');

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const d = await api(`/public/news/${encodeURIComponent(slug)}`);
      setArticle(d.article as NewsArticle);
      setStatus('ok');

      // Counted separately from the GET because the GET sits on a 60s shared
      // cache, so counting there would miss every cached hit.
      api(`/public/news/${encodeURIComponent(slug)}/view`, {
        method: 'POST', token: getToken() ?? undefined,
      }).catch(() => {});
    } catch (err: any) {
      setStatus(err?.status === 410 ? 'gone' : 'missing');
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') {
    return (
      <MainLayout>
        <div className="theme-card p-6 animate-pulse space-y-4">
          <div className="h-3 bg-border rounded-full w-24" />
          <div className="h-6 bg-border rounded-full w-3/4" />
          <div className="aspect-[16/9] bg-border-muted rounded-2xl" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-3 bg-border-muted rounded-full w-full" />)}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (status !== 'ok' || !article) {
    const gone = status === 'gone';
    return (
      <MainLayout>
        <div className="text-center py-20 theme-card">
          <div className="w-14 h-14 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto mb-3">
            <Newspaper className="w-6 h-6 text-foreground-subtle" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-bold text-foreground">
            {gone ? 'ข่าวนี้ถูกลบไปแล้ว' : 'ไม่พบข่าวนี้'}
          </p>
          <p className="text-xs text-foreground-subtle mt-1">
            {gone ? 'เนื้อหานี้ถูกนำออกโดยผู้ดูแล' : 'ข่าวอาจถูกย้ายหรือยังไม่เผยแพร่'}
          </p>
          <Link href="/news"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> กลับไปหน้าข่าวสาร
          </Link>
        </div>
      </MainLayout>
    );
  }

  const cat = NEWS_CATEGORIES[article.category] ?? NEWS_CATEGORIES.general;

  return (
    <MainLayout>
      <Link href="/news"
        className="inline-flex items-center gap-1.5 mb-4 text-xs font-bold text-foreground-muted hover:text-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> ข่าวสารทั้งหมด
      </Link>

      <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="theme-card p-5 sm:p-7">

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${cat.className}`}>{cat.label}</span>
          {article.pinned && (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-foreground/10 text-foreground-muted">
              <Pin className="w-3 h-3" strokeWidth={2.5} /> ปักหมุด
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-3xl font-black text-foreground leading-tight">{article.title}</h1>

        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-3 pb-5 mb-5 border-b border-border-muted text-[11px] sm:text-xs text-foreground-subtle font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" strokeWidth={2.25} />
            เผยแพร่ {formatNewsDateTime(article.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" strokeWidth={2.25} /> {article.viewCount.toLocaleString()} ครั้ง
          </span>
          {article.readerCount !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" strokeWidth={2.25} /> {article.readerCount.toLocaleString()} คนอ่านแล้ว
            </span>
          )}
        </div>

        {article.coverImage && article.media.length === 0 && (
          <img src={article.coverImage} alt="" className="w-full rounded-2xl mb-6 object-cover max-h-[420px]" />
        )}

        <VideoEmbed media={article.media} />
        <MediaCarousel media={article.media} />

        {/* Sanitized server-side: the body is escaped before any tag is
            introduced, so no admin-supplied markup can execute here. */}
        <div className="news-body" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />
      </motion.article>
    </MainLayout>
  );
}
