'use client';
import { Children, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * AutoScrollCarousel — a fixed (non-continuous) paged carousel.
 *
 * - Items sit still; the view advances one page every `interval` ms (default 5s).
 * - Finite: real left end / right end. When auto-advance reaches the right end
 *   it snaps back to the leftmost page (where the best items live).
 * - Prev/Next arrows let the user jump toward either end manually; native
 *   horizontal scroll / touch swipe still works.
 * - Auto-advance pauses while the pointer is over the carousel.
 *
 * Uses native scrolling (no pointer capture / click interception) so buttons
 * inside the cards — buy, view details — remain fully clickable.
 */
interface Props {
  children: ReactNode;
  /** Width class applied to each item wrapper (controls how many peek in view). */
  itemClassName?: string;
  /** Auto-advance interval in ms. */
  interval?: number;
  /** Horizontal gap between items in px. */
  gap?: number;
  className?: string;
}

export default function AutoScrollCarousel({
  children,
  itemClassName = 'w-[44%] sm:w-[30%] md:w-[24%] xl:w-[19%]',
  interval = 5000,
  gap = 12,
  className = '',
}: Props) {
  const items = Children.toArray(children);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [paused, setPaused] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateEdges); ro.disconnect(); };
  }, [updateEdges, items.length]);

  const step = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' });
  }, []);

  // Auto-advance one page every `interval`; loop back to the start at the end.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else el.scrollBy({ left: el.clientWidth * 0.9, behavior: 'smooth' });
    }, interval);
    return () => clearInterval(t);
  }, [paused, interval, items.length]);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        onClick={() => step('left')}
        aria-label="เลื่อนซ้าย"
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-20 w-8 h-8 rounded-full bg-surface border border-border shadow-theme-md flex items-center justify-center text-foreground hover:border-primary/40 transition-opacity ${canLeft ? 'opacity-90 hover:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
      </button>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory"
        style={{ gap: `${gap}px` }}
      >
        {items.map((child, i) => (
          <div key={i} className={`flex-shrink-0 snap-start ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>

      <button
        onClick={() => step('right')}
        aria-label="เลื่อนขวา"
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-20 w-8 h-8 rounded-full bg-surface border border-border shadow-theme-md flex items-center justify-center text-foreground hover:border-primary/40 transition-opacity ${canRight ? 'opacity-90 hover:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
