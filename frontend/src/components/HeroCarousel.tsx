'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Coins, Timer, Sparkles, ArrowRight } from 'lucide-react';
import type { ActiveCampaign } from './CampaignBanner';
import { formatCountdown, campaignRate } from './CampaignBanner';

export interface ImageSlideData {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
}

/**
 * The carousel mixes artwork the shop owner uploaded with one *rendered* kind
 * (campaign) that needs no artwork at all. `key` is a string because ids are
 * only unique within a kind.
 *
 * News deliberately does NOT appear here. It is a reading surface with its own
 * index and article pages (/news), not a slide.
 */
export type CarouselSlide =
  | { kind: 'image'; key: string; image: ImageSlideData }
  | { kind: 'campaign'; key: string; campaign: ActiveCampaign };

// Named accents only - the API constrains `accent` to these keys, so a slide
// can never inject an arbitrary class or style string.
const ACCENTS: Record<string, { grad: string; pill: string; glow: string }> = {
  primary: { grad: 'from-primary/90 via-primary/70 to-primary/40', pill: 'bg-white/20 text-white', glow: 'rgba(255,255,255,0.35)' },
  violet:  { grad: 'from-violet-600 via-violet-500 to-fuchsia-500', pill: 'bg-white/20 text-white', glow: 'rgba(167,139,250,0.55)' },
  amber:   { grad: 'from-amber-500 via-orange-500 to-rose-500',     pill: 'bg-black/25 text-white', glow: 'rgba(251,191,36,0.55)' },
  emerald: { grad: 'from-emerald-600 via-emerald-500 to-teal-500',  pill: 'bg-black/25 text-white', glow: 'rgba(52,211,153,0.55)' },
  rose:    { grad: 'from-rose-600 via-pink-500 to-fuchsia-500',     pill: 'bg-white/20 text-white', glow: 'rgba(244,114,182,0.55)' },
  sky:     { grad: 'from-sky-600 via-blue-500 to-indigo-500',       pill: 'bg-white/20 text-white', glow: 'rgba(56,189,248,0.55)' },
};
const accentOf = (name?: string | null) => ACCENTS[name ?? 'primary'] ?? ACCENTS.primary;

/** Soft radial wash + fine grid, so a text-only slide never reads as a flat block. */
function SlideTexture({ glow }: { glow: string }) {
  return (
    <>
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: `radial-gradient(circle at 78% 25%, ${glow} 0%, transparent 55%)` }} />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
    </>
  );
}

/** Wraps a rendered slide in a link only when there is somewhere to go. */
function SlideShell({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return <div className="block w-full h-full">{children}</div>;
  const external = /^https?:\/\//i.test(href);
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full h-full">{children}</a>
    : <Link href={href} className="block w-full h-full">{children}</Link>;
}

function CampaignSlide({ campaign }: { campaign: ActiveCampaign }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(campaign.endsAt).getTime() - Date.now());

  useEffect(() => {
    const endsAtMs = new Date(campaign.endsAt).getTime();
    setRemainingMs(endsAtMs - Date.now());
    const timer = setInterval(() => setRemainingMs(endsAtMs - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [campaign.endsAt]);

  const a = accentOf('amber');
  const { bahtPerPoint, pointsAtThatAmount } = campaignRate(campaign.pointsPerBaht);

  return (
    <SlideShell href="/topup">
      <div className={`relative w-full h-full bg-gradient-to-br ${a.grad} overflow-hidden`}>
        <SlideTexture glow={a.glow} />
        <div className="relative z-10 h-full flex flex-col justify-center px-5 sm:px-8 lg:px-10 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 ${a.pill} text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-full tracking-wide`}>
              <Sparkles className="w-3 h-3" strokeWidth={2.75} /> แคมเปญเติมเงิน
            </span>
          </div>

          <h2 className="text-xl sm:text-3xl lg:text-4xl font-black leading-[1.1] drop-shadow-sm max-w-[85%]">
            เติมเงินช่วงนี้ รับ point พิเศษ
          </h2>

          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2.5 text-[11px] sm:text-sm font-bold text-white/90">
            {bahtPerPoint > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" strokeWidth={2.5} />
                เติมทุก ฿{bahtPerPoint.toLocaleString()} รับ {pointsAtThatAmount} point
              </span>
            )}
            {campaign.minTopupAmount > 0 && (
              <span className="hidden sm:inline">ขั้นต่ำ ฿{campaign.minTopupAmount.toLocaleString()} ต่อครั้ง</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-gray-900 text-[11px] sm:text-xs font-black shadow-lg">
              เติมเงินเลย <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.75} />
            </span>
            {remainingMs > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/25 border border-white/25 text-[11px] sm:text-xs font-black tabular-nums">
                <Timer className="w-3.5 h-3.5 text-white/85" strokeWidth={2.5} />
                เหลือเวลา {formatCountdown(remainingMs)}
              </span>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

/**
 * `priority` is set only for the slide that is on screen at first paint. That
 * one is the page's LCP element on most shops, so it gets a preload link and
 * fetchpriority=high; every other slide stays lazy. Serving these through
 * next/image also re-encodes owner-uploaded artwork (usually a full-size PNG
 * from an external host) to AVIF/WebP at the size actually displayed, which is
 * where the ~1.5MB of image savings Lighthouse reported comes from.
 */
function ImageSlide({ image, priority = false }: { image: ImageSlideData; priority?: boolean }) {
  return (
    <SlideShell href={image.link_url}>
      <Image
        src={image.image_url}
        alt={image.title || ''}
        fill
        // The carousel is full-width on phones and capped by the content column
        // on desktop, so the browser never needs the full viewport width above lg.
        sizes="(max-width: 1024px) 100vw, 720px"
        className="object-cover"
        priority={priority}
        draggable={false}
      />
      {image.title && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-5 pb-4 pt-8 pointer-events-none">
          <p className="text-white font-bold text-sm drop-shadow-md">{image.title}</p>
        </div>
      )}
    </SlideShell>
  );
}

export default function HeroCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  // Slides arrive asynchronously (the campaign resolves after the images),
  // so the list can shrink under a stale index - clamp instead of blanking.
  const safeIndex = slides.length > 0 ? Math.min(current, slides.length - 1) : 0;

  const goTo = useCallback((idx: number, dir: number) => {
    setDirection(dir);
    setCurrent(idx);
  }, []);

  const goPrev = useCallback(() => {
    goTo((safeIndex - 1 + slides.length) % slides.length, -1);
  }, [safeIndex, slides.length, goTo]);

  const goNext = useCallback(() => {
    goTo((safeIndex + 1) % slides.length, 1);
  }, [safeIndex, slides.length, goTo]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => goNext(), 5000);
    return () => clearInterval(timer);
  }, [slides.length, goNext]);

  if (slides.length === 0) return null;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  const slide = slides[safeIndex];

  return (
    <section className="group/carousel relative overflow-hidden w-full h-full">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={slide.key}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {slide.kind === 'campaign'
            ? <CampaignSlide campaign={slide.campaign} />
            : <ImageSlide image={slide.image} priority={safeIndex === 0} />}
        </motion.div>
      </AnimatePresence>

      {/* Hover Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:shadow-xl"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:shadow-xl"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => goTo(i, i > safeIndex ? 1 : -1)}
              className={`h-1 rounded-sm transition-all duration-300 ${i === safeIndex ? 'w-7 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
