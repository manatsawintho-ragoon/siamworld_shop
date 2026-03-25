'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getRarity as rc } from '@/lib/rarity';

/* ── Types ─────────────────────────────────────────────────── */
interface LootBoxItem {
  id: number; name: string; description?: string; image?: string;
  command: string; weight: number; rarity: string; color?: string;
}
interface LootBox {
  id: number; name: string; description?: string; image?: string;
  price: number; original_price?: number; active: boolean;
  is_paused?: boolean; sale_start?: string; sale_end?: string;
  stock_limit?: number; sold_count?: number; items: LootBoxItem[];
}
interface WonItem { id: number; name: string; description?: string; image?: string; rarity: string; }
interface RecentDrop { username: string; item_name: string; item_image?: string; item_rarity: string; won_at: string; }

/* ── Constants ──────────────────────────────────────────────── */
const ITEM_W    = 148;
const ITEM_GAP  = 6;
const ITEM_SLOT = ITEM_W + ITEM_GAP;
const VISIBLE   = 9;
const TOTAL     = 80;
const WINNER    = 62;
const GRACE_MIN = 5;
const REEL_PAD  = 9;                    // top/bottom padding inside frame (room for shadow)
const REEL_H    = 150;                  // frame height
const CARD_H    = REEL_H - REEL_PAD * 2; // card height inside frame = 132px

// Rarity order lowest→highest
const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic'];

const CARD = 'bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden';

/* ── Reel builder (with near-miss suspense) ─────────────────── */
function buildReel(items: LootBoxItem[], winner: WonItem): LootBoxItem[] {
  const winIdx = RARITY_ORDER.indexOf((winner.rarity || '').toLowerCase());
  // Near-miss: find a higher-rarity item for the slot just before the winner
  const higherItems = items.filter(it =>
    RARITY_ORDER.indexOf((it.rarity || '').toLowerCase()) > winIdx
  );
  const nearMiss = higherItems.length > 0
    ? higherItems[Math.floor(Math.random() * higherItems.length)]
    : null;

  return Array.from({ length: TOTAL }, (_, i) => {
    if (i === WINNER)     return { ...(items.find(it => it.id === winner.id) || items[0]), id: winner.id };
    if (i === WINNER - 1 && nearMiss) return { ...nearMiss }; // tantalizingly close!
    return items[Math.floor(Math.random() * items.length)];
  });
}

/* ── Easing: instant full-speed → smooth deceleration (no two-phase) ── */
function csgoEase(t: number) {
  // Quintic ease-out: starts at maximum velocity, decelerates smoothly to rest
  return 1 - Math.pow(1 - t, 5);
}

/* ── Hooks ─────────────────────────────────────────────────── */
function useLiveSecs(targetMs: number | null) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!targetMs) return;
    const update = () => setS(Math.max(0, Math.floor((targetMs - Date.now()) / 1000)));
    update(); const t = setInterval(update, 1000); return () => clearInterval(t);
  }, [targetMs]);
  return s;
}

/* ── Audio: 3 separate sound files ─────────────────────────── */
//  /sounds/cs2-open-case.mp3       → plays on button click
//  /sounds/cs2-case-reel.mp3       → loops while reel spins
//  /sounds/cs2-reward-after-reel.mp3 → plays on win reveal

function getCtx(ref: React.MutableRefObject<AudioContext | null>) {
  if (!ref.current) ref.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ref.current;
}

async function decodeRaw(
  ctx: AudioContext,
  raw: ArrayBuffer | null,
  ref: React.MutableRefObject<AudioBuffer | null>,
) {
  if (ref.current || !raw) return ref.current;
  try { ref.current = await ctx.decodeAudioData(raw.slice(0)); } catch { ref.current = null; }
  return ref.current;
}

// Play a buffer once at 50% volume
function playOnce(ctx: AudioContext, buf: AudioBuffer, vol = 0.42) {
  const src = ctx.createBufferSource();
  const g   = ctx.createGain();
  src.buffer = buf; g.gain.value = vol;
  src.connect(g); g.connect(ctx.destination);
  src.start();
}

// Loop reel buffer with:
//   • lowpass filter  — removes high-freq buzz/noise
//   • fade-in ramp    — avoids abrupt start that sounds like "playing twice"
//   • smooth fade-out — syncs end with animation
function startSpinLoop(
  ctx: AudioContext,
  buf: AudioBuffer,
  nodeRef: React.MutableRefObject<AudioBufferSourceNode | null>,
  gainRef: React.MutableRefObject<GainNode | null>,
) {
  stopSpinLoop(nodeRef, gainRef); // clear any previous

  const src    = ctx.createBufferSource();
  const g      = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Lowpass at 4 kHz — cuts high-frequency buzz while preserving the body of the sound
  filter.type            = 'lowpass';
  filter.frequency.value = 4000;
  filter.Q.value         = 0.4;

  src.buffer = buf;
  // no loop — plays once, animation duration is set to match audio duration

  // Fade in over 0.8 s so reel sound ramps up with the animation
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.40, ctx.currentTime + 0.8);

  src.connect(filter); filter.connect(g); g.connect(ctx.destination);
  src.start();

  nodeRef.current = src;
  gainRef.current = g;
}

function stopSpinLoop(
  nodeRef: React.MutableRefObject<AudioBufferSourceNode | null>,
  gainRef: React.MutableRefObject<GainNode | null>,
  ctx?: AudioContext,
) {
  const src = nodeRef.current;
  const g   = gainRef.current;
  nodeRef.current = null;
  gainRef.current = null;
  if (!src) return;

  if (ctx && g) {
    // Fade out over 0.25 s then hard-stop — smooth end synced to animation finish
    const t = ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.25);
    setTimeout(() => { try { src.stop(); } catch {} }, 280);
  } else {
    try { src.stop(); } catch {}
  }
}

/* ── Helpers ────────────────────────────────────────────────── */
function fmt(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}ว ${h}ช ${m}น`;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/* ── RarityBadge ────────────────────────────────────────────── */
function RarityBadge({ rarity, small }: { rarity: string; small?: boolean }) {
  const r = rc(rarity);
  return (
    <span className={`inline-flex items-center gap-1 font-black uppercase tracking-[0.1em] rounded-md text-white leading-none ${small ? 'text-[7px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1'}`}
      style={{ backgroundColor: r.color, boxShadow: `0 1px 0 ${r.color}88` }}>
      <span className={`rounded-sm bg-white/60 flex-shrink-0 ${small ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />
      {r.label}
    </span>
  );
}

/* ── ItemCard — shared between reel and grid ────────────────── */

function ItemCard({
  item, highlight, inReel, chance,
}: { item: LootBoxItem; highlight?: boolean; inReel?: boolean; chance?: string }) {
  const r = rc(item.rarity);
  return (
    <div
      data-item={inReel ? '1' : undefined}
      data-ticked={inReel ? '' : undefined}
      className="flex flex-col overflow-hidden select-none relative transition-all duration-300 bg-white"
      style={{
        width: inReel ? `${ITEM_W}px` : '100%',
        height: inReel ? `${CARD_H}px` : undefined,
        flexShrink: inReel ? 0 : undefined,
        borderRadius: '12px',
        border: `3px solid ${r.color}`,
        boxShadow: highlight
          ? `0 0 0 3px ${r.color}aa, 0 0 28px ${r.color}66`
          : `0 4px 0 #c5cad3, 0 2px 12px rgba(0,0,0,0.10)`,
        transform: highlight ? 'scaleY(1.05)' : 'none',
      }}>

      {/* % drop-rate badge — grid only */}
      {chance && (
        <div className="absolute top-1.5 right-1.5 z-10 tabular-nums font-black leading-none"
          style={{ fontSize: '8px', padding: '2px 5px', borderRadius: '99px',
            background: 'rgba(255,255,255,0.88)', color: '#374151',
            border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          {chance}%
        </div>
      )}

      {/* Image area — white bg with subtle rarity glow */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-white"
        style={{ padding: inReel ? '6px 8px' : '10px' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 70% 65% at 50% 60%, ${r.color}1a 0%, transparent 70%)` }} />
        {item.image
          ? <img src={item.image} alt={item.name}
              className="object-contain relative z-10 transition-transform duration-300"
              style={{
                width: inReel ? '80px' : '70px',
                height: inReel ? '80px' : '70px',
                filter: highlight
                  ? `drop-shadow(0 0 12px ${r.color}cc)`
                  : `drop-shadow(0 2px 6px rgba(0,0,0,0.18)) drop-shadow(0 0 4px ${r.color}44)`,
                transform: highlight ? 'scale(1.12)' : 'scale(1)',
              }} />
          : <i className="fas fa-cube relative z-10 text-3xl" style={{ color: r.color }} />}
      </div>

      {/* Footer — rarity-tinted panel */}
      <div className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 flex-shrink-0"
        style={{
          backgroundColor: r.color + 'cc',
          borderTop: `2px solid ${r.color}`,
        }}>
        <RarityBadge rarity={item.rarity} small />
        <p className="font-black line-clamp-1 uppercase tracking-tight text-center leading-tight text-white"
          style={{ fontSize: '8px', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
          {item.name}
        </p>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function LootBoxOpenPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, refresh } = useAuth();

  const [box,        setBox]        = useState<LootBox | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [preparing,  setPreparing]  = useState(false);
  const [spinning,   setSpinning]   = useState(false);
  const [reel,       setReel]       = useState<LootBoxItem[]>([]);
  const [wonItem,    setWonItem]    = useState<WonItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error,      setError]      = useState('');
  const [drops,      setDrops]      = useState<RecentDrop[]>([]);

  const reelRef       = useRef<HTMLDivElement>(null);
  const trackRef      = useRef<HTMLDivElement>(null);
  const audioRef      = useRef<AudioContext | null>(null);
  // raw pre-fetched bytes (no AudioContext needed at load time)
  const rawOpenRef    = useRef<ArrayBuffer | null>(null);
  const rawReelRef    = useRef<ArrayBuffer | null>(null);
  const rawRewardRef  = useRef<ArrayBuffer | null>(null);
  // decoded AudioBuffers (created on first user gesture)
  const openBufRef    = useRef<AudioBuffer | null>(null);
  const reelBufRef    = useRef<AudioBuffer | null>(null);
  const rewardBufRef  = useRef<AudioBuffer | null>(null);
  const spinNodeRef   = useRef<AudioBufferSourceNode | null>(null);
  const spinGainRef   = useRef<GainNode | null>(null);
  const animRef       = useRef<number>(0);
  const isOpeningRef  = useRef(false);

  useEffect(() => {
    api(`/shop/lootboxes/${id}`)
      .then(d => setBox(d.box as LootBox))
      .catch(() => router.push('/lootbox'))
      .finally(() => setLoading(false));
    api(`/public/recent-lootbox?boxId=${id}`)
      .then(d => setDrops(((d.openings || []) as RecentDrop[]).slice(0, 20)))
      .catch(() => {});
    // Pre-fetch all 3 sound files silently (no AudioContext needed — avoids autoplay block)
    fetch('/sounds/cs2-open-case.mp3').then(r => r.arrayBuffer()).then(a => { rawOpenRef.current = a; }).catch(() => {});
    fetch('/sounds/cs2-case-reel.mp3').then(r => r.arrayBuffer()).then(a => { rawReelRef.current = a; }).catch(() => {});
    fetch('/sounds/cs2-reward-after-reel.mp3').then(r => r.arrayBuffer()).then(a => { rawRewardRef.current = a; }).catch(() => {});
  }, [id]);

  const saleEndMs     = box?.sale_end ? new Date(box.sale_end).getTime() : null;
  const graceEndMs    = saleEndMs ? saleEndMs + GRACE_MIN * 60000 : null;
  const remaining     = box?.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
  const isSoldOut     = remaining !== null && remaining <= 0;
  const isUnlimited   = !!box?.sale_start && !box?.sale_end;
  const saleSecsLeft  = useLiveSecs(saleEndMs);
  const graceSecsLeft = useLiveSecs(graceEndMs);
  const isPaused      = !!box?.is_paused;
  const isExpired     = !isPaused && saleEndMs !== null && saleSecsLeft <= 0;
  const isActive      = !isPaused && saleEndMs !== null && !isExpired;
  const inGrace       = isExpired && graceSecsLeft > 0;
  const isLocked      = isSoldOut || isExpired || isPaused;
  const stockPct      = box?.stock_limit && box.stock_limit > 0
    ? Math.round(((box.sold_count ?? 0) / box.stock_limit) * 100) : 0;

  useEffect(() => {
    if (!graceEndMs) return;
    const delay = graceEndMs - Date.now();
    if (delay <= 0) { router.push('/lootbox'); return; }
    const t = setTimeout(() => router.push('/lootbox'), delay);
    return () => clearTimeout(t);
  }, [graceEndMs]);

  const watchTicks = useCallback((trackEl: HTMLDivElement, centerX: number) => {
    trackEl.querySelectorAll<HTMLDivElement>('[data-item]').forEach(el => {
      if (el.dataset.ticked === '1') return;
      const rect = el.getBoundingClientRect();
      if (rect.left + rect.width / 2 < centerX) {
        el.dataset.ticked = '1';
      }
    });
  }, []);

  const openBox = async () => {
    if (!user)                { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!box || isLocked)     return;
    if (isOpeningRef.current) return;
    isOpeningRef.current = true;
    setPreparing(true);
    setError(''); setWonItem(null); setShowResult(false);

    // Create AudioContext + decode all buffers inside user-gesture handler
    const ctx = getCtx(audioRef);
    if (ctx.state === 'suspended') await ctx.resume();
    await Promise.all([
      decodeRaw(ctx, rawOpenRef.current,   openBufRef),
      decodeRaw(ctx, rawReelRef.current,   reelBufRef),
      decodeRaw(ctx, rawRewardRef.current, rewardBufRef),
    ]);

    // Play open-case sound immediately on click
    if (openBufRef.current) playOnce(ctx, openBufRef.current, 0.42);

    const minDelay = new Promise(r => setTimeout(r, 750));
    let result: { inventoryId: number; wonItem: WonItem } | null = null;
    try {
      const d = await api(`/shop/lootboxes/${id}/open`, { method: 'POST', token: getToken()! });
      result = d as unknown as { inventoryId: number; wonItem: WonItem };
    } catch (err: any) {
      await minDelay;
      setError(err?.message || 'เกิดข้อผิดพลาด');
      setPreparing(false); isOpeningRef.current = false; return;
    }
    await minDelay;
    if (!result) { setPreparing(false); isOpeningRef.current = false; return; }

    const won = result.wonItem;
    setWonItem(won); refresh();
    setBox(prev => prev ? { ...prev, sold_count: (prev.sold_count ?? 0) + 1 } : prev);
    const reelItems = buildReel(box.items, won);
    setPreparing(false);
    setSpinning(true);
    flushSync(() => { setReel(reelItems); });

    // Wait for reel DOM to mount
    await new Promise<void>(resolve => {
      const deadline = Date.now() + 700;
      const check = () => {
        if (reelRef.current && trackRef.current) { resolve(); return; }
        if (Date.now() > deadline) { resolve(); return; }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });

    if (!reelRef.current || !trackRef.current) { setSpinning(false); isOpeningRef.current = false; return; }
    trackRef.current.style.transform = 'translateX(0px)';
    trackRef.current.style.filter = 'none';
    trackRef.current.querySelectorAll<HTMLDivElement>('[data-item]').forEach(el => { el.dataset.ticked = ''; });
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (!reelRef.current || !trackRef.current) { setSpinning(false); isOpeningRef.current = false; return; }

    // Start reel spin loop (loops cs2-case-reel.mp3 until animation ends)
    if (reelBufRef.current && audioRef.current) startSpinLoop(audioRef.current, reelBufRef.current, spinNodeRef, spinGainRef);

    const cW      = reelRef.current.offsetWidth;
    const jitter  = (Math.random() - 0.5) * (ITEM_W * 0.22);
    const finalX  = -(ITEM_GAP + WINNER * ITEM_SLOT + ITEM_W / 2 - cW / 2 + jitter);
    const DURATION = 11500;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / DURATION, 1);
      const p = csgoEase(t);
      const x = finalX * p;
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${x}px)`;
        const blur = t < 0.4 ? (1 - t / 0.4) * 3.5 : 0;
        trackRef.current.style.filter = blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : 'none';
      }
      if (trackRef.current && reelRef.current) {
        const rect = reelRef.current.getBoundingClientRect();
        watchTicks(trackRef.current, rect.left + rect.width / 2);
      }
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${finalX}px)`;
          trackRef.current.style.filter = 'none';
        }
        setSpinning(false); setShowResult(true); isOpeningRef.current = false;
        stopSpinLoop(spinNodeRef, spinGainRef, audioRef.current ?? undefined);
        if (rewardBufRef.current && audioRef.current) playOnce(audioRef.current, rewardBufRef.current, 0.44);
        if (user) {
          setDrops(prev => [{
            username: user.username, item_name: won.name,
            item_image: won.image || undefined, item_rarity: won.rarity,
            won_at: new Date().toISOString(),
          }, ...prev].slice(0, 20));
        }
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    stopSpinLoop(spinNodeRef, spinGainRef);
  }, []);

  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <i className="fas fa-spinner fa-spin text-2xl text-green-500" />
      </div>
    </MainLayout>
  );
  if (!box) return null;

  const discount    = box.original_price && box.original_price > box.price
    ? Math.round((1 - box.price / box.original_price) * 100) : 0;
  const containerW  = VISIBLE * ITEM_SLOT;
  const totalWeight = box.items.reduce((s, i) => s + i.weight, 0);
  const previewReel = box.items.length > 0
    ? Array.from({ length: TOTAL }, (_, i) => box.items[i % box.items.length]) : [];
  const displayReel = reel.length > 0 ? reel : previewReel;
  const showReel    = spinning || showResult;

  return (
    <MainLayout>
      <div className="flex flex-col gap-4">

        {/* Back */}
        <Link href="/lootbox" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-green-600 text-xs font-bold transition-colors group w-fit">
          <i className="fas fa-arrow-left text-[10px] group-hover:-translate-x-0.5 transition-transform" /> กลับกล่องสุ่มทั้งหมด
        </Link>

        {/* ── Recent Drops ── */}
        {drops.length > 0 && (
          <div className={CARD}>
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-trophy text-amber-500 text-[10px]" />
              </div>
              <span className="font-bold text-gray-900 text-sm">โชคดีรายล่าสุด</span>
              <span className="ml-auto text-gray-400 text-[10px] font-bold tabular-nums">{drops.length} รายการ</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: 'none' }}>
              {drops.map((drop, i) => {
                const r = rc(drop.item_rarity);
                return (
                  <div key={i} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-white"
                    style={{ minWidth: '170px', maxWidth: '170px' }}>
                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                      {drop.item_image
                        ? <img src={drop.item_image} alt="" className="w-full h-full object-contain p-0.5" />
                        : <i className="fas fa-cube text-gray-300 text-sm" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-[10px] font-bold truncate">{drop.username}</p>
                      <p className="text-[9px] truncate mt-0.5" style={{ color: r.color }}>{drop.item_name}</p>
                    </div>
                    <RarityBadge rarity={drop.item_rarity} small />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STATE TOGGLE ── */}
        <AnimatePresence>
          {!showReel ? (
            /* ── STATE 1: BOX INFO ── */
            <motion.div key="box-info"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}>
              <div className={CARD}>

                {/* Hero — white/green/amber */}
                <div className="relative overflow-hidden">
                  {/* Green top accent bar */}
                  <div className="h-1 bg-gradient-to-r from-green-500 via-green-400 to-emerald-400" />

                  <div className="flex items-center gap-5 px-6 py-5">
                    {/* Box image */}
                    <div className="relative flex-shrink-0 group/box">
                      {discount > 0 && (
                        <span className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-[0_2px_0_#b91c1c]">
                          -{discount}%
                        </span>
                      )}
                      <div className="w-24 h-24 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center overflow-hidden shadow-[0_2px_0_#bbf7d0]">
                        {box.image
                          ? <img src={box.image} alt={box.name}
                              className="w-full h-full object-contain p-1.5 transition-transform duration-500 group-hover/box:scale-105" />
                          : <i className="fas fa-box text-4xl text-green-400" />}
                      </div>
                    </div>

                    {/* Name + price */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        {(isActive || isUnlimited) && !isSoldOut && (
                          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-green-500 text-white shadow-[0_2px_0_#0d6b2e]">
                            <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> ขายอยู่
                          </span>
                        )}
                        {isPaused  && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500 text-white">PAUSED</span>}
                        {isSoldOut && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500 text-white">SOLD OUT</span>}
                      </div>
                      <h1 className="text-gray-900 font-black text-xl uppercase tracking-wide leading-tight line-clamp-1">{box.name}</h1>
                      {box.description && <p className="text-gray-400 text-[11px] line-clamp-1 mt-0.5">{box.description}</p>}
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-green-600 font-black text-3xl tabular-nums tracking-tighter">{parseFloat(String(box.price)).toLocaleString()}</span>
                        <span className="text-green-600 font-black text-base">฿</span>
                        {box.original_price && box.original_price > box.price && (
                          <span className="text-gray-300 text-sm font-bold line-through tabular-nums">{parseFloat(String(box.original_price)).toLocaleString()}฿</span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                      <div className="flex gap-2">
                        <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-[0_2px_0_#e5e7eb] min-w-[52px]">
                          <span className="text-gray-400 text-[7px] font-black uppercase tracking-widest">ITEMS</span>
                          <span className="text-gray-800 font-black text-sm tabular-nums">{box.items.length}</span>
                        </div>
                        <div className="flex flex-col items-center px-3 py-2 rounded-xl bg-green-50 border border-green-100 shadow-[0_2px_0_#bbf7d0] min-w-[52px]">
                          <span className="text-green-600/60 text-[7px] font-black uppercase tracking-widest">OPENS</span>
                          <span className="text-green-600 font-black text-sm tabular-nums">{(box.sold_count ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {remaining !== null && box.stock_limit! > 0 && (
                        <div className="w-full min-w-[112px] space-y-1">
                          <div className="flex justify-between text-[7px] font-black uppercase tracking-widest">
                            <span className={isSoldOut ? 'text-red-500' : stockPct >= 80 ? 'text-orange-500' : 'text-gray-400'}>STOCK</span>
                            <span className="text-gray-400">{stockPct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                            <div className={`h-full rounded-full transition-all ${isSoldOut ? 'bg-red-500' : stockPct >= 80 ? 'bg-red-500' : stockPct >= 60 ? 'bg-orange-400' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, stockPct))}%` }} />
                          </div>
                        </div>
                      )}
                      {isActive && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 shadow-[0_2px_0_#fde68a]">
                          <i className="fas fa-clock text-amber-500 text-[9px]" />
                          <span className="text-amber-600 font-black text-xs tabular-nums">{fmt(saleSecsLeft)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preparing overlay — light */}
                  <AnimatePresence>
                    {preparing && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/90 backdrop-blur-sm">
                        <div className="w-10 h-10 rounded-full border-[3px] border-gray-200 border-t-green-500 animate-spin mb-3" />
                        <p className="text-gray-600 font-black text-xs uppercase tracking-[0.25em]">กำลังเตรียม...</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Open button */}
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/40">
                  {error && (
                    <div className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5 mb-3">
                      <i className="fas fa-exclamation-circle" /> {error}
                    </div>
                  )}
                  <button onClick={openBox} disabled={preparing || isLocked}
                    className="w-full flex items-center justify-center gap-2.5 font-black text-sm uppercase tracking-[0.2em] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                    style={{
                      height: '52px',
                      background: preparing || isLocked ? '#e5e7eb' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: preparing || isLocked ? '#9ca3af' : '#fff',
                      boxShadow: preparing || isLocked ? 'none' : '0 6px 0 #0d6b2e, 0 12px 20px rgba(22,163,74,0.2)',
                    }}>
                    {!preparing && !isLocked && (
                      <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover:translate-x-[200%] bg-white/25 transition-transform duration-700 pointer-events-none" />
                    )}
                    <i className={`fas text-base ${isPaused ? 'fa-pause' : isSoldOut ? 'fa-lock' : isExpired ? 'fa-lock' : 'fa-bolt'}`} />
                    <span>{isPaused ? 'PAUSED' : isSoldOut ? 'SOLD OUT' : isExpired ? 'EXPIRED' : <>OPEN &mdash; ฿{parseFloat(String(box.price)).toLocaleString()}</>}</span>
                  </button>
                  {!user && !isLocked && (
                    <p className="text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-2">
                      <i className="fas fa-lock text-[9px] mr-1" />กรุณาเข้าสู่ระบบก่อน
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

          ) : (
            /* ── STATE 2: REEL ── */
            <motion.div key="reel"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              <div className={CARD}>

                {/* Reel area */}
                <div className="relative bg-white px-6" style={{ paddingTop: '22px', paddingBottom: '22px' }}>

                  {/* Outer wrapper — positions arrows OUTSIDE the overflow-hidden frame */}
                  <div className="relative mx-auto" style={{ width: `${containerW}px`, maxWidth: '100%' }}>

                    {/* Amber arrows — pointing into the frame from outside */}
                    <div className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none" style={{ top: '-12px' }}>
                      <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid #f59e0b', filter: 'drop-shadow(0 2px 5px rgba(245,158,11,0.9))' }} />
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none" style={{ bottom: '-12px' }}>
                      <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '12px solid #f59e0b', filter: 'drop-shadow(0 -2px 5px rgba(245,158,11,0.9))' }} />
                    </div>

                    {/* Sunken reel frame — green border, inset depth */}
                    <div className="relative overflow-hidden rounded-2xl"
                      style={{
                        border: '2px solid #16a34a',
                        boxShadow: [
                          'inset 0 6px 14px rgba(0,0,0,0.13)',
                          'inset 0 -3px 8px rgba(0,0,0,0.06)',
                          'inset 4px 0 8px rgba(0,0,0,0.04)',
                          'inset -4px 0 8px rgba(0,0,0,0.04)',
                          '0 4px 0 #0d6b2e',
                          '0 2px 20px rgba(22,163,74,0.18)',
                        ].join(', '),
                        background: 'linear-gradient(180deg, #e8f5e9 0%, #f3f4f6 12%, #f3f4f6 88%, #e8f5e9 100%)',
                      }}>

                      {/* Amber center pointer line — inside frame */}
                      <div className="absolute inset-y-0 left-1/2 -translate-x-px z-30 pointer-events-none"
                        style={{ width: '2px', background: '#f59e0b', boxShadow: '0 0 10px rgba(245,158,11,0.8)' }} />

                      {/* Side fades — match frame bg */}
                      <div className="absolute inset-y-0 left-0 w-36 z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to right, #f3f4f6 0%, transparent 100%)' }} />
                      <div className="absolute inset-y-0 right-0 w-36 z-20 pointer-events-none"
                        style={{ background: 'linear-gradient(to left, #f3f4f6 0%, transparent 100%)' }} />

                      {/* Reel track */}
                      <div ref={reelRef} className="overflow-hidden relative z-10 w-full" style={{ height: `${REEL_H}px` }}>
                        <div ref={trackRef} className="flex h-full items-stretch"
                          style={{ willChange: 'transform', gap: `${ITEM_GAP}px`, padding: `${REEL_PAD}px ${ITEM_GAP}px` }}>
                          {displayReel.map((item, i) => (
                            <ItemCard key={i} item={item} inReel
                              highlight={reel.length > 0 && i === WINNER && showResult} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Button */}
                <div className="px-5 py-4 bg-gray-50/60 flex justify-center">
                  <button onClick={openBox} disabled={spinning || isLocked}
                    className="flex items-center justify-center gap-2.5 font-black text-[11px] uppercase tracking-[0.25em] rounded-xl transition-all disabled:opacity-50 h-11 px-8"
                    style={{
                      minWidth: '200px',
                      background: spinning || isLocked ? '#e5e7eb' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: spinning || isLocked ? '#9ca3af' : '#fff',
                      boxShadow: spinning || isLocked ? 'none' : '0 4px 0 #0d6b2e',
                    }}>
                    <i className={`fas text-sm ${spinning ? 'fa-spinner fa-spin' : isLocked ? 'fa-lock' : 'fa-bolt'}`} />
                    <span>{spinning ? 'กำลังหมุน...' : isPaused ? 'PAUSED' : isSoldOut ? 'SOLD OUT' : isExpired ? 'EXPIRED' : <>OPEN อีกครั้ง &mdash; ฿{parseFloat(String(box.price)).toLocaleString()}</>}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Items in box ── */}
        <div className={CARD}>
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-layer-group text-green-600 text-[10px]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">ไอเท็มที่สุ่มได้ในกล่องนี้</h3>
              <p className="text-[11px] text-gray-400">กด OPEN เพื่อลุ้นรับไอเท็มด้านล่าง</p>
            </div>
            <span className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-lg bg-green-500 text-white text-[10px] font-black shadow-[0_2px_0_#0d6b2e]">
              {box.items.length}
            </span>
          </div>
          <div className="p-5">
            {(() => {
              const order = ['mythic','legendary','epic','rare','uncommon','common'];
              const sorted = [...box.items].sort((a,b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
              return (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {sorted.map(item => {
                    const chance = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(2) : '0';
                    return (
                      <div key={item.id} className="group transition-all duration-300 hover:-translate-y-1">
                        <ItemCard item={item} chance={chance} />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

      </div>

      {/* ── Result Modal ── */}
      <AnimatePresence>
        {showResult && wonItem && (() => {
          const r = rc(wonItem.rarity);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50">
              <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowResult(false)} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }}
                className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden"
                style={{ borderTop: `4px solid ${r.color}` }}>
                {/* Header */}
                <div className="relative px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: r.color + '18' }}>
                    <i className="fas fa-gift text-xs" style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 text-center">
                    <h3 className="font-bold text-gray-900 text-base">ได้รับไอเท็ม!</h3>
                    <p className="text-[11px] text-gray-400">ระบบส่งไอเท็มให้คุณแล้ว</p>
                  </div>
                  <button onClick={() => setShowResult(false)}
                    className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b91c1c] active:translate-y-[2px] flex-shrink-0">
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
                {/* Body */}
                <div className="p-6 flex flex-col items-center text-center">
                  <RarityBadge rarity={wonItem.rarity} />
                  <div className="relative my-5 flex items-center justify-center">
                    <div className="absolute w-32 h-32 rounded-full animate-pulse"
                      style={{ background: r.color, opacity: 0.12, filter: 'blur(16px)' }} />
                    {wonItem.image
                      ? <img src={wonItem.image} alt={wonItem.name}
                          className="relative w-36 h-36 object-contain z-10"
                          style={{ filter: `drop-shadow(0 0 18px ${r.color}77)` }} />
                      : <div className="relative w-36 h-36 rounded-2xl flex items-center justify-center border-2 z-10"
                          style={{ borderColor: r.color + '44', backgroundColor: r.color + '0d' }}>
                          <i className="fas fa-cube text-6xl" style={{ color: r.color + '88' }} />
                        </div>}
                  </div>
                  <h3 className="text-gray-900 font-black text-xl uppercase tracking-tight leading-tight">{wonItem.name}</h3>
                  {wonItem.description && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{wonItem.description}</p>}
                </div>
                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
                  <button onClick={() => setShowResult(false)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-[0_1px_0_#d1d5db] active:translate-y-[2px]">
                    <i className="fas fa-times text-[12px]" /> ปิด
                  </button>
                  <button onClick={() => { setShowResult(false); openBox(); }} disabled={spinning || isLocked}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
                    <i className="fas fa-rotate-right text-[12px]" /> สุ่มอีกครั้ง
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </MainLayout>
  );
}
