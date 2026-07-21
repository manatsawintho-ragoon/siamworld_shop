'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Renders its children at a fixed design width and scales the whole thing down
 * to whatever space it is given.
 *
 * This is the reason the mockups read as screenshots. Redrawing a UI at 60%
 * means re-guessing every font size, radius and gap, and the guesses drift
 * apart until the result only resembles the product. Laying it out at the real
 * width and scaling the finished thing keeps every proportion exactly as it is
 * in the running app, which is what a screenshot does, except this one still
 * responds to a pointer.
 *
 * Height is derived from the measured scale so the scaled box still occupies
 * the correct amount of flow (a `transform` alone does not affect layout).
 */
export default function ScaledMock({
  designWidth,
  designHeight,
  children,
  className = '',
}: {
  designWidth: number;
  designHeight: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / designWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div
      ref={ref}
      className={`mock-viewport ${className}`}
      /* Before the first measurement, fall back to the design aspect ratio so
         the block reserves the right height and the page does not jump. */
      style={{ height: scale ? designHeight * scale : undefined, aspectRatio: scale ? undefined : `${designWidth} / ${designHeight}` }}
      aria-hidden="true"
    >
      <div
        className="mock-stage"
        style={{ width: designWidth, height: designHeight, ['--mock-scale' as string]: scale || 0.0001 }}
      >
        {children}
      </div>
    </div>
  );
}
