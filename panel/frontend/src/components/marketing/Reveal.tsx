'use client';
import type { ReactNode } from 'react';
import { useReveal } from '@/hooks/useMotion';

type Variant = 'reveal-up' | 'reveal-pop' | 'reveal-left';

interface Props {
  children: ReactNode;
  /** Which entrance the CSS in globals.css should apply. */
  variant?: Variant;
  /** IntersectionObserver threshold, matching framer's `viewport.amount`. */
  amount?: number;
  /** Per-item stagger in seconds, matching framer's `transition.delay`. */
  delay?: number;
  /** Fired once, the first time the element enters the viewport. */
  onEnter?: () => void;
  className?: string;
}

/**
 * Scroll-triggered entrance, replacing framer-motion's
 * `initial`/`whileInView`/`viewport`/`transition` quartet on the marketing
 * pages. The animation itself lives in CSS (`.reveal-*` + `.is-visible`); this
 * only decides when the class lands. See hooks/useMotion.ts for the why.
 */
export default function Reveal({
  children,
  variant = 'reveal-up',
  amount = 0.3,
  delay = 0,
  onEnter,
  className = '',
}: Props) {
  const ref = useReveal<HTMLDivElement>({ amount, onEnter });
  return (
    <div
      ref={ref}
      className={`${variant} ${className}`.trim()}
      style={delay ? ({ '--reveal-delay': `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Same thing for a table row. A <div> cannot sit inside <tbody>, so the row
 * itself carries the reveal classes rather than being wrapped.
 */
export function RevealRow({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useReveal<HTMLTableRowElement>({ amount: 0.5 });
  return (
    <tr
      ref={ref}
      className={`reveal-left ${className}`.trim()}
      style={delay ? ({ '--reveal-delay': `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </tr>
  );
}
