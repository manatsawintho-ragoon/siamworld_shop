'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Motion primitives, hand-rolled.
 *
 * The landing page used framer-motion for three things: reduced-motion
 * detection, scroll-triggered reveals, and a scroll progress bar. That pulled a
 * ~120KB vendor chunk onto the critical path of the site's most important page,
 * and Lighthouse attributed ~1.2s of script evaluation to it on throttled
 * mobile - enough to hold Total Blocking Time near 500ms and, because the main
 * thread was saturated, to delay the LCP text paint by seconds.
 *
 * The three hooks below cover every use the marketing pages had, in a few
 * hundred bytes. framer-motion is still used in the authenticated dashboard,
 * where its cost is paid once behind a login rather than by every visitor.
 */

/** `prefers-reduced-motion: reduce`, tracked live. */
export function useReducedMotion(): boolean {
  // Starts false so SSR and the first client render agree; the effect corrects
  // it before paint matters. Reveals are opt-in additive, so a frame of
  // "motion allowed" never hides content.
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduce;
}

/**
 * Adds `is-visible` to the element the first time it enters the viewport, which
 * is what the `.reveal-on-scroll` CSS in globals.css keys off.
 *
 * One observer per element rather than a shared one: the element counts are
 * small (tens, not thousands) and per-element observers keep the API a plain
 * ref with no registry to leak.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  { amount = 0.3, onEnter }: { amount?: number; onEnter?: () => void } = {}
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (or reduced motion handled in CSS): show it.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      onEnter?.();
      return;
    }

    // Already on screen at mount - reveal immediately, so above-the-fold
    // content is never stuck at opacity 0 waiting for a scroll that never comes.
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          el.classList.add('is-visible');
          onEnter?.();
          io.disconnect();
        }
      },
      { threshold: amount }
    );
    io.observe(el);
    return () => io.disconnect();
    // onEnter is a one-shot side effect; re-running on identity change would
    // re-observe an already revealed element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  return ref;
}

/**
 * Fraction of the document scrolled, 0..1, written straight to a CSS custom
 * property so the progress bar animates on the compositor and React never
 * re-renders for it.
 */
export function useScrollProgress(target: string = '--scroll-progress') {
  useEffect(() => {
    let raf = 0;
    // `max` is cached rather than read every frame, because reading scrollHeight
    // forces a synchronous layout flush. It is refreshed on resize, and lazily
    // whenever the scroll position reaches the height we last measured - which is
    // how a document that grew (the `content-visibility: auto` sections resolve
    // their real heights as they scroll into view) corrects itself without an
    // observer. An earlier attempt used a ResizeObserver on the root element for
    // this; it fired while those sections were resolving and turned one reflow
    // per frame into several, which is the opposite of the point.
    let max = 0;
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
    };
    const write = () => {
      raf = 0;
      if (window.scrollY >= max) measure();
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      document.documentElement.style.setProperty(target, String(p));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    write();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target]);
}
