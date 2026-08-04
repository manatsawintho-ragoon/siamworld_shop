'use client';

import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_MAX = 640;
const GAP = 6;
const MARGIN = 8;

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}

/**
 * The floating surface the calendar lives in.
 *
 * PORTAL, not an inline popover. The date fields sit inside a modal body with
 * `overflow-y-auto`, nested in a shell with `overflow-hidden` at z-[200] (see
 * admin/campaigns/page.tsx and admin/products/page.tsx). An absolutely
 * positioned popover rendered in place is clipped by both, so the calendar
 * would be cut off mid-month for any field low in a scrolled form - which is
 * exactly where the sale-end fields are. The modals themselves already portal
 * to body at z-[200], so z-[300] here layers correctly above them.
 *
 * Desktop is a NON-MODAL popover: focus moves in but Tab is not trapped, since
 * tabbing out is how a keyboard user leaves a date field for the next input.
 * Under 640px it becomes a bottom sheet with a backdrop, which IS modal, so
 * focus is trapped there.
 */
export function PickerSurface({ anchor, open, onClose, children, labelledBy }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_MAX);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Position against the trigger, and keep it there. The scroll listener is on
  // the CAPTURE phase so it also fires for the modal body scrolling, which does
  // not bubble to window.
  useLayoutEffect(() => {
    if (!open || isMobile || !anchor) return;

    const place = () => {
      const el = surfaceRef.current;
      if (!el) return;
      const a = anchor.getBoundingClientRect();
      const h = el.offsetHeight || 340;
      const w = el.offsetWidth || 300;

      const below = window.innerHeight - a.bottom;
      const flipUp = below < h + GAP + MARGIN && a.top > below;
      const top = flipUp ? Math.max(MARGIN, a.top - h - GAP) : a.bottom + GAP;
      const left = Math.min(Math.max(MARGIN, a.left), window.innerWidth - w - MARGIN);
      setPos({ top, left });
    };

    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, isMobile, anchor]);

  // Esc closes without committing; a click outside closes too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (surfaceRef.current?.contains(t)) return;
      if (anchor?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose, anchor]);

  // Focus trap for the mobile sheet ONLY - it has a backdrop and is modal.
  // Trapping the desktop popover would make Tab a dead end.
  useEffect(() => {
    if (!open || !isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const el = surfaceRef.current;
      if (!el) return;
      const f = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isMobile]);

  if (!mounted || !open) return null;

  const surface = (
    <div
      ref={surfaceRef}
      role="dialog"
      aria-modal={isMobile}
      aria-labelledby={labelledBy}
      className={
        isMobile
          ? 'fixed inset-x-0 bottom-0 z-[301] rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.25)] pb-[env(safe-area-inset-bottom)]'
          : 'fixed z-[300] rounded-xl border border-gray-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]'
      }
      style={isMobile ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      onMouseDown={e => e.stopPropagation()}
    >
      {children}
    </div>
  );

  return createPortal(
    isMobile ? (
      <>
        <div className="fixed inset-0 z-[300] bg-black/40" onMouseDown={onClose} />
        {surface}
      </>
    ) : surface,
    document.body
  );
}
