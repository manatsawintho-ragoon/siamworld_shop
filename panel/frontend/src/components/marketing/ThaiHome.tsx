'use client';
import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import { useTranslations, useLocale } from 'next-intl';
import AuthCodeExchange from '@/components/AuthCodeExchange';
import api from '@/lib/api';
import { FAQ, EASYSLIP_FEE_MAX } from '@/lib/faq';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/icon';
import { getTier, type TierKey } from '@/lib/rarity';
import { DashboardMock, MOCK_SLIDES } from '@/components/landing/UiMocks';

/* Scroll progress, styled as an XP bar: continuous motion that tracks the
   reader's own position rather than animating on its own, so it adds life
   without competing for attention. The notches come from a repeating
   gradient (.xp-fill), not extra DOM. Hidden under prefers-reduced-motion. */
function ScrollProgress() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });
  if (reduceMotion) return null;
  return (
    <motion.div
      style={{ scaleX }}
      className="xp-fill fixed top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-primary via-amber-400 to-primary origin-left z-[120] pointer-events-none"
      aria-hidden="true"
    />
  );
}

interface Package { months: number; price: number; label: string; save: number; kind?: 'regular' | 'trial' | 'intro' }
interface Promo {
  kind: 'trial' | 'intro';
  months: number;
  days?: number;
  price: number;
  label: string;
  regularPrice: number;
}

/* Fallbacks only. The live numbers come from /api/subscriptions/packages, but
   these are what the prerendered HTML shows, so they are kept in step with the
   configured prices (`price_1month` / `price_3months` / `price_6months`).
   `save` is the regular cost of the same span (months x 1-month price) minus
   what the package actually costs. */
const DEFAULT_PACKAGES: Package[] = [
  { months: 1, price: 249,  label: '1 เดือน',  save: 0,   kind: 'regular' },
  { months: 3, price: 599,  label: '3 เดือน',  save: 148, kind: 'regular' },
  { months: 6, price: 1099, label: '6 เดือน',  save: 395, kind: 'regular' },
];

const DEFAULT_PROMOS: Promo[] = [
  { kind: 'trial', months: 0, days: 7, price: 0,  label: 'trialFree7', regularPrice: 249 },
  { kind: 'intro', months: 1,           price: 99, label: 'introMonth', regularPrice: 249 },
];

/** The single primary action on this page. Every hero/section CTA points here. */
const PRIMARY_CTA = { href: '/order?kind=trial', label: 'ctaStartTrial' };

/* ── Package tiers ───────────────────────────────────────────────────
   Every plan ships the same feature set, so repeating the full list in all
   three cards just buries the prices. Instead each card states who it suits
   and the few points that actually differ, and the shared list is rendered
   once below the grid.

   Tier rank tracks price, so the rail reads as one ladder: COMMON (free trial)
   through LEGENDARY (6 months). The recommended card is EPIC, not LEGENDARY:
   it should read as the smart pick rather than the maxed-out one. */
interface TierCopy {
  tier: TierKey;
  /** Who this plan suits, one short line under the title. */
  audience: string;
  /** Single reason to pick this one, shown as the card's hook. */
  hook: string;
  points: { icon: IconName; text: string; tone?: 'good' | 'muted' | 'off' }[];
}

/** Points every paid plan shares, so each plan only lists what differs. */
const PAID_POINTS: TierCopy['points'] = [
  { icon: 'circle-check', text: 'pointAllFeatures', tone: 'good' },
  { icon: 'qrcode',       text: 'pointSlipAuto' },
  { icon: 'wallet',       text: 'pointTrueMoneyFree', tone: 'good' },
];

export type PlanId = 'trial' | 'intro' | 'm1' | 'm3' | 'm6';

/* Cheapest to most expensive: ฿0, ฿99, ฿249, ฿599, ฿1099. A price ladder is
   the order a buyer expects, and it means the discount on each card grows as
   you drag right. The recommended plan (m3) sits off the initial viewport on
   narrow screens, so it is also called out in a strip under the rail. */
const PLAN_ORDER: PlanId[] = ['trial', 'intro', 'm1', 'm3', 'm6'];

/** The plan the page actively recommends. Gets the featured card treatment. */
const FEATURED_PLAN: PlanId = 'm3';

const TIER_COPY: Record<PlanId, TierCopy> = {
  trial: {
    tier: 'common',
    audience: 'tierTrialAudience',
    hook: 'tierTrialHook',
    points: [
      { icon: 'circle-check', text: 'pointAllFeatures', tone: 'good' },
      { icon: 'clock',        text: 'pointTrial7' },
      { icon: 'wallet',       text: 'pointTrueMoneyFree', tone: 'good' },
      { icon: 'circle-xmark', text: 'pointNoSlip', tone: 'off' },
    ],
  },
  intro: {
    tier: 'uncommon',
    audience: 'tierIntroAudience',
    hook: 'tierIntroHook',
    points: [...PAID_POINTS, { icon: 'shield-check', text: 'pointCancelAnytimeNoContract' }],
  },
  m1: {
    tier: 'rare',
    audience: 'tierM1Audience',
    hook: 'tierM1Hook',
    points: [...PAID_POINTS, { icon: 'shield-check', text: 'pointCancelAnytime' }],
  },
  m3: {
    tier: 'epic',
    audience: 'tierM3Audience',
    hook: 'tierM3Hook',
    points: [...PAID_POINTS, { icon: 'arrows-rotate', text: 'pointRenewLess' }],
  },
  m6: {
    tier: 'legendary',
    audience: 'tierM6Audience',
    hook: 'tierM6Hook',
    points: [...PAID_POINTS, { icon: 'arrows-rotate', text: 'pointPayOnce' }],
  },
};

/* ── Discount maths ──────────────────────────────────────────────────
   Two shapes arrive from the API: packages carry `save` (regular cost of the
   same span minus the package price) and promos carry `regularPrice`. Both
   reduce to the same three numbers, so the cards render one way regardless of
   which endpoint a plan came from. A plan with neither is simply not on sale. */
interface Discount { regular: number; save: number; percent: number }

function getDiscount(pkg: { price: number; save?: number; regularPrice?: number }): Discount | null {
  const price = Number(pkg.price);
  const regular = Number(pkg.regularPrice ?? price + Number(pkg.save || 0));
  const save = regular - price;
  if (!(save > 0) || !(regular > 0)) return null;
  return { regular, save, percent: Math.round((save / regular) * 100) };
}

const STEPS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'user-pen',
    title: 'step1Title',
    desc: 'step1Desc',
  },
  {
    icon: 'plug',
    title: 'step2Title',
    desc: 'step2Desc',
  },
  {
    icon: 'sack-dollar',
    title: 'step3Title',
    desc: 'step3Desc',
  },
];

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'rocket',
    title: 'featAutoDeployTitle',
    desc: 'featAutoDeployDesc',
  },
  {
    icon: 'qrcode',
    title: 'featPayTitle',
    desc: 'featPayDesc',
  },
  {
    icon: 'box-open',
    title: 'featLootTitle',
    desc: 'featLootDesc',
  },
  {
    icon: 'gears',
    title: 'featManageTitle',
    desc: 'featManageDesc',
  },
];

/** Factual, non-defamatory comparison. Competitors are described by category,
 *  never by brand, so no claim is attached to a specific company. */
const COMPARISON: { label: string; ours: string; custom: string; foreign: string }[] = [
  { label: 'cmpStartCost',              ours: 'cmpOursStart', custom: 'tensOfThousandsUp',   foreign: 'cmpForeignPercent' },
  { label: 'cmpTimeToSell',      ours: 'cmpOursTime',                  custom: 'cmpCustomTime',  foreign: 'cmpSelfConfig' },
  { label: 'cmpSlipAuto', ours: 'cmpOursReady',              custom: 'cmpCustomBuild',    foreign: 'mostlyUnsupported' },
  { label: 'cmpTrueMoney',          ours: 'cmpOursFree',    custom: 'cmpCustomBuild',    foreign: 'cmpForeignNo' },
  { label: 'cmpConnect',          ours: 'cmpOursPlugin',   custom: 'cmpForeignSelf',        foreign: 'cmpCustomPort' },
  { label: 'cmpUpdates',          ours: 'cmpOursIncluded',          custom: 'cmpCustomPay',  foreign: 'cmpForeignDepends' },
  { label: 'cmpThaiSupport',            ours: 'cmpOursThai',               custom: 'cmpCustomDepends',  foreign: 'footerEnglish' },
];

/* A showcase slide is either an operator-uploaded screenshot or one of the
   coded mockups. Uploads always win: /admin/showcase stays the way to put your
   own shop on the landing page. The mockups are what everyone sees until then,
   which beats shipping screenshots of somebody else's shop. */
interface ShowcaseSlide {
  key: string;
  title: string;
  desc: string;
  /** Present only for uploaded slides, which are the ones that can open in the lightbox. */
  src?: string;
  Mock?: () => React.ReactElement;
}

/* ── Animated headline ───────────────────────────────────────────────── */

/** The two headline lines. The second one carries the accent colour. */
const HEADLINE_LINES: { text: string; accent?: boolean }[] = [
  { text: 'heroOpenShop' },
  { text: 'heroSellToday', accent: true },
];

/* Thai stacks vowels and tone marks on top of a base consonant, so slicing the
   raw string mid-cluster would leave a mark stranded on its own and change the
   glyph width. The text is therefore split into base+marks clusters and the
   animation advances one cluster at a time. Segmenting with an explicit mark
   range rather than Intl.Segmenter keeps the server and the client identical,
   which matters because the first render is server-side. */
const THAI_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

function toClusters(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (out.length && THAI_MARKS.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

const TYPE_MS = 62;
const DELETE_MS = 28;
const HOLD_FULL_MS = 2600;
const HOLD_EMPTY_MS = 600;

const Caret = () => (
  <span
    aria-hidden="true"
    className="animate-caret inline-block w-[4px] md:w-[5px] h-[0.8em] bg-primary ml-1 align-middle rounded-full"
  />
);

/**
 * Types the headline one character at a time and erases it the same way, so the
 * caret glides through the text instead of whole words popping in and out.
 *
 * Each line is rendered twice: a full-text copy at zero opacity that reserves
 * the exact box, and the animated slice absolutely positioned on top. That way
 *   - the complete H1 text is always in the DOM for crawlers and screen readers
 *   - the line never reflows as characters appear or vanish (no CLS)
 *   - the server-rendered HTML shows the finished headline; the animation only
 *     starts after hydration, so there is no hydration mismatch
 *
 * Kept as its own component so its per-character state updates re-render this
 * heading alone, not the entire landing page.
 */
function TypewriterHeadline() {
  const t = useTranslations('home');
  const reduceMotion = useReducedMotion();
  const lines = useMemo(
    () => HEADLINE_LINES.map(l => ({ ...l, clusters: toClusters(l.text) })),
    []
  );
  const total = useMemo(() => lines.reduce((n, l) => n + l.clusters.length, 0), [lines]);

  const [shown, setShown] = useState(total);
  const [deleting, setDeleting] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Start only on the client, and never when the user asked for less motion.
  useEffect(() => {
    if (reduceMotion) return;
    setAnimating(true);
    setShown(0);
    setDeleting(false);
  }, [reduceMotion]);

  useEffect(() => {
    if (!animating) return;
    const delay = deleting
      ? (shown > 0 ? DELETE_MS : HOLD_EMPTY_MS)
      : (shown < total ? TYPE_MS : HOLD_FULL_MS);
    const timer = setTimeout(() => {
      if (deleting) {
        if (shown > 0) setShown(s => s - 1);
        else setDeleting(false);
      } else {
        if (shown < total) setShown(s => s + 1);
        else setDeleting(true);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [animating, shown, deleting, total]);

  /* Walk the lines once, handing each the slice of `shown` that belongs to it.
     The caret sits on whichever line the animation is currently working
     through, and parks on the last line once the headline is complete. */
  let start = 0;
  const rendered = lines.map((l, i) => {
    const end = start + l.clusters.length;
    const count = Math.max(0, Math.min(shown - start, l.clusters.length));
    const hasCaret = animating && shown >= start && (shown < end || i === lines.length - 1);
    start = end;
    return { ...l, count, hasCaret };
  });

  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.15] mb-6 tracking-tight text-foreground">
      {rendered.map((l, i) => (
        <span key={i} className={`relative block ${l.accent ? 'text-primary mt-2' : ''}`}>
          <span className="opacity-0">{l.text}</span>
          <span aria-hidden="true" className="absolute inset-0 select-none pointer-events-none">
            {animating ? l.clusters.slice(0, l.count).join('') : l.text}
            {l.hasCaret && <Caret />}
          </span>
        </span>
      ))}
    </h1>
  );
}

/* ── Count-up number ─────────────────────────────────────────────────── */

/** Counts from 0 up to `value` once, when the number first becomes known. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) { setDisplay(value); return; }
    let raf = 0;
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // ease-out cubic: fast start, settles gently on the real number
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion]);

  return <>{display.toLocaleString()}{suffix}</>;
}

/* ── Section heading ─────────────────────────────────────────────────── */

function SectionHead({ eyebrow, title, sub, center = true }: { eyebrow: string; title: React.ReactNode; sub?: string; center?: boolean }) {
  const t = useTranslations('home');
  return (
    <div className={`max-w-2xl mb-12 ${center ? 'mx-auto text-center' : ''}`}>
      <span className="inline-block text-[13px] font-semibold text-primary mb-3">
        {eyebrow}
      </span>
      <h2 className="text-3xl md:text-5xl font-semibold text-foreground tracking-tight leading-tight">{title}</h2>
      {sub && <p className="text-muted-foreground text-lg mt-4 leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ── Hero customer marquee ───────────────────────────────────────────
   Compact social proof directly under the primary CTA: a narrow viewport
   shows roughly four or five shops at a time while the track loops left
   through every one of them.

   `shopCount` comes from the same public stat the counters use, so the
   headline number here and the one in the stats row can never disagree. The
   pills themselves are the shops that are currently live, so nothing links to
   a site that is down. */
function HeroShopMarquee({ shops, shopCount }: { shops: { name: string; domain: string }[]; shopCount?: number }) {
  const t = useTranslations('home');
  if (!shops.length) return null;
  const total = shopCount ?? shops.length;

  return (
    <div className="hero-pop-3 mt-6 max-w-xl">
      <p className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground mb-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 animate-soft-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span>
          <span className="text-foreground font-semibold tabular-nums">{total}</span>{t('serversWithUs')}</span>
      </p>

      <div className="marquee-viewport relative w-full overflow-hidden">
        {/* The list is rendered twice and shifted by exactly -50%, so the loop
            lands on an identical frame. The duplicate half is hidden from
            assistive tech and removed from the tab order. */}
        <div className="marquee-track flex w-max gap-2.5 items-center py-1">
          {[...shops, ...shops].map((s, i) => (
            <a
              key={i}
              href={`https://${s.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-hidden={i >= shops.length}
              tabIndex={i >= shops.length ? -1 : undefined}
              className="flex shrink-0 items-center gap-2 bg-card px-3 py-2 rounded-lg border border-border shadow-sm hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group/shop"
            >
              <span
                className="grid place-items-center w-5 h-5 rounded bg-primary/10 text-primary text-[12px] font-semibold shrink-0 group-hover/shop:bg-primary group-hover/shop:text-primary-foreground transition-colors"
                aria-hidden="true"
              >
                {s.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="text-[13px] font-medium text-foreground/80 tracking-tight whitespace-nowrap group-hover/shop:text-primary transition-colors">
                {s.name}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
            </a>
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
}

/* ── Plan rail ───────────────────────────────────────────────────────
   Every plan lives in one horizontal scroller. The default view lands on the
   three headline tiers (COMMON / EPIC / LEGENDARY); the remaining plans are a
   drag to the right.

   The drift is applied by nudging `scrollLeft` on a native scroll container
   rather than transforming a track, which matters: native scrolling stays
   interruptible, so a drag, wheel, keyboard or scrollbar grab takes over
   mid-drift instead of fighting it. Any interaction pauses the drift and it
   resumes after a short idle. Sub-pixel speed is accumulated separately
   because `scrollLeft` snaps to integers. */
function PlanRail({ children, count }: { children: React.ReactNode; count: number }) {
  const t = useTranslations('home');
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /* Mouse drag has to be implemented by hand. A native scroll container gives
     you touch drag, wheel, trackpad and the scrollbar for free, but a mouse
     press-and-move does nothing at all, which is why the rail felt dead on
     desktop. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.classList.add('is-dragging');
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      el.scrollLeft = startScroll - dx;
      // Only capture once the gesture is clearly a drag, so a plain click on a
      // card's button still reaches the button.
      if (moved > 6 && el.hasPointerCapture?.(e.pointerId) === false) {
        el.setPointerCapture(e.pointerId);
      }
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    // A drag that ends on top of a link would otherwise fire that link.
    const onClickCapture = (e: MouseEvent) => {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('click', onClickCapture, true);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  // Arrow enable/disable state.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      setAtStart(el.scrollLeft <= 2);
      setAtEnd(el.scrollLeft >= max - 2);
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => { el.removeEventListener('scroll', sync); window.removeEventListener('resize', sync); };
  }, [count]);

  /* Auto-drift. Honours prefers-reduced-motion: someone who asked the OS for
     less movement should not get a panel that slides on its own, so for them
     the rail only moves via drag, arrows, wheel or keyboard. */
  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let dir = 1;
    let acc = 0;
    let hovering = false;
    let resumeAt = 0;
    const SPEED = 0.5;

    const pause = () => { resumeAt = performance.now() + 3000; };
    const onEnter = () => { hovering = true; };
    const onLeave = () => { hovering = false; resumeAt = performance.now() + 800; };

    const passive = { passive: true } as const;
    el.addEventListener('pointerdown', pause, passive);
    el.addEventListener('wheel', pause, passive);
    el.addEventListener('touchstart', pause, passive);
    el.addEventListener('keydown', pause, passive);
    el.addEventListener('mouseenter', onEnter, passive);
    el.addEventListener('mouseleave', onLeave, passive);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1 || hovering || now < resumeAt) return;

      // scrollLeft is integral, so sub-pixel speed is accumulated separately.
      acc += SPEED * dir;
      const step = Math.trunc(acc);
      if (step !== 0) {
        acc -= step;
        el.scrollLeft += step;
        if (el.scrollLeft >= max - 1) dir = -1;
        else if (el.scrollLeft <= 1) dir = 1;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('wheel', pause);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('keydown', pause);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [reduceMotion]);

  const nudge = (dirn: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector(':scope > *') as HTMLElement | null;
    const amount = card ? card.offsetWidth + 20 : 320;
    el.scrollBy({ left: amount * dirn, behavior: 'smooth' });
  };

  const arrowBase =
    'grid place-items-center w-11 h-11 rounded-full border-2 border-border bg-card shadow-lg transition-all duration-200 cursor-pointer hover:border-primary hover:text-primary hover:scale-110 disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className="relative">
      {/* Generous vertical padding: overflow-x also clips vertically, so
          without it the featured card's lift and glow get cut off. */}
      <div
        ref={ref}
        className="plan-rail flex gap-5 overflow-x-auto py-10 px-1 -mx-1 items-stretch"
        tabIndex={0}
        role="region"
        aria-label={t('allPlansAria', { count })}
      >
        {children}
      </div>

      {/* Edge fades hint that the rail continues past the viewport. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 md:w-16 bg-gradient-to-r from-background to-transparent z-10" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 md:w-16 bg-gradient-to-l from-background to-transparent z-10" aria-hidden="true" />

      <button
        type="button"
        onClick={() => nudge(-1)}
        disabled={atStart}
        aria-label={t('prevPlan')}
        className={`${arrowBase} absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 z-20`}
      >
        <Icon name="chevron-left" className="text-lg" />
      </button>
      <button
        type="button"
        onClick={() => nudge(1)}
        disabled={atEnd}
        aria-label={t('nextPlan')}
        className={`${arrowBase} absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 z-20`}
      >
        <Icon name="chevron-right" className="text-lg" />
      </button>
    </div>
  );
}

/* ── Pricing card ────────────────────────────────────────────────────── */

function PackageCard({
  pkg,
  planId,
  index = 0,
  easyslipFee,
  onShowEasySlip,
}: { pkg: any; planId: PlanId; index?: number; easyslipFee: number; onShowEasySlip: () => void }) {
  const t = useTranslations('home');
  const reduceMotion = useReducedMotion();
  // Touch devices have no hover, so the glow is armed when the card scrolls
  // into view instead. CSS picks whichever applies via @media (hover: …).
  const [armed, setArmed] = useState(false);

  const copy = TIER_COPY[planId];
  const tier = getTier(copy.tier);

  const isTrial = planId === 'trial';
  const isIntro = planId === 'intro';
  const featured = planId === FEATURED_PLAN;

  /* The free trial is not "100% off", it is free, so it skips the discount
     block entirely and lets the ฿0 speak for itself. */
  const discount = isTrial ? null : getDiscount(pkg);
  const perMonth = pkg.months > 1 ? Math.round(pkg.price / pkg.months) : null;

  /* One badge per card at most, and never one that repeats the discount pill
     right below it. 6 months keeps the honest claim it can actually make
     (cheapest per month, not the biggest saving as a share of the price). */
  const badge = featured
    ? t('recommendedValue')
    : planId === 'm6'
      ? t('cheapestPerMonth')
      : isIntro
        ? t('newCustomersOnly')
        : null;

  const unit = isTrial
    ? t('planDays', { n: pkg.days })
    : isIntro
      ? t('firstMonth')
      : pkg.months === 1
        ? t('month')
        : pkg.label;

  return (
    <motion.div
      className={`h-full ${featured ? 'z-10' : ''}`}
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      onViewportEnter={() => setArmed(true)}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.34, 1.3, 0.64, 1] }}
    >
      <Card
        className={`landing-tier-card flex flex-col relative h-full overflow-hidden border-2 rounded-2xl ${armed ? 'tier-armed' : ''} ${
          featured
            ? 'card-sheen landing-tier-featured shadow-2xl bg-card scale-[1.04] md:scale-[1.06] z-10'
            : 'bg-card/70 shadow-sm'
        }`}
        style={{
          ['--tier' as string]: tier.color,
          ['--tier-glow' as string]: tier.glow,
          borderColor: featured ? tier.color : undefined,
        }}
      >
        {/* Rarity strip: the tier colour reads before any text does. It starts
            below the badge row so the badge never sits on top of it. */}
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: tier.color }} aria-hidden="true" />

        {badge && (
          <div className="absolute top-1.5 left-0 right-0 flex justify-center z-20">
            <Badge
              className={`rounded-t-none px-4 py-1 text-[12px] tracking-wider font-semibold shadow-lg border-none whitespace-nowrap ${
                featured ? 'bg-primary text-primary-foreground' : 'bg-foreground/85 text-background'
              }`}
            >
              {badge}
            </Badge>
          </div>
        )}

        <CardHeader className={badge ? 'pb-4 pt-11' : 'pb-4 pt-8'}>
          {/* Tier is stated in text as well as colour, so it survives both
              colour-blindness and greyscale printing. */}
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-white leading-none mb-3"
            style={{ backgroundColor: tier.color }}
          >
            <Icon name={tier.icon} className="text-[10px]" />
            {tier.label}
          </span>
          <CardTitle className="text-lg font-semibold">{isTrial ? t('trialFree') : pkg.label}</CardTitle>
          <p className="text-[12px] font-semibold text-muted-foreground mt-1.5 leading-snug">{t(copy.audience)}</p>
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mt-3">
            <span className="text-5xl font-semibold tracking-tighter text-foreground tabular-nums">
              ฿{pkg.price.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-muted-foreground">/{unit}</span>
          </div>

          {/* Discounted plans state the same thing three ways, because each
              answers a different question: what it used to cost, how deep the
              cut is, and how many baht stay in your pocket. */}
          {discount && (
            <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
              <span
                className="text-base font-bold text-destructive/70 line-through tabular-nums"
                aria-label={t('normalPriceAria', { price: discount.regular })}
              >
                ฿{discount.regular.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[13px] font-semibold text-destructive">
                <Icon name="arrow-down" className="text-[9px]" />
                {t('discountPercent', { percent: discount.percent })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[13px] font-semibold text-emerald-600">
                <Icon name="tag" className="text-[9px]" />
                {t('saveAmount', { amount: discount.save.toLocaleString() })}
              </span>
            </div>
          )}

          {/* The number that makes the long plans comparable to the short ones. */}
          {perMonth && (
            <p className="text-[12px] font-medium text-foreground/80 mt-2 tabular-nums">
              {t('avgPerMonthAmount', { amount: perMonth.toLocaleString() })}
            </p>
          )}

          {/* One-line hook: the single reason to pick this plan over the others. */}
          <p className="text-[13px] font-medium mt-3 leading-snug" style={{ color: tier.color }}>{t(copy.hook)}</p>
          {isIntro && discount && (
            <p className="text-[12px] text-muted-foreground mt-1.5 font-medium">
              {t('nextMonthPrice', { price: discount.regular.toLocaleString() })}
            </p>
          )}
        </CardHeader>

        {/* Plan-specific points only. The list shared by every plan is
            rendered once below the grid, so the prices stay the most legible
            thing in this section. */}
        <CardContent className="flex-1 pb-6">
          <ul className="space-y-3">
            {copy.points.map(p => (
              <li
                key={p.text}
                className={`flex items-start gap-2.5 ${
                  p.tone === 'good'
                    ? 'text-[13px] font-medium text-emerald-600'
                    : p.tone === 'off'
                      ? 'text-[13px] font-medium text-muted-foreground/70'
                      : 'text-[13px] font-medium text-muted-foreground'
                }`}
              >
                <Icon
                  name={p.icon}
                  className={`text-base mt-0.5 shrink-0 ${
                    p.tone === 'good' ? 'text-emerald-500' : p.tone === 'off' ? 'text-destructive/50' : 'text-primary/60'
                  }`}
                />
                <span>{t(p.text)}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pt-0 flex-col items-stretch gap-3">
          <Button
            className={`w-full rounded-full font-semibold tracking-wide h-12 transition-all cursor-pointer ${
              featured ? 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl' : 'bg-background border-2 border-border hover:bg-secondary text-foreground'
            }`}
            variant={featured ? 'default' : 'outline'}
            asChild
          >
            <Link href={isTrial ? '/order?kind=trial' : (isIntro ? '/order?kind=intro' : `/order?months=${pkg.months}`)}>
              {isTrial ? t('ctaStartTrialShort') : t('orderPlan')}
            </Link>
          </Button>
          {!isTrial && (
            <button
              onClick={onShowEasySlip}
              className="text-[13px] font-semibold text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Icon name="circle-info" className="text-xs" />
              {t('slipFeePerItem', { fee: easyslipFee })}
            </button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

/* ── FAQ accordion ───────────────────────────────────────────────────── */

function FaqSection() {
  const t = useTranslations('home');
  const tFaq = useTranslations('faq');
  const [open, setOpen] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

  return (
    <section id="faq" className="py-20 md:py-24 bg-background border-t border-border">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHead eyebrow={t('secFaq')} title={t('stillDeciding')} sub={t('secFaqSub')} />

        <div className="space-y-3">
          {FAQ.map((item, i) => {
            const qKey = `q${i + 1}` as const;
            const aKey = `a${i + 1}` as const;
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
                className={`rounded-2xl border transition-colors ${isOpen ? 'border-primary/40 bg-card' : 'border-border bg-card/50 hover:border-primary/25'}`}
              >
                <h3>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 min-h-[56px] cursor-pointer"
                  >
                    <span className="font-bold text-foreground text-[15px] leading-snug">{tFaq(qKey)}</span>
                    <Icon
                      name="chevron-down"
                      className={`text-muted-foreground shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`}
                    />
                  </button>
                </h3>
                {/* Collapsed with a 0fr -> 1fr grid row rather than unmounting,
                    so the answer text stays in the DOM for crawlers and in-page
                    search while still animating open smoothly. */}
                <div
                  id={`faq-panel-${i}`}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 -mt-1 text-[14px] text-muted-foreground leading-relaxed font-medium">
                      {tFaq(aKey, { fee: EASYSLIP_FEE_MAX })}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

function LandingContent() {
  const t = useTranslations('home');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();

  const [packages, setPackages] = useState<Package[]>(DEFAULT_PACKAGES);
  const [promos, setPromos] = useState<Promo[]>(DEFAULT_PROMOS);
  const [easyslipFee, setEasyslipFee] = useState<number>(EASYSLIP_FEE_MAX);
  const [statsData, setStatsData] = useState<any>(null);
  const [shops, setShops] = useState<{ name: string; domain: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [showEasySlipPlan, setShowEasySlipPlan] = useState(false);
  // Fills the quest-chain line once the steps section is first reached.
  const [questFilled, setQuestFilled] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadedSlides, setUploadedSlides] = useState<ShowcaseSlide[]>([]);

  useEffect(() => {
    api.get('/api/subscriptions/packages').then(r => {
      if (r.data.packages?.length) setPackages(r.data.packages);
      if (r.data.promos?.length) setPromos(r.data.promos);
      if (typeof r.data.easyslipFee === 'number') setEasyslipFee(r.data.easyslipFee);
    }).catch(() => {});
    api.get('/api/subscriptions/public-stats').then(r => setStatsData(r.data)).catch(() => {});
    api.get('/api/subscriptions/public-shops').then(r => { if (r.data.shops?.length) setShops(r.data.shops); }).catch(() => {});
    // Operator-managed feature showcase. Falls back to the coded mockups below.
    api.get('/api/showcase').then(r => {
      const items = (r.data.items || []) as { title: string; description: string; image_data: string }[];
      if (items.length) {
        setUploadedSlides(items.map((i, n) => ({
          key: `upload-${n}`, src: i.image_data, title: i.title, desc: i.description,
        })));
      }
    }).catch(() => {});
  }, []);

  const showcase: ShowcaseSlide[] = useMemo(
    () => (uploadedSlides.length
      ? uploadedSlides
      : MOCK_SLIDES.map(m => ({ key: m.key, title: m.title, desc: m.desc, Mock: m.Mock }))),
    [uploadedSlides]
  );

  // An upload arriving after the auto-advance has moved on must not leave the
  // index pointing past the end of the shorter list.
  useEffect(() => { setCurrentIndex(0); }, [uploadedSlides.length]);

  const nextImage = () => setCurrentIndex(prev => (prev + 1) % showcase.length);
  const prevImage = () => setCurrentIndex(prev => (prev - 1 + showcase.length) % showcase.length);

  /* Long enough to watch a mockup's animation loop all the way through. Each
     mock runs a 12s worked example (the gacha reel spins, decelerates and
     lands; the top-up flow selects, scans and confirms), so advancing at 6s
     cut every one of them off halfway. */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % showcase.length);
    }, 14000);
    return () => clearInterval(interval);
  }, [showcase.length]);

  /* Live counters. Rendered as skeletons until the API answers, so the
     prerendered HTML never advertises "0 customers" to crawlers.
     `num` counts up on arrival; `text` is shown as-is. */
  const stats: { label: string; num?: number; text?: string; icon: IconName }[] = useMemo(() => [
    /* Cumulative wording on purpose: `total_shops` counts every non-cancelled
       subscription, which includes shops whose subscription has since lapsed.
       Labelling that "เปิดใช้งาน" (currently active) would overstate it. The
       hero marquee shows this same number with the same wording. */
    { label: t('serversWithUs'), num: statsData ? (statsData.total_shops || 0) : undefined, icon: 'store' },
    { label: t('membersInSystem'),        num: statsData ? (statsData.total_users || 0) : undefined, icon: 'users' },
    { label: t('installedWithin'),    text: statsData?.delivery_speed || undefined, icon: 'bolt' },
    { label: t('autoReceive'),      text: '24 ชม.', icon: 'qrcode' },
  ], [statsData]);

  const trialPromo = promos.find(p => p.kind === 'trial');
  const introPromo = promos.find(p => p.kind === 'intro');

  /* Every plan the rail shows, in PLAN_ORDER. Plans the API does not return
     are dropped rather than rendered empty, so a backend that only offers
     some packages still produces a coherent rail. */
  const planCards = useMemo(() => {
    const byId: Record<PlanId, any> = {
      trial: trialPromo,
      intro: introPromo,
      m1: packages.find(p => p.months === 1),
      m3: packages.find(p => p.months === 3),
      m6: packages.find(p => p.months === 6),
    };
    return PLAN_ORDER.filter(id => byId[id]).map(id => ({ id, pkg: byId[id] }));
  }, [trialPromo, introPromo, packages]);

  /* The recommended plan again, outside the rail. The rail is a price ladder,
     so on a narrow screen the recommendation starts off-viewport; this strip
     puts it in front of everyone without breaking the ordering. */
  const featuredPkg = planCards.find(p => p.id === FEATURED_PLAN)?.pkg;
  const featuredDiscount = featuredPkg ? getDiscount(featuredPkg) : null;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ScrollProgress />

      {/* Promo strip: the offer stays visible before anything else loads */}
      <div className="promo-strip-anim bg-gradient-to-r from-primary via-amber-500 to-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-center gap-2 text-center text-[12px] md:text-[13px] font-medium">
          <Icon name="sparkles" className="shrink-0" />
          <span>{t('trialNoCardIntro')}</span>
        </div>
      </div>

      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-16 md:pt-16 md:pb-20 overflow-hidden">
        <div className="animate-blob-drift absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="animate-blob-drift absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[520px] h-[520px] bg-emerald-500/5 rounded-full blur-[110px] pointer-events-none" style={{ animationDelay: '-9s' }} />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center relative z-10">
          <div>
            <div className="hero-pop-1">
              <TypewriterHeadline />
            </div>

            {/* Broken into short lines on purpose: Thai has no spaces between
                words, so a long unbroken paragraph is hard to scan. Each line
                is one idea. */}
            <p className="hero-pop-2 text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl font-medium">{t('heroSubtitle')}<br className="hidden sm:block" />{t('playersTopUpAuto')}<br className="hidden sm:block" />{t('heroNoCode')}</p>

            <div className="hero-pop-2 flex flex-col sm:flex-row gap-3 mb-5">
              <Button size="lg" className="cta-sweep relative overflow-hidden h-14 px-8 text-base font-semibold rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer" asChild>
                <Link href={PRIMARY_CTA.href}>
                  <Icon name="rocket" className="mr-2" /> {t(PRIMARY_CTA.label)}
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-8 text-base font-bold rounded-full cursor-pointer" asChild>
                <a href="#pricing">{t('ctaSeePricing')}</a>
              </Button>
            </div>

            {/* Objection handling right under the primary CTA */}
            <ul className="hero-pop-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-muted-foreground">
              {[t('noCard'), t('pointCancelAnytime'), t('readyIn10')].map(t => (
                <li key={t} className="flex items-center gap-1.5">
                  <Icon name="circle-check" className="text-emerald-500" /> {t}
                </li>
              ))}
            </ul>

            <HeroShopMarquee shops={shops} shopCount={statsData?.total_shops} />
          </div>

          {/* The dashboard, rendered as markup rather than a screenshot: it
              follows the theme, stays sharp at any density, and responds to the
              pointer, which is as close as a landing page gets to a trial. */}
          <div className="relative hero-pop-3">
            <div className="relative z-20">
              <DashboardMock />
            </div>
          </div>
        </div>
      </section>

      {/* ── Live stats ───────────────────────────────────────────────── */}
      <section className="py-10 bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: 'easeOut' }}
                className="flex items-center gap-3 md:gap-4 justify-center group"
              >
                <div className="w-11 h-11 rounded-xl bg-background shadow-sm flex items-center justify-center text-primary border border-border shrink-0 group-hover:scale-110 group-hover:border-primary/40 transition-all duration-300">
                  <Icon name={stat.icon} className="text-lg" />
                </div>
                <div className="min-w-0">
                  {stat.num === undefined && stat.text === undefined ? (
                    <span className="block h-7 w-20 rounded-md bg-muted animate-pulse" aria-hidden="true" />
                  ) : (
                    <span className="block text-xl md:text-2xl font-semibold text-foreground tabular-nums leading-tight">
                      {stat.num !== undefined ? <CountUp value={stat.num} suffix="+" /> : stat.text}
                    </span>
                  )}
                  <span className="block text-[13px] md:text-xs font-medium text-muted-foreground tracking-wide">{stat.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="py-20 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHead
            eyebrow={t('secHowStart')}
            title={<>{t('shopReadyIn')}<span className="text-primary">3 ขั้นตอน</span></>}
            sub={t('heroNoWebSkill')}
          />

          {/* Quest chain: the three steps are connected by a line that fills
              once the section is in view, so they read as one sequence being
              completed rather than three unrelated cards. The line is purely
              decorative and sits behind the cards on desktop only. */}
          <div className="relative">
            <div
              className="hidden md:block absolute top-[52px] left-[16.6%] right-[16.6%] h-1 rounded-full bg-muted overflow-hidden"
              aria-hidden="true"
            >
              <div className={`quest-line xp-fill h-full rounded-full bg-gradient-to-r from-primary to-amber-400 ${questFilled ? 'quest-filled' : ''}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {STEPS.map((s, i) => (
                <motion.div
                  key={i}
                  initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  onViewportEnter={i === 0 ? () => setQuestFilled(true) : undefined}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.34, 1.3, 0.64, 1] }}
                >
                  <Card className="h-full bg-card border-border hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-sm group/step">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`quest-node w-9 h-9 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center text-base tabular-nums shrink-0 ring-4 ring-background ${questFilled ? 'quest-reached' : ''}`}
                        >
                          {i + 1}
                        </span>
                        <Icon name={s.icon} className="text-2xl text-primary/40 group-hover/step:text-primary/70 transition-colors" />
                      </div>
                      <CardTitle className="text-lg leading-snug">{t(s.title)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(s.desc)}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-24 bg-secondary/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHead
            eyebrow={t('secFeatures')}
            title={<>{t('getEverythingFrom')}<span className="text-primary">{t('firstDays')}</span></>}
            sub={t('heroNoExtras')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: 'easeOut' }}
              >
                <Card className="group/feat bg-card border-2 hover:border-primary/50 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 shadow-sm h-full">
                  <CardHeader>
                    {/* Icon tile flips to solid on hover: one small reward per
                        card, cheap because only colour and transform move. */}
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 transition-all duration-300 group-hover/feat:bg-primary group-hover/feat:text-primary-foreground group-hover/feat:scale-110 group-hover/feat:-rotate-6">
                      <Icon name={f.icon} className="text-xl" />
                    </div>
                    <CardTitle className="text-lg group-hover/feat:text-primary transition-colors">{t(f.title)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(f.desc)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase slider ──────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-background overflow-hidden border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <SectionHead
              center={false}
              eyebrow={t('secDemo')}
              title={<>{t('experience')}<span className="text-primary">{t('premium')}</span></>}
              sub={t('secDemoSub')}
            />
            <div className="flex gap-2 shrink-0 mb-12">
              <Button variant="outline" size="icon" className="rounded-full w-12 h-12 cursor-pointer" onClick={prevImage} aria-label={t('prevSlide')}>
                <Icon name="chevron-left" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full w-12 h-12 cursor-pointer" onClick={nextImage} aria-label={t('nextSlide')}>
                <Icon name="chevron-right" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={reduceMotion ? false : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
              >
                {/* An uploaded screenshot is a button (it opens the lightbox);
                    a coded mockup is not, because there is nothing to enlarge
                    and it is already interactive where it stands. */}
                {showcase[currentIndex].src ? (
                  <button
                    className="lg:col-span-7 relative group cursor-pointer text-left"
                    onClick={() => setSelectedImage(currentIndex)}
                    aria-label={t('zoomAria', { title: showcase[currentIndex].title })}
                  >
                    <div className="overflow-hidden rounded-[2rem] border border-border bg-secondary/30 shadow-xl relative h-[300px] md:h-[480px] flex items-center justify-center">
                      <img
                        src={showcase[currentIndex].src}
                        alt={showcase[currentIndex].title}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain p-4"
                      />
                      <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                        <span className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full text-foreground text-xs font-medium border border-border shadow-sm">
                          <Icon name="search-plus" />{t('zoomImage')}</span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="lg:col-span-7">
                    {showcase[currentIndex].Mock?.()}
                  </div>
                )}

                <div className="lg:col-span-5 space-y-6">
                  <Badge variant="outline" className="text-primary border-primary/20 px-4 py-1.5 text-sm rounded-full">{t('secDemoFeature')}</Badge>
                  <h3 className="text-3xl md:text-4xl font-semibold text-foreground leading-tight">
                    {showcase[currentIndex].title}
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {showcase[currentIndex].desc}
                  </p>
                  {!showcase[currentIndex].src && (
                    <p className="text-[13px] text-muted-foreground flex items-center gap-2">
                      <Icon name="hand-pointer" className="text-primary" />{t('liveScreenHint')}</p>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    {showcase.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        aria-label={t('slideAria', { n: i + 1, title: s.title })}
                        aria-current={i === currentIndex}
                        className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                          i === currentIndex ? 'w-10 bg-primary' : 'w-2.5 bg-muted hover:bg-muted-foreground/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Lightbox */}
        <AnimatePresence>
          {selectedImage !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
              onClick={() => setSelectedImage(null)}
              role="dialog"
              aria-modal="true"
              aria-label={showcase[selectedImage].title}
            >
              <div className="relative max-w-7xl w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <img
                  src={showcase[selectedImage].src}
                  alt={showcase[selectedImage].title}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 md:-top-12 md:-right-12 text-foreground hover:bg-primary/10 rounded-full cursor-pointer"
                  onClick={() => setSelectedImage(null)}
                  aria-label={t('closeZoom')}
                >
                  <Icon name="times" className="text-2xl" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent text-center">
                  <h4 className="text-xl font-bold text-foreground">{showcase[selectedImage].title}</h4>
                  <p className="text-muted-foreground">{showcase[selectedImage].desc}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Comparison ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-secondary/40 border-b border-border">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHead
            eyebrow={t('secCompare')}
            title={<>{t('colCustom')}<span className="text-primary">{t('tensOfThousands')}</span>{t('startWithUs99')}</>}
            sub={t('secCompareSub')}
          />

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <caption className="sr-only">{t('compareTableAlt')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="p-4 text-xs font-medium tracking-wider text-muted-foreground" />
                  <th scope="col" className="p-4 text-center rounded-t-2xl bg-primary text-primary-foreground font-semibold text-sm">
                    SIAMSITE
                  </th>
                  <th scope="col" className="p-4 text-center text-sm font-bold text-muted-foreground">{t('colCustom')}</th>
                  <th scope="col" className="p-4 text-center text-sm font-bold text-muted-foreground">{t('colForeign')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <motion.tr
                    key={i}
                    initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ delay: i * 0.05, duration: 0.3, ease: 'easeOut' }}
                    className="group/row"
                  >
                    <th scope="row" className="py-4 pr-4 pl-2 text-[13px] font-medium text-foreground border-t border-border align-middle group-hover/row:text-primary transition-colors">
                      {t(row.label)}
                    </th>
                    <td className="p-4 text-center text-[13px] font-semibold text-foreground bg-primary/5 border-t border-primary/20 align-middle group-hover/row:bg-primary/10 transition-colors">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        <Icon name="circle-check" className="text-primary shrink-0" />
                        {t(row.ours)}
                      </span>
                    </td>
                    {/* Alternatives get a muted cross so the row reads at a
                        glance without having to compare the wording. */}
                    <td className="p-4 text-center text-[13px] text-muted-foreground border-t border-border align-middle">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        <Icon name="circle-xmark" className="text-destructive/40 shrink-0" />
                        {t(row.custom)}
                      </span>
                    </td>
                    <td className="p-4 text-center text-[13px] text-muted-foreground border-t border-border align-middle">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        <Icon name="circle-xmark" className="text-destructive/40 shrink-0" />
                        {t(row.foreign)}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="relative py-20 md:py-24 bg-background overflow-hidden">
        <div className="animate-blob-drift absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[130px] pointer-events-none" style={{ animationDelay: '-4s' }} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <SectionHead
            eyebrow={t('price')}
            title={<>{t('startSellingAt')}<span className="text-primary">฿99</span>{t('firstMonth')}</>}
            sub={t('planAllSameSub')}
          />

          <PlanRail count={planCards.length}>
            {planCards.map((p, i) => (
              <div key={p.id} className="shrink-0 w-[280px] sm:w-[300px] lg:w-[340px]">
                <PackageCard
                  pkg={p.pkg}
                  planId={p.id}
                  index={i}
                  easyslipFee={easyslipFee}
                  onShowEasySlip={() => setShowEasySlipPlan(true)}
                />
              </div>
            ))}
          </PlanRail>

          {featuredPkg && featuredDiscount && (
            <div className="mt-4 rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold tracking-wider text-primary-foreground">
                  <Icon name="fire" className="text-[10px]" />{t('recommended')}</span>
                <p className="text-lg md:text-xl font-semibold text-foreground mt-2.5 leading-snug">
                  {t('featuredPlanPay', { label: t('planMonths', { n: featuredPkg.months }), price: featuredPkg.price.toLocaleString() })}
                  <span className="text-destructive line-through font-bold text-base ml-2 tabular-nums">
                    ฿{featuredDiscount.regular.toLocaleString()}
                  </span>
                </p>
                <p className="text-[13px] font-semibold text-muted-foreground mt-1.5 leading-relaxed">
                  ลด {featuredDiscount.percent}% ประหยัดไป ฿{featuredDiscount.save.toLocaleString()} เฉลี่ยเดือนละ ฿
                  {Math.round(featuredPkg.price / featuredPkg.months).toLocaleString()}
                  {' '}จ่ายไม่หนัก ต่ออายุน้อยลง และได้ส่วนลดแล้ว
                </p>
              </div>
              <Button
                className="rounded-full font-semibold tracking-wide h-12 px-7 shrink-0 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl cursor-pointer"
                asChild
              >
                <Link href={`/order?months=${featuredPkg.months}`}>{t('ctaChoosePlan')}</Link>
              </Button>
            </div>
          )}

          {/* Shared across every plan, so it is stated once here instead of
              being repeated inside all three cards. */}
          <div className="mt-10 rounded-2xl border border-border bg-secondary/30 p-6 md:p-7">
            <p className="text-center text-[13px] font-semibold text-foreground mb-5">{t('planAllSame')}</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
              {([
                { icon: 'box-open', text: t('lootBoxAnim') },
                { icon: 'archive', text: t('webInventory') },
                { icon: 'arrows-rotate', text: t('freeUpdatesLong') },
                { icon: 'headset', text: t('thaiSupportFast') },
              ] as { icon: IconName; text: string }[]).map(f => (
                <li key={f.text} className="flex items-start gap-2.5 text-[13px] font-medium text-muted-foreground">
                  <Icon name={f.icon} className="text-primary/70 text-base mt-0.5 shrink-0" />
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-[12px] text-muted-foreground/80 mt-8 max-w-2xl mx-auto leading-relaxed font-medium">
            * ค่าธรรมเนียม API ของ EasySlip ฿{easyslipFee} ต่อรายการ คิดเฉพาะการตรวจสลิป PromptPay
            และหักจากยอดเติมเงินของผู้เล่นเท่านั้น ไม่กระทบค่าเช่ารายเดือน ส่วน TrueMoney อั่งเปา ใช้ฟรี ไม่มีค่าธรรมเนียม
          </p>
        </div>
      </section>

      {/* EasySlip plan modal */}
      <AnimatePresence>
        {showEasySlipPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
            onClick={() => setShowEasySlipPlan(false)}
            role="dialog"
            aria-modal="true"
            aria-label={t('easyslipFeeTitle')}
          >
            <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
                  <h4 className="font-semibold text-foreground text-sm">{t('easyslipFeeTitle')}</h4>
                  <Button variant="ghost" size="icon" onClick={() => setShowEasySlipPlan(false)} className="rounded-full w-8 h-8 cursor-pointer" aria-label={t('close')}>
                    <Icon name="times" className="text-xs" />
                  </Button>
                </div>
                <div className="p-2 bg-card">
                  <img src="/images/easy_slip_plan.png" alt={t('easyslipTableAlt')} loading="lazy" className="w-full h-auto rounded-xl" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-background py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
            <div className="md:col-span-5 space-y-6">
              <Link href="/" className="flex items-center gap-3 w-fit">
                <Image
                  src="/images/logosiamsite-h256.png"
                  alt={t('logoAlt')}
                  width={84}
                  height={56}
                  className="h-14 w-auto object-contain"
                />
                <span className="flex flex-col">
                  <span className="font-bold text-foreground text-xl tracking-tight leading-none">SIAMSITE</span>
                  <span className="text-[12px] font-medium text-primary mt-1">MANAGER</span>
                </span>
              </Link>
              <p className="text-muted-foreground text-base leading-relaxed max-w-sm font-medium">{t('footerAbout')}</p>
              <div className="flex items-center gap-4 pt-2">
                <a href="https://www.facebook.com/siamsitestore" target="_blank" rel="noopener noreferrer" aria-label="Facebook ของ SIAMSITE" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
                  <Icon name="facebook-f" />
                </a>
                <a href="https://discord.gg/HysqVHra5n" target="_blank" rel="noopener noreferrer" aria-label="Discord ของ SIAMSITE" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
                  <Icon name="discord" />
                </a>
              </div>
            </div>

            <div className="md:col-span-2 space-y-5">
              <h3 className="font-bold text-foreground text-base">{t('footerMenu')}</h3>
              <ul className="space-y-3 text-muted-foreground font-semibold text-sm">
                <li><Link href="/" className="hover:text-primary transition-colors">{t('navHome')}</Link></li>
                <li><a href="#how" className="hover:text-primary transition-colors">{t('howToStart')}</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">{t('secPricing')}</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">{t('secFaq')}</a></li>
                <li><Link href="/solutions" className="hover:text-primary transition-colors">{t('footerSolutions')}</Link></li>
                <li><Link href={locale === 'en' ? '/lp/minecraft-webshop' : '/lp/เช่าเว็บร้านค้ามายคราฟ'} className="hover:text-primary transition-colors">{t('footerRentShop')}</Link></li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-5">
              <h3 className="font-bold text-foreground text-base">{t('footerLegal')}</h3>
              <ul className="space-y-3 text-muted-foreground font-semibold text-sm">
                <li><Link href="/terms" className="hover:text-primary transition-colors">{t('footerTerms')}</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">{t('footerPrivacy')}</Link></li>
                <li><Link href="/shop-owner-agreement" className="hover:text-primary transition-colors">{t('footerShopAgreement')}</Link></li>
                <li><Link href="/payment-policy" className="hover:text-primary transition-colors">{t('footerPayment')}</Link></li>
                <li><Link href="/prohibited-content" className="hover:text-primary transition-colors">{t('prohibitedContent')}</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">{t('footerContact')}</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-5">
              <h3 className="font-bold text-foreground text-base">{t('footerSecurity')}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <Icon name="shield-check" className="text-emerald-500 text-xl shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{t('footerSsl')}</p>
                    <p className="text-[12px] text-muted-foreground">{t('footerEncryption')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                  <Icon name="qrcode" className="text-amber-500 text-xl shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{t('footerPromptpay')}</p>
                    <p className="text-[12px] text-muted-foreground">{t('autoSlipVerify')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground font-semibold">
              &copy; {new Date().getFullYear()} SIAMSITE STORE. All rights reserved.
            </p>
            <div className="flex items-center gap-2.5 text-[13px] font-semibold text-muted-foreground/70">
              <Icon name="lock" className="text-emerald-500/80" />
              <span>{t('securePayment')}</span>
              <span className="text-border">|</span>
              <Icon name="arrows-rotate" className="text-amber-500/80" />
              <span>{t('freeUpdates')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function ThaiHome() {
  return (
    <>
      {/* Only the search-param reader sits behind Suspense, so the page itself
          still prerenders to static HTML for crawlers. */}
      <Suspense fallback={null}>
        <AuthCodeExchange />
      </Suspense>
      <LandingContent />
    </>
  );
}
