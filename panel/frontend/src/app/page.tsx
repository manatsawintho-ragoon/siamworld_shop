'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import AuthCodeExchange from '@/components/AuthCodeExchange';
import api from '@/lib/api';
import { FAQ, EASYSLIP_FEE_MAX } from '@/lib/faq';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/icon';
import { getTier, type TierKey } from '@/lib/rarity';

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

const DEFAULT_PACKAGES: Package[] = [
  { months: 1, price: 350,  label: '1 เดือน',  save: 0,   kind: 'regular' },
  { months: 3, price: 945,  label: '3 เดือน',  save: 105, kind: 'regular' },
  { months: 6, price: 1785, label: '6 เดือน',  save: 315, kind: 'regular' },
];

const DEFAULT_PROMOS: Promo[] = [
  { kind: 'trial', months: 0, days: 7, price: 0,  label: 'ทดลองฟรี 7 วัน', regularPrice: 350 },
  { kind: 'intro', months: 1,           price: 99, label: 'เดือนแรกพิเศษ',  regularPrice: 350 },
];

/** The single primary action on this page. Every hero/section CTA points here. */
const PRIMARY_CTA = { href: '/order?kind=trial', label: 'เริ่มทดลองฟรี 7 วัน' };

/* ── Package tiers ───────────────────────────────────────────────────
   Every plan ships the same feature set, so repeating the full list in all
   three cards just buries the prices. Instead each card states who it suits
   and the few points that actually differ, and the shared list is rendered
   once below the grid.

   The tier ranking is deliberate: the recommended card is EPIC, not
   LEGENDARY. It should read as the smart pick rather than the maxed-out one,
   which leaves LEGENDARY meaningful for the longest plan. */
interface TierCopy {
  tier: TierKey;
  /** Who this plan suits, one line, shown directly under the title. */
  audience: string;
  points: { icon: IconName; text: string; tone?: 'good' | 'muted' | 'off' }[];
}

const TIER_COPY: Record<'trial' | 'intro' | 'regular', TierCopy> = {
  trial: {
    tier: 'common',
    audience: 'เหมาะกับคนที่อยากลองระบบจริงก่อนตัดสินใจ',
    points: [
      { icon: 'circle-check', text: 'ได้ฟีเจอร์พรีเมียมครบทุกอย่าง', tone: 'good' },
      { icon: 'clock',        text: 'ใช้งานเต็มรูปแบบ 7 วัน ไม่ต้องผูกบัตร' },
      { icon: 'wallet',       text: 'เติมผ่าน TrueMoney อั่งเปา ฟรี ไม่มีค่าธรรมเนียม', tone: 'good' },
      { icon: 'circle-xmark', text: 'ยังไม่รวมตรวจสลิป PromptPay อัตโนมัติ', tone: 'off' },
    ],
  },
  intro: {
    tier: 'epic',
    audience: 'เหมาะกับเซิร์ฟเวอร์ที่พร้อมเปิดขายจริงเดือนนี้',
    points: [
      { icon: 'circle-check', text: 'ได้ฟีเจอร์พรีเมียมครบทุกอย่าง', tone: 'good' },
      { icon: 'qrcode',       text: 'ตรวจสลิป PromptPay อัตโนมัติ 24 ชม.' },
      { icon: 'wallet',       text: 'เติมผ่าน TrueMoney อั่งเปา ฟรี ไม่มีค่าธรรมเนียม', tone: 'good' },
      { icon: 'shield-check', text: 'ยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัด' },
    ],
  },
  regular: {
    tier: 'legendary',
    audience: 'เหมาะกับเซิร์ฟเวอร์ที่เปิดยาว อยากล็อกราคาไว้',
    points: [
      { icon: 'circle-check',   text: 'ได้ฟีเจอร์พรีเมียมครบทุกอย่าง', tone: 'good' },
      { icon: 'qrcode',         text: 'ตรวจสลิป PromptPay อัตโนมัติ 24 ชม.' },
      { icon: 'wallet',         text: 'เติมผ่าน TrueMoney อั่งเปา ฟรี ไม่มีค่าธรรมเนียม', tone: 'good' },
      { icon: 'arrows-rotate',  text: 'จ่ายทีเดียว ไม่ต้องต่ออายุทุกเดือน' },
    ],
  },
};

const STEPS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'user-pen',
    title: 'สมัครแล้วเลือกแพ็กเกจ',
    desc: 'ใช้แค่อีเมล ไม่ต้องผูกบัตร ระบบสร้างเว็บร้านค้าให้อัตโนมัติภายใน 5-10 นาที',
  },
  {
    icon: 'plug',
    title: 'วางปลั๊กอินเชื่อมเซิร์ฟเวอร์',
    desc: 'วางไฟล์ .jar ลงใน /plugins ใส่ token แล้วปลั๊กอินเชื่อมกลับมาเอง ไม่ต้องเปิดพอร์ต ไม่ต้องตั้ง VPN',
  },
  {
    icon: 'sack-dollar',
    title: 'เปิดขายได้เลย',
    desc: 'ผู้เล่นเติมเงินเองผ่าน PromptPay หรือ TrueMoney อั่งเปา ของส่งเข้าเกมอัตโนมัติ 24 ชั่วโมง',
  },
];

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'rocket',
    title: 'ระบบ Auto-Deploy',
    desc: 'พร้อมขายทันที ไม่ต้องเขียนโค้ด ไม่ต้องตั้งค่ายาก',
  },
  {
    icon: 'qrcode',
    title: 'รับเงิน 24 ชม.',
    desc: 'PromptPay + TrueMoney อั่งเปา (ฟรี ไม่มีค่าธรรมเนียม) เงินเข้าทันทีแม้คุณนอน',
  },
  {
    icon: 'box-open',
    title: 'Loot Box ดึงดูดผู้เล่น',
    desc: 'ระบบสุ่มพร้อมแอนิเมชั่น CS:GO กระตุ้นยอดขายซ้ำ',
  },
  {
    icon: 'gears',
    title: 'จัดการครบจากเว็บ',
    desc: 'ส่งของผ่าน RCON แม่นยำ ดู logs ดูยอดได้ทุกที่',
  },
];

/** Factual, non-defamatory comparison. Competitors are described by category,
 *  never by brand, so no claim is attached to a specific company. */
const COMPARISON: { label: string; ours: string; custom: string; foreign: string }[] = [
  { label: 'ค่าเริ่มต้น',              ours: 'ฟรี 7 วัน แล้ว ฿99 เดือนแรก', custom: 'หลักหมื่นขึ้นไป',   foreign: 'หักเปอร์เซ็นต์จากยอดขาย' },
  { label: 'ระยะเวลาจนเปิดขายได้',      ours: '5-10 นาที',                  custom: 'รอพัฒนาเป็นเดือน',  foreign: 'ตั้งค่าเองทั้งหมด' },
  { label: 'PromptPay ตรวจสลิปอัตโนมัติ', ours: 'มีให้พร้อมใช้',              custom: 'ต้องพัฒนาเพิ่ม',    foreign: 'ส่วนใหญ่ไม่รองรับ' },
  { label: 'TrueMoney อั่งเปา',          ours: 'ใช้ฟรี ไม่มีค่าธรรมเนียม',    custom: 'ต้องพัฒนาเพิ่ม',    foreign: 'ไม่รองรับ' },
  { label: 'เชื่อมเซิร์ฟเวอร์',          ours: 'ปลั๊กอิน ไม่ต้องเปิดพอร์ต',   custom: 'ต้องทำเอง',        foreign: 'ต้องเปิดพอร์ต RCON' },
  { label: 'อัปเดตและดูแลระบบ',          ours: 'รวมอยู่ในค่าบริการ',          custom: 'จ่ายเพิ่มทุกครั้ง',  foreign: 'ขึ้นกับแพลตฟอร์ม' },
  { label: 'ซัพพอร์ตภาษาไทย',            ours: 'คนไทย ตอบไทย',               custom: 'ขึ้นกับผู้รับจ้าง',  foreign: 'ภาษาอังกฤษ' },
];

interface ShowcaseSlide { src: string; title: string; desc: string }

// Fallback slides shown when the admin hasn't configured any in the panel yet.
const DEFAULT_SHOWCASE: ShowcaseSlide[] = [
  { src: '/images/homepage.png', title: 'หน้าแรกที่ทันสมัย', desc: 'ดึงดูดผู้เล่นด้วยดีไซน์ที่สวยงามและใช้งานง่าย' },
  { src: '/images/items_shop.png', title: 'ร้านค้าไอเท็ม', desc: 'จัดการหมวดหมู่และสินค้าได้ง่ายดายผ่านระบบหลังบ้าน' },
  { src: '/images/gacha_system.jpg', title: 'ระบบกล่องสุ่ม Gacha', desc: 'เพิ่มความตื่นเต้นด้วยการสุ่มไอเท็มพร้อมแอนิเมชั่นระดับพรีเมียม' },
  { src: '/images/inventory_system.jpg', title: 'ระบบคลังเว็บ', desc: 'เก็บไอเท็มที่สุ่มได้ไว้ในคลังเว็บ เลือกรับเข้าตัวได้ทุกเมื่อ' },
  { src: '/images/topup_system.jpg', title: 'ระบบเติมเงินอัตโนมัติ', desc: 'รองรับ PromptPay และ TrueMoney อั่งเปา ตรวจสอบยอดเงินทันที 24 ชม.' },
  { src: '/images/theme_change.png', title: 'ปรับแต่งธีมได้อิสระ', desc: 'เปลี่ยนสีและรูปแบบของร้านค้าให้เข้ากับเซิร์ฟเวอร์ของคุณ' },
];

/* ── Animated headline ───────────────────────────────────────────────── */

/** Headline split into Thai word chunks. Thai has no inter-word spaces, so the
 *  segmentation is declared here rather than derived from whitespace. */
const HEADLINE_WORDS: { text: string; accent?: boolean }[] = [
  { text: 'เปิด' },
  { text: 'ร้านค้า' },
  { text: 'มายคราฟ' },
  { text: 'ขายได้', accent: true },
  { text: 'ตั้งแต่', accent: true },
  { text: 'วันนี้', accent: true },
];

const TYPE_MS = 260;
const DELETE_MS = 130;
const HOLD_FULL_MS = 2400;
const HOLD_EMPTY_MS = 700;

/**
 * Types the headline in one word at a time, then erases it word by word.
 *
 * Every word stays in the DOM the whole time and is only toggled with
 * `visibility`, so:
 *   - the full H1 text is always present for crawlers and screen readers
 *   - hidden words keep occupying their space, so the line never reflows (no CLS)
 *   - the server-rendered HTML shows the complete headline; the animation only
 *     starts after hydration, so there is no hydration mismatch
 *
 * Kept as its own component so its ~4 state updates per second re-render this
 * heading alone, not the entire landing page.
 */
function TypewriterHeadline() {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(HEADLINE_WORDS.length);
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
    let delay: number;
    if (!deleting) {
      delay = shown < HEADLINE_WORDS.length ? TYPE_MS : HOLD_FULL_MS;
    } else {
      delay = shown > 0 ? DELETE_MS : HOLD_EMPTY_MS;
    }
    const t = setTimeout(() => {
      if (!deleting) {
        if (shown < HEADLINE_WORDS.length) setShown(s => s + 1);
        else setDeleting(true);
      } else {
        if (shown > 0) setShown(s => s - 1);
        else setDeleting(false);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [animating, shown, deleting]);

  const lead = HEADLINE_WORDS.filter(w => !w.accent);
  const accent = HEADLINE_WORDS.filter(w => w.accent);
  const leadCount = lead.length;
  const caretAfter = Math.max(0, Math.min(shown, HEADLINE_WORDS.length)) - 1;

  const Caret = () => (
    <span
      aria-hidden="true"
      className="animate-caret inline-block w-[4px] md:w-[5px] h-[0.8em] bg-primary ml-1 align-middle rounded-full"
    />
  );

  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.15] mb-6 tracking-tight text-foreground">
      <span className="block">
        {lead.map((w, i) => (
          <span key={i} style={{ visibility: i < shown ? 'visible' : 'hidden' }}>
            {w.text}
          </span>
        ))}
        {/* caretAfter is -1 while the line is empty, which keeps the caret
            parked at the start during the pause before typing restarts. */}
        {animating && caretAfter < leadCount && <Caret />}
      </span>

      <span className="relative inline-block text-primary mt-2">
        {accent.map((w, i) => (
          <span key={i} style={{ visibility: leadCount + i < shown ? 'visible' : 'hidden' }}>
            {w.text}
          </span>
        ))}
        {animating && caretAfter >= leadCount && <Caret />}
        <span
          aria-hidden="true"
          className="absolute left-0 -bottom-1 h-[6px] rounded-full bg-primary/25 transition-[width] duration-300 ease-out"
          style={{ width: shown >= HEADLINE_WORDS.length ? '100%' : '0%' }}
        />
      </span>
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
  return (
    <div className={`max-w-2xl mb-12 ${center ? 'mx-auto text-center' : ''}`}>
      <span className="inline-block text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-3">
        {eyebrow}
      </span>
      <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight leading-tight">{title}</h2>
      {sub && <p className="text-muted-foreground text-lg mt-4 leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ── Pricing card ────────────────────────────────────────────────────── */

function PackageCard({
  pkg,
  isPromo = false,
  isTrial = false,
  index = 0,
  easyslipFee,
  onShowEasySlip,
}: { pkg: any; isPromo?: boolean; isTrial?: boolean; index?: number; easyslipFee: number; onShowEasySlip: () => void }) {
  const reduceMotion = useReducedMotion();
  // Touch devices have no hover, so the glow is armed when the card scrolls
  // into view instead. CSS picks whichever applies via @media (hover: …).
  const [armed, setArmed] = useState(false);

  const copy = TIER_COPY[isTrial ? 'trial' : isPromo ? 'intro' : 'regular'];
  const tier = getTier(copy.tier);

  return (
    <motion.div
      className={isPromo ? 'z-10' : ''}
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      onViewportEnter={() => setArmed(true)}
      transition={{ delay: index * 0.1, duration: 0.45, ease: [0.34, 1.3, 0.64, 1] }}
    >
      <Card
        style={{ ['--tier' as string]: tier.color, ['--tier-glow' as string]: tier.glow }}
        className={`landing-tier-card flex flex-col relative h-full overflow-hidden border-2 ${armed ? 'tier-armed' : ''} ${
          isPromo
            ? 'card-sheen landing-tier-featured shadow-2xl lg:scale-105 bg-card'
            : 'bg-card/60 shadow-sm'
        }`}
      >
        {/* Rarity strip: the tier colour reads before any text does. */}
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tier.color }} aria-hidden="true" />

        {isPromo && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <Badge className="bg-primary text-primary-foreground px-4 py-1 text-[10px] uppercase tracking-wider font-black shadow-lg border-none whitespace-nowrap">
              คุ้มที่สุด
            </Badge>
          </div>
        )}

        <CardHeader className="pb-4 pt-8">
          {/* Tier is stated in text as well as colour, so it survives both
              colour-blindness and greyscale printing. */}
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white leading-none mb-3"
            style={{ backgroundColor: tier.color }}
          >
            <Icon name={tier.icon} className="text-[10px]" />
            {tier.label}
          </span>
          <CardTitle className="text-lg font-black">{isTrial ? 'ทดลองใช้ฟรี' : pkg.label}</CardTitle>
          <p className="text-[12px] font-semibold text-muted-foreground mt-1.5 leading-snug">{copy.audience}</p>
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mt-3">
            {isPromo && pkg.regularPrice && (
              <span className="text-xl font-bold text-muted-foreground/60 line-through tabular-nums" aria-label={`ราคาปกติ ${pkg.regularPrice} บาท`}>
                ฿{pkg.regularPrice}
              </span>
            )}
            <span className="text-5xl font-black tracking-tighter text-foreground tabular-nums">฿{pkg.price}</span>
            <span className="text-sm font-bold text-muted-foreground">
              /{pkg.days ? `${pkg.days} วัน` : (pkg.months === 1 ? 'เดือนแรก' : pkg.label)}
            </span>
          </div>
          {isPromo && pkg.regularPrice > pkg.price && (
            <span className="inline-flex w-fit items-center gap-1 mt-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-600">
              <Icon name="tag" className="text-[10px]" />
              ประหยัด ฿{pkg.regularPrice - pkg.price} เดือนแรก
            </span>
          )}
          {isTrial && <p className="text-[13px] text-muted-foreground mt-2 font-medium">ไม่ต้องผูกบัตร ยกเลิกเองได้</p>}
          {isPromo && <p className="text-[13px] text-muted-foreground mt-2 font-medium">เดือนถัดไป ฿{pkg.regularPrice ?? 350}/เดือน ไม่มีสัญญาผูกมัด</p>}
          {!isTrial && !isPromo && <p className="text-[13px] text-muted-foreground mt-2 font-medium">ราคาปกติ จ่ายทีเดียวคุ้มกว่า</p>}
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
                    ? 'text-[13px] font-bold text-emerald-600'
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
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pt-0 flex-col items-stretch gap-3">
          <Button
            className={`w-full rounded-full font-black tracking-wide h-12 transition-all cursor-pointer ${
              isPromo ? 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl' : 'bg-background border-2 border-border hover:bg-secondary text-foreground'
            }`}
            variant={isPromo ? 'default' : 'outline'}
            asChild
          >
            <Link href={isTrial ? '/order?kind=trial' : (isPromo ? '/order?kind=intro' : `/order?months=${pkg.months}`)}>
              {isTrial ? 'เริ่มทดลองใช้งาน' : 'สั่งซื้อแพ็กเกจ'}
            </Link>
          </Button>
          {!isTrial && (
            <button
              onClick={onShowEasySlip}
              className="text-[11px] font-semibold text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Icon name="circle-info" className="text-xs" />
              ค่าตรวจสลิป PromptPay ฿{easyslipFee}/รายการ
            </button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

/* ── FAQ accordion ───────────────────────────────────────────────────── */

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

  return (
    <section id="faq" className="py-20 md:py-24 bg-background border-t border-border">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHead eyebrow="คำถามที่พบบ่อย" title="ยังลังเลอยู่ใช่ไหม" sub="รวมคำถามที่เจ้าของเซิร์ฟเวอร์ถามเรามากที่สุด" />

        <div className="space-y-3">
          {FAQ.map((item, i) => {
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
                    <span className="font-bold text-foreground text-[15px] leading-snug">{item.q}</span>
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
                      {item.a}
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
  const [showcase, setShowcase] = useState<ShowcaseSlide[]>(DEFAULT_SHOWCASE);

  useEffect(() => {
    api.get('/api/subscriptions/packages').then(r => {
      if (r.data.packages?.length) setPackages(r.data.packages);
      if (r.data.promos?.length) setPromos(r.data.promos);
      if (typeof r.data.easyslipFee === 'number') setEasyslipFee(r.data.easyslipFee);
    }).catch(() => {});
    api.get('/api/subscriptions/public-stats').then(r => setStatsData(r.data)).catch(() => {});
    api.get('/api/subscriptions/public-shops').then(r => { if (r.data.shops?.length) setShops(r.data.shops); }).catch(() => {});
    // Admin-managed feature showcase; keep the built-in defaults if none configured.
    api.get('/api/showcase').then(r => {
      const items = (r.data.items || []) as { title: string; description: string; image_data: string }[];
      if (items.length) setShowcase(items.map(i => ({ src: i.image_data, title: i.title, desc: i.description })));
    }).catch(() => {});
  }, []);

  const nextImage = () => setCurrentIndex(prev => (prev + 1) % showcase.length);
  const prevImage = () => setCurrentIndex(prev => (prev - 1 + showcase.length) % showcase.length);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % showcase.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [showcase.length]);

  /* Live counters. Rendered as skeletons until the API answers, so the
     prerendered HTML never advertises "0 customers" to crawlers.
     `num` counts up on arrival; `text` is shown as-is. */
  const stats: { label: string; num?: number; text?: string; icon: IconName }[] = useMemo(() => [
    { label: 'ร้านค้าที่เปิดใช้งาน', num: statsData ? (statsData.total_shops || 0) : undefined, icon: 'store' },
    { label: 'สมาชิกในระบบ',        num: statsData ? (statsData.total_users || 0) : undefined, icon: 'users' },
    { label: 'ติดตั้งเสร็จภายใน',    text: statsData?.delivery_speed || undefined, icon: 'bolt' },
    { label: 'รับเงินอัตโนมัติ',      text: '24 ชม.', icon: 'qrcode' },
  ], [statsData]);

  const trialPromo = promos.find(p => p.kind === 'trial');
  const introPromo = promos.find(p => p.kind === 'intro');

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <ScrollProgress />

      {/* Promo strip: the offer stays visible before anything else loads */}
      <div className="promo-strip-anim bg-gradient-to-r from-primary via-amber-500 to-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-center gap-2 text-center text-[12px] md:text-[13px] font-bold">
          <Icon name="sparkles" className="shrink-0" />
          <span>ทดลองฟรี 7 วัน ไม่ต้องผูกบัตร ต่อเดือนแรกเพียง ฿99</span>
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

            <p className="hero-pop-2 text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl font-medium">
              ระบบร้านค้าสำเร็จรูปสำหรับเซิร์ฟเวอร์ไทย ผู้เล่นเติมเงินเอง ของส่งเข้าเกมอัตโนมัติ
              คุณไม่ต้องเขียนโค้ดและไม่ต้องเฝ้าสลิปเอง
            </p>

            <div className="hero-pop-2 flex flex-col sm:flex-row gap-3 mb-5">
              <Button size="lg" className="cta-sweep relative overflow-hidden h-14 px-8 text-base font-black rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer" asChild>
                <Link href={PRIMARY_CTA.href}>
                  <Icon name="rocket" className="mr-2" /> {PRIMARY_CTA.label}
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-8 text-base font-bold rounded-full cursor-pointer" asChild>
                <a href="#pricing">ดูราคาแพ็กเกจ</a>
              </Button>
            </div>

            {/* Objection handling right under the primary CTA */}
            <ul className="hero-pop-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-muted-foreground">
              {['ไม่ต้องผูกบัตร', 'ยกเลิกได้ทุกเมื่อ', 'พร้อมขายใน 10 นาที'].map(t => (
                <li key={t} className="flex items-center gap-1.5">
                  <Icon name="circle-check" className="text-emerald-500" /> {t}
                </li>
              ))}
            </ul>

          </div>

          <div className="relative hero-pop-3">
            <div className="relative z-20 rounded-[2rem] overflow-hidden shadow-2xl border border-border bg-card">
              <Image
                src="/dashboard-admin.png"
                alt="ตัวอย่างหน้าจัดการร้านค้า SIAMSITE แสดงยอดขายและรายการสั่งซื้อ"
                width={1200}
                height={750}
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full h-auto"
              />
            </div>
            <div className="absolute -bottom-5 -left-3 md:-left-6 bg-card border border-border p-4 rounded-2xl shadow-xl z-30 animate-float-y">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg">
                  <Icon name="check" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">ออนไลน์ทันที</p>
                  <p className="text-xs text-muted-foreground">หลังชำระเงินเสร็จสิ้น</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Customer marquee ─────────────────────────────────────────────
          Promoted out of the hero column to a full-bleed band: social proof
          lands immediately after the pitch instead of being buried under the
          CTA. The list is rendered twice inside the track and the CSS shifts
          it by exactly -50%, so the loop is seamless. Hovering pauses it so
          the links stay clickable, and the duplicated half is hidden from
          assistive tech. */}
      {shops.length > 0 && (
        <section className="relative py-8 md:py-9 bg-background border-t border-border overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <p className="flex items-center justify-center gap-2 text-[13px] font-bold text-muted-foreground mb-3 text-center">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 animate-soft-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                <span className="text-foreground font-black tabular-nums">{shops.length}</span> เซิร์ฟเวอร์เปิดร้านกับเราแล้ว
              </span>
            </p>

            {/* Decorative XP-style accent under the count. It fills once on
                view and does not encode a quota, so it cannot misrepresent
                the real number above it. */}
            <motion.div
              className="mx-auto mb-6 h-1.5 w-40 rounded-full bg-muted overflow-hidden"
              aria-hidden="true"
            >
              <motion.div
                className="xp-fill h-full rounded-full bg-gradient-to-r from-primary to-amber-400 origin-left"
                initial={reduceMotion ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </motion.div>
          </div>

          <div className="marquee-viewport relative w-full overflow-hidden">
            <div className="marquee-track flex w-max gap-3 md:gap-4 items-center py-1">
              {[...shops, ...shops].map((s, i) => (
                <a
                  key={i}
                  href={`https://${s.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-hidden={i >= shops.length}
                  tabIndex={i >= shops.length ? -1 : undefined}
                  className="flex shrink-0 items-center gap-2.5 bg-card px-4 py-3 rounded-xl border-2 border-border shadow-sm hover:border-primary/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group/shop"
                >
                  {/* Blocky server-card mark: first letter as an item slot. */}
                  <span
                    className="grid place-items-center w-7 h-7 rounded-md bg-primary/10 text-primary text-[13px] font-black shrink-0 group-hover/shop:bg-primary group-hover/shop:text-primary-foreground transition-colors"
                    aria-hidden="true"
                  >
                    {s.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm md:text-[15px] font-bold text-foreground/80 tracking-tight whitespace-nowrap group-hover/shop:text-primary transition-colors">
                    {s.name}
                  </span>
                  {/* Static dot on purpose: one pulsing indicator lives on the
                      count above. Pulsing all ~28 pills would animate as many
                      box-shadows at once, which is both visually noisy and off
                      the compositor. */}
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                  <Icon name="arrow-up-right-from-square" className="text-[10px] text-muted-foreground/0 group-hover/shop:text-primary/70 transition-colors" />
                </a>
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          </div>
        </section>
      )}

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
                    <span className="block text-xl md:text-2xl font-black text-foreground tabular-nums leading-tight">
                      {stat.num !== undefined ? <CountUp value={stat.num} suffix="+" /> : stat.text}
                    </span>
                  )}
                  <span className="block text-[11px] md:text-xs font-bold text-muted-foreground tracking-wide">{stat.label}</span>
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
            eyebrow="เริ่มยังไง"
            title={<>เปิดร้านเสร็จใน <span className="text-primary">3 ขั้นตอน</span></>}
            sub="ไม่ต้องมีความรู้ด้านเว็บ ไม่ต้องเช่าเซิร์ฟเวอร์เพิ่ม"
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
                          className={`quest-node w-9 h-9 rounded-xl bg-primary text-primary-foreground font-black flex items-center justify-center text-base tabular-nums shrink-0 ring-4 ring-background ${questFilled ? 'quest-reached' : ''}`}
                        >
                          {i + 1}
                        </span>
                        <Icon name={s.icon} className="text-2xl text-primary/40 group-hover/step:text-primary/70 transition-colors" />
                      </div>
                      <CardTitle className="text-lg leading-snug">{s.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
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
            eyebrow="ฟีเจอร์เด่น"
            title="ครบ จบในที่เดียว"
            sub="ไม่ต้องยุ่งยากกับการตั้งค่า หรือปวดหัวกับการดูแลระบบด้วยตัวเอง"
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
                <Card className="bg-card hover:border-primary/50 hover:-translate-y-1 transition-all shadow-sm h-full">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <Icon name={f.icon} className="text-xl" />
                    </div>
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
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
              eyebrow="ตัวอย่างระบบ"
              title={<>สัมผัสประสบการณ์ <span className="text-primary">ระดับพรีเมียม</span></>}
              sub="ระบบถูกออกแบบมาให้ทันสมัย ใช้งานง่าย และรองรับทุกความต้องการของเซิร์ฟเวอร์มายคราฟ"
            />
            <div className="flex gap-2 shrink-0 mb-12">
              <Button variant="outline" size="icon" className="rounded-full w-12 h-12 cursor-pointer" onClick={prevImage} aria-label="สไลด์ก่อนหน้า">
                <Icon name="chevron-left" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full w-12 h-12 cursor-pointer" onClick={nextImage} aria-label="สไลด์ถัดไป">
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
                <button
                  className="lg:col-span-7 relative group cursor-pointer text-left"
                  onClick={() => setSelectedImage(currentIndex)}
                  aria-label={`ดูรูปขยาย: ${showcase[currentIndex].title}`}
                >
                  <div className="overflow-hidden rounded-[2rem] border border-border bg-secondary/30 shadow-xl relative h-[300px] md:h-[480px] flex items-center justify-center">
                    <img
                      src={showcase[currentIndex].src}
                      alt={showcase[currentIndex].title}
                      loading="lazy"
                      className="max-w-full max-h-full object-contain p-4"
                    />
                    <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      <span className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full text-foreground text-xs font-bold border border-border shadow-sm">
                        <Icon name="search-plus" /> ดูรูปขยาย
                      </span>
                    </div>
                  </div>
                </button>

                <div className="lg:col-span-5 space-y-6">
                  <Badge variant="outline" className="text-primary border-primary/20 px-4 py-1.5 text-sm rounded-full">
                    ตัวอย่างฟีเจอร์
                  </Badge>
                  <h3 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
                    {showcase[currentIndex].title}
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {showcase[currentIndex].desc}
                  </p>

                  <div className="flex gap-2.5 pt-2">
                    {showcase.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        aria-label={`ไปที่สไลด์ ${i + 1}: ${s.title}`}
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
                  aria-label="ปิดรูปขยาย"
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
            eyebrow="เทียบให้เห็นภาพ"
            title="ทำไมต้องเช่ากับเรา"
            sub="เทียบกับการจ้างเขียนเว็บเอง และการใช้แพลตฟอร์มต่างประเทศ"
          />

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <caption className="sr-only">ตารางเปรียบเทียบ SIAMSITE กับการจ้างเขียนเว็บเองและแพลตฟอร์มต่างประเทศ</caption>
              <thead>
                <tr>
                  <th scope="col" className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground" />
                  <th scope="col" className="p-4 text-center rounded-t-2xl bg-primary text-primary-foreground font-black text-sm">
                    SIAMSITE
                  </th>
                  <th scope="col" className="p-4 text-center text-sm font-bold text-muted-foreground">จ้างเขียนเว็บเอง</th>
                  <th scope="col" className="p-4 text-center text-sm font-bold text-muted-foreground">แพลตฟอร์มต่างประเทศ</th>
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
                    <th scope="row" className="p-4 text-sm font-bold text-foreground border-t border-border align-middle group-hover/row:text-primary transition-colors">
                      {row.label}
                    </th>
                    <td className="p-4 text-center text-sm font-bold text-foreground bg-primary/5 border-t border-primary/20 align-middle group-hover/row:bg-primary/10 transition-colors">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="circle-check" className="text-primary shrink-0" />
                        {row.ours}
                      </span>
                    </td>
                    <td className="p-4 text-center text-sm text-muted-foreground border-t border-border align-middle">{row.custom}</td>
                    <td className="p-4 text-center text-sm text-muted-foreground border-t border-border align-middle">{row.foreign}</td>
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
            eyebrow="ราคา"
            title="เลือกแพ็กเกจที่เหมาะกับคุณ"
            sub="ทุกแพ็กเกจได้ฟีเจอร์ครบเท่ากัน พร้อมอัปเดตเวอร์ชันใหม่ฟรีตลอดการใช้งาน"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-4">
            {trialPromo && (
              <PackageCard pkg={trialPromo} isTrial index={0} easyslipFee={easyslipFee} onShowEasySlip={() => setShowEasySlipPlan(true)} />
            )}
            {introPromo && (
              <PackageCard pkg={introPromo} isPromo index={1} easyslipFee={easyslipFee} onShowEasySlip={() => setShowEasySlipPlan(true)} />
            )}
            {packages.length > 0 && (
              <PackageCard pkg={packages[1] || packages[0]} index={2} easyslipFee={easyslipFee} onShowEasySlip={() => setShowEasySlipPlan(true)} />
            )}
          </div>

          {/* Shared across every plan, so it is stated once here instead of
              being repeated inside all three cards. */}
          <div className="mt-10 rounded-2xl border border-border bg-secondary/30 p-6 md:p-7">
            <p className="text-center text-[13px] font-black text-foreground mb-5">
              ทุกแพ็กเกจได้ครบเท่ากัน
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
              {([
                { icon: 'box-open', text: 'ระบบสุ่ม Loot Box แอนิเมชั่น CS:GO' },
                { icon: 'archive', text: 'ระบบคลังเว็บ (Web Inventory)' },
                { icon: 'arrows-rotate', text: 'อัปเดตเวอร์ชันใหม่ฟรีตลอดการใช้งาน' },
                { icon: 'headset', text: 'ซัพพอร์ตคนไทย ตอบเร็ว' },
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
            aria-label="รายละเอียดค่าบริการ EasySlip"
          >
            <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
                  <h4 className="font-black text-foreground text-sm">รายละเอียดค่าบริการ EasySlip</h4>
                  <Button variant="ghost" size="icon" onClick={() => setShowEasySlipPlan(false)} className="rounded-full w-8 h-8 cursor-pointer" aria-label="ปิด">
                    <Icon name="times" className="text-xs" />
                  </Button>
                </div>
                <div className="p-2 bg-white">
                  <img src="/images/easy_slip_plan.png" alt="ตารางค่าบริการของ EasySlip" loading="lazy" className="w-full h-auto rounded-xl" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-secondary/50 border-y border-border">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight mb-5 leading-tight">
            พร้อมเปิดร้านแล้วใช่ไหม
          </h2>
          <p className="text-muted-foreground text-lg mb-8 font-medium leading-relaxed">
            ทดลองฟรี 7 วัน ไม่ต้องผูกบัตร ถ้าไม่ชอบก็ปล่อยให้หมดอายุได้เลย
          </p>
          <Button size="lg" className="cta-sweep relative overflow-hidden h-14 px-10 text-base font-black rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer" asChild>
            <Link href={PRIMARY_CTA.href}>
              <Icon name="rocket" className="mr-2" /> {PRIMARY_CTA.label}
            </Link>
          </Button>
          <p className="text-[13px] text-muted-foreground mt-5 font-semibold">
            มีคำถามก่อนตัดสินใจ? <Link href="/contact" className="text-primary hover:underline">ทักหาเราได้เลย</Link>
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-background py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
            <div className="md:col-span-5 space-y-6">
              <Link href="/" className="flex items-center gap-3 w-fit">
                <Image
                  src="/images/logosiamsite-h256.png"
                  alt="โลโก้ SIAMSITE"
                  width={84}
                  height={56}
                  className="h-14 w-auto object-contain"
                />
                <span className="flex flex-col">
                  <span className="font-bold text-foreground text-xl tracking-tight leading-none">SIAMSITE</span>
                  <span className="text-[10px] font-bold text-primary tracking-[0.2em] mt-1">MANAGER</span>
                </span>
              </Link>
              <p className="text-muted-foreground text-base leading-relaxed max-w-sm font-medium">
                บริการแพลตฟอร์มจัดการร้านค้า Minecraft สำหรับเซิร์ฟเวอร์ไทย ที่เน้นความง่าย ความเสถียร และความเป็นมืออาชีพ
              </p>
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
              <h3 className="font-bold text-foreground text-base">เมนูหลัก</h3>
              <ul className="space-y-3 text-muted-foreground font-semibold text-sm">
                <li><Link href="/" className="hover:text-primary transition-colors">หน้าแรก</Link></li>
                <li><a href="#how" className="hover:text-primary transition-colors">วิธีเริ่มต้น</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">ราคาแพ็กเกจ</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">คำถามที่พบบ่อย</a></li>
                <li><Link href="/solutions" className="hover:text-primary transition-colors">บริการเช่าเว็บร้านค้า</Link></li>
                <li><Link href="/lp/เช่าเว็บร้านค้ามายคราฟ" className="hover:text-primary transition-colors">เช่าเว็บร้านค้ามายคราฟ</Link></li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-5">
              <h3 className="font-bold text-foreground text-base">นโยบายและกฎหมาย</h3>
              <ul className="space-y-3 text-muted-foreground font-semibold text-sm">
                <li><Link href="/terms" className="hover:text-primary transition-colors">ข้อกำหนดการใช้บริการ</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">นโยบายความเป็นส่วนตัว</Link></li>
                <li><Link href="/shop-owner-agreement" className="hover:text-primary transition-colors">ข้อตกลงเจ้าของร้าน</Link></li>
                <li><Link href="/payment-policy" className="hover:text-primary transition-colors">การชำระเงินและการจ่ายเงิน</Link></li>
                <li><Link href="/prohibited-content" className="hover:text-primary transition-colors">สินค้าและเนื้อหาต้องห้าม</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">ติดต่อเรา</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-5">
              <h3 className="font-bold text-foreground text-base">ความปลอดภัย</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <Icon name="shield-check" className="text-emerald-500 text-xl shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">การเชื่อมต่อที่ปลอดภัย (SSL)</p>
                    <p className="text-[10px] text-muted-foreground">เข้ารหัสข้อมูลระดับสูง</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                  <Icon name="qrcode" className="text-amber-500 text-xl shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">ยืนยันผ่าน PromptPay</p>
                    <p className="text-[10px] text-muted-foreground">ตรวจสอบสลิปอัตโนมัติ</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground font-semibold">
              &copy; {new Date().getFullYear()} SIAMSITE STORE. All rights reserved.
            </p>
            <div className="flex items-center gap-2.5 text-[11px] font-semibold text-muted-foreground/70">
              <Icon name="lock" className="text-emerald-500/80" />
              <span>ชำระเงินปลอดภัย</span>
              <span className="text-border">|</span>
              <Icon name="arrows-rotate" className="text-amber-500/80" />
              <span>อัปเดตฟรีตลอดการใช้งาน</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
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
