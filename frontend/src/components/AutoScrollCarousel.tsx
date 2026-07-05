'use client';
import { Children, ReactNode, useCallback, useEffect, useRef } from 'react';

/**
 * AutoScrollCarousel — transform-based marquee.
 *
 * - Seamless infinite loop: children are rendered twice and the track is
 *   translated continuously; when it passes one full copy the offset resets
 *   with no visible seam.
 * - Free per-item drag with momentum/inertia (mouse + touch, both directions).
 * - Auto-scroll pauses on hover and while dragging, then resumes.
 *
 * Not a scroll-snap carousel — items flow smoothly, never "block" to a grid.
 */
interface Props {
  children: ReactNode;
  /** Width class applied to each item wrapper (controls how many peek in view). */
  itemClassName?: string;
  /** Auto-scroll speed in px/second. */
  speed?: number;
  /** Horizontal gap between items in px. */
  gap?: number;
  className?: string;
}

export default function AutoScrollCarousel({
  children,
  itemClassName = 'w-[44%] sm:w-[30%] lg:w-[22.5%]',
  speed = 40,
  gap = 12,
  className = '',
}: Props) {
  const items = Children.toArray(children);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const offset = useRef(0);        // current translateX (<= 0)
  const half = useRef(0);          // width of one copy incl. trailing gap
  const paused = useRef(false);    // hover pause
  const dragging = useRef(false);
  const momentum = useRef(0);      // px/s carried after release
  const startX = useRef(0);
  const startOffset = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const moved = useRef(false);     // did this drag pass the click threshold

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // Two copies + a gap between them => (scrollWidth + gap) / 2 per copy.
    half.current = (track.scrollWidth + gap) / 2;
  }, [gap]);

  useEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [measure, items.length]);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const frame = (t: number) => {
      const dt = Math.min((t - prev) / 1000, 0.05); // clamp long gaps (tab blur)
      prev = t;
      const track = trackRef.current;
      if (track) {
        if (!dragging.current) {
          if (Math.abs(momentum.current) > 4) {
            offset.current += momentum.current * dt;
            momentum.current *= Math.pow(0.94, dt * 60); // inertia decay
          } else {
            momentum.current = 0;
            if (!paused.current) offset.current -= speed * dt;
          }
        }
        const h = half.current;
        if (h > 0) {
          while (offset.current <= -h) offset.current += h;
          while (offset.current > 0) offset.current -= h;
        }
        track.style.transform = `translate3d(${offset.current}px,0,0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    momentum.current = 0;
    startX.current = e.clientX;
    startOffset.current = offset.current;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) moved.current = true;
    offset.current = startOffset.current + dx;
    const now = performance.now();
    const dt = (now - lastT.current) / 1000;
    if (dt > 0) momentum.current = (e.clientX - lastX.current) / dt;
    lastX.current = e.clientX;
    lastT.current = now;
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    // Clamp fling so it doesn't rocket across the whole list.
    momentum.current = Math.max(-2600, Math.min(2600, momentum.current));
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Swallow the click that ends a drag so cards don't navigate/open on release.
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  };

  return (
    <div
      ref={viewportRef}
      className={`overflow-hidden select-none ${className}`}
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      style={{ cursor: 'grab', touchAction: 'pan-y' }}
    >
      <div
        ref={trackRef}
        className="flex will-change-transform"
        style={{ gap: `${gap}px` }}
      >
        {[0, 1].map(copy =>
          items.map((child, i) => (
            <div key={`${copy}-${i}`} className={`flex-shrink-0 ${itemClassName}`} aria-hidden={copy === 1}>
              {child}
            </div>
          )),
        )}
      </div>
    </div>
  );
}
