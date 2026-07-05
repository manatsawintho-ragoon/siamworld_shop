'use client';
import { Children, ReactNode, useEffect, useRef } from 'react';

/**
 * AutoScrollCarousel — smooth transform-based marquee.
 *
 * - Auto-scroll: a gentle, continuous glide (never a paged "block" jump).
 *   Finite track — it eases to the right end, then reverses back to the left
 *   end (ping-pong), so the best items on the left always come back into view.
 * - Free drag: grab and fling in either direction with momentum/inertia
 *   (mouse + touch). Position is clamped softly at both ends.
 * - Auto-scroll pauses on hover and while dragging, then resumes.
 *
 * Drag is tracked via window listeners (NOT setPointerCapture), so buttons
 * inside the cards — buy, view details — stay fully clickable; only a real
 * drag (past the movement threshold) swallows the trailing click.
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
  itemClassName = 'w-[44%] sm:w-[30%] md:w-[24%] xl:w-[19%]',
  speed = 32,
  gap = 12,
  className = '',
}: Props) {
  const items = Children.toArray(children);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const offset = useRef(0);      // translateX, in [min, 0]
  const min = useRef(0);         // most-negative offset (right end)
  const dir = useRef(-1);        // auto direction: -1 => reveal right, +1 => back to left
  const paused = useRef(false);  // hover pause
  const dragging = useRef(false);
  const momentum = useRef(0);    // px/s carried after release
  const startX = useRef(0);
  const startOffset = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const moved = useRef(false);   // did this gesture pass the click threshold

  const measure = () => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    min.current = Math.min(0, vp.clientWidth - track.scrollWidth);
    if (offset.current < min.current) offset.current = min.current;
  };

  useEffect(() => {
    measure();
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(track);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

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
            if (!paused.current && min.current < 0) {
              offset.current += dir.current * speed * dt;
            }
          }
        }
        // Clamp at ends and bounce the auto direction (ping-pong).
        if (offset.current > 0) { offset.current = 0; dir.current = -1; momentum.current = 0; }
        else if (offset.current < min.current) { offset.current = min.current; dir.current = 1; momentum.current = 0; }
        track.style.transform = `translate3d(${offset.current}px,0,0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (min.current === 0) return; // nothing to scroll
    dragging.current = true;
    moved.current = false;
    momentum.current = 0;
    startX.current = e.clientX;
    startOffset.current = offset.current;
    lastX.current = e.clientX;
    lastT.current = performance.now();

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX.current;
      if (Math.abs(dx) > 4) moved.current = true;
      offset.current = startOffset.current + dx;
      const now = performance.now();
      const dtt = (now - lastT.current) / 1000;
      if (dtt > 0) momentum.current = (ev.clientX - lastX.current) / dtt;
      lastX.current = ev.clientX;
      lastT.current = now;
    };
    const onUp = () => {
      dragging.current = false;
      momentum.current = Math.max(-2600, Math.min(2600, momentum.current));
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Swallow the click that ends a real drag so cards don't navigate on release.
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
      onClickCapture={onClickCapture}
      style={{ cursor: 'grab', touchAction: 'pan-y' }}
    >
      <div ref={trackRef} className="flex will-change-transform" style={{ gap: `${gap}px` }}>
        {items.map((child, i) => (
          <div key={i} className={`flex-shrink-0 ${itemClassName}`}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
