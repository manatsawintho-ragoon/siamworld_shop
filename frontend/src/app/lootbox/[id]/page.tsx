'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Types ─────────────────────────────────────────────────── */
interface LootBoxItem {
  id: number; name: string; description?: string; image?: string;
  weight: number; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
}
interface LootBox {
  id: number; name: string; description?: string; image?: string;
  price: number; original_price?: number | null;
  items: LootBoxItem[];
  stock_limit?: number | null; sale_start?: string | null; sale_end?: string | null;
  sold_count?: number; is_paused?: boolean;
}
interface WonItem { id: number; name: string; image?: string | null; rarity: string; description?: string | null; }
interface RecentDrop { username: string; item_name: string; item_image?: string; item_rarity: string; won_at: string; }

/* ── Rarity ─────────────────────────────────────────────────── */
const RC: Record<string, { label: string; color: string; bg: string; stripe: string; badge: string; glow: string }> = {
  mythic:    { label: 'MYTHIC',    color: '#dc2626', bg: '#1c0808', stripe: '#dc2626', badge: 'bg-red-600',    glow: '#dc262688' },
  legendary: { label: 'LEGENDARY', color: '#f97316', bg: '#1c0e04', stripe: '#f97316', badge: 'bg-orange-500', glow: '#f9731688' },
  epic:      { label: 'EPIC',      color: '#9333ea', bg: '#130a1c', stripe: '#9333ea', badge: 'bg-purple-600', glow: '#9333ea88' },
  rare:      { label: 'RARE',      color: '#2563eb', bg: '#040a1c', stripe: '#2563eb', badge: 'bg-blue-600',   glow: '#2563eb88' },
  uncommon:  { label: 'UNCOMMON',  color: '#16a34a', bg: '#04110a', stripe: '#16a34a', badge: 'bg-green-600',  glow: '#16a34a88' },
  common:    { label: 'COMMON',    color: '#64748b', bg: '#0d0f12', stripe: '#64748b', badge: 'bg-slate-500',  glow: '#64748b88' },
};
const rc = (r: string) => RC[r] || RC.common;

/* ── Constants ──────────────────────────────────────────────── */
const ITEM_W    = 158;
const ITEM_GAP  = 6;
const ITEM_SLOT = ITEM_W + ITEM_GAP;
const VISIBLE   = 7;
const TOTAL     = 80;
const WINNER    = 62;
const GRACE_MIN = 5;

/* ── Reel builder ───────────────────────────────────────────── */
function buildReel(items: LootBoxItem[], winner: WonItem): LootBoxItem[] {
  return Array.from({ length: TOTAL }, (_, i) =>
    i === WINNER
      ? { ...(items.find(it => it.id === winner.id) || items[0]), id: winner.id }
      : items[Math.floor(Math.random() * items.length)]
  );
}

/* ── CS:GO2-style ease: fast rush → agonising crawl ────────── */
// Single smooth power function — no velocity discontinuity between phases.
// Old two-phase version had velocity=0 at end of Phase 1 then velocity≈1800px/s
// at start of Phase 2, which looked like "stopping then restarting".
// n=2.5 gives: fast start (v=2.5), same distance coverage as before (~86% at 55%
// of time), smooth deceleration to near-zero, ~8 items visible in final crawl.
function csgoEase(t: number): number {
  return 1 - Math.pow(1 - t, 2.5);
}

/* ── CS:GO2-style synthesised sounds ───────────────────────── */
function getCtx(ref: React.MutableRefObject<AudioContext | null>) {
  if (!ref.current) ref.current = new AudioContext();
  return ref.current;
}
function playTick(ctx: AudioContext, velocity = 1) {
  const dur = 0.022;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = 1800 + velocity * 1800; bpf.Q.value = 7;
  const g = ctx.createGain(); g.gain.value = Math.min(0.4, 0.18 + velocity * 0.22);
  src.connect(bpf); bpf.connect(g); g.connect(ctx.destination); src.start();
}
function playWin(ctx: AudioContext, rarity: string) {
  const freqMap: Record<string, number[]> = {
    mythic:    [523.25, 659.25, 783.99, 1046.5, 1318.5],
    legendary: [440, 554.37, 659.25, 880, 1108.7],
    epic:      [369.99, 466.16, 554.37, 739.99, 932.33],
    rare:      [293.66, 369.99, 440, 587.33, 739.99],
    uncommon:  [261.63, 329.63, 392, 523.25, 659.25],
    common:    [220, 261.63, 329.63, 440, 523.25],
  };
  const notes = freqMap[rarity] || freqMap.common;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    const t0 = ctx.currentTime + i * 0.07;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.12 + (i === notes.length - 1 ? 0.05 : 0), t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
    osc.connect(g); g.connect(ctx.destination); osc.start(t0); osc.stop(t0 + 1.0);
  });
  const sw = ctx.createOscillator(); const sg = ctx.createGain();
  sw.type = 'sine';
  sw.frequency.setValueAtTime(90, ctx.currentTime);
  sw.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.45);
  sg.gain.setValueAtTime(0.08, ctx.currentTime);
  sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  sw.connect(sg); sg.connect(ctx.destination); sw.start(ctx.currentTime); sw.stop(ctx.currentTime + 0.45);
}

/* ── Helpers ────────────────────────────────────────────────── */
function useLiveSecs(ms: number | null) {
  const [s, setS] = useState(() => ms ? Math.max(0, Math.floor((ms - Date.now()) / 1000)) : 0);
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => setS(Math.max(0, Math.floor((ms - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [ms]);
  return s;
}
function fmt(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}ว ${h}ช ${m}น`;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime();
  if (diff < 60000) return 'เมื่อกี้';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}น`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}ช`;
  return `${Math.floor(diff / 86400000)}ว`;
}

/* ── ReelItem ───────────────────────────────────────────────── */
function ReelItem({ item, highlight }: { item: LootBoxItem; highlight?: boolean }) {
  const r = rc(item.rarity);
  return (
    <div data-item="1" data-ticked=""
      className="flex-shrink-0 flex flex-col items-center justify-between overflow-hidden select-none"
      style={{
        width: `${ITEM_W}px`, height: '176px',
        background: `linear-gradient(180deg, ${r.bg} 0%, #0a0c10 100%)`,
        borderTop: `3px solid ${r.stripe}`,
        borderLeft: '1px solid #1f2937', borderRight: '1px solid #1f2937', borderBottom: '1px solid #1f2937',
        boxShadow: highlight ? `0 0 28px ${r.glow}, inset 0 0 18px ${r.color}18` : 'none',
        transition: 'box-shadow 0.3s',
      }}>
      <div className="flex-1 flex items-center justify-center p-3 w-full">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-[72px] h-[72px] object-contain"
              style={{ filter: `drop-shadow(0 0 8px ${r.color}55)` }} />
          : <i className="fas fa-cube text-4xl" style={{ color: r.color }} />}
      </div>
      <div className="w-full px-2 pb-2 text-center">
        <p className="text-white/80 text-[10px] font-medium line-clamp-1 mb-1 leading-tight">{item.name}</p>
        <span className={`inline-block text-[9px] font-black px-2 py-px rounded-sm text-white uppercase tracking-wider ${r.badge}`}>{r.label}</span>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function LootBoxOpenPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [box,        setBox]        = useState<LootBox | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [spinning,   setSpinning]   = useState(false);
  const [reel,       setReel]       = useState<LootBoxItem[]>([]);
  const [wonItem,    setWonItem]    = useState<WonItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error,      setError]      = useState('');
  const [drops,      setDrops]      = useState<RecentDrop[]>([]);

  const reelRef   = useRef<HTMLDivElement>(null);
  const trackRef  = useRef<HTMLDivElement>(null);
  const audioRef  = useRef<AudioContext | null>(null);
  const animRef   = useRef<number>(0);

  /* load box + drops */
  useEffect(() => {
    api(`/shop/lootboxes/${id}`)
      .then(d => setBox(d.box as LootBox))
      .catch(() => router.push('/lootbox'))
      .finally(() => setLoading(false));
    api(`/public/recent-lootbox?boxId=${id}`)
      .then(d => setDrops(((d.openings || []) as RecentDrop[]).slice(0, 20)))
      .catch(() => {});
  }, [id]);

  /* sale state */
  const saleEndMs  = box?.sale_end ? new Date(box.sale_end).getTime() : null;
  const graceEndMs = saleEndMs ? saleEndMs + GRACE_MIN * 60000 : null;
  const remaining  = box?.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
  const isSoldOut  = remaining !== null && remaining <= 0;
  const isUnlimited = !!box?.sale_start && !box?.sale_end;
  const saleSecsLeft  = useLiveSecs(saleEndMs);
  const graceSecsLeft = useLiveSecs(graceEndMs);
  const isPaused  = !!box?.is_paused;
  const isExpired = !isPaused && saleEndMs !== null && saleSecsLeft <= 0;
  const isActive  = !isPaused && saleEndMs !== null && !isExpired;
  const inGrace   = isExpired && graceSecsLeft > 0;
  const isLocked  = isSoldOut || isExpired || isPaused;
  const stockPct  = box?.stock_limit && box.stock_limit > 0
    ? Math.round(((box.stock_limit - (box.sold_count ?? 0)) / box.stock_limit) * 100)
    : 100;

  useEffect(() => {
    if (!graceEndMs) return;
    const delay = graceEndMs - Date.now();
    if (delay <= 0) { router.push('/lootbox'); return; }
    const t = setTimeout(() => router.push('/lootbox'), delay);
    return () => clearTimeout(t);
  }, [graceEndMs]);

  /* tick detection */
  const watchTicks = useCallback((trackEl: HTMLDivElement, centerX: number, progress: number) => {
    const velocity = Math.max(0.05, 1 - progress * 0.95);
    trackEl.querySelectorAll<HTMLDivElement>('[data-item]').forEach(el => {
      if (el.dataset.ticked === '1') return;
      const rect = el.getBoundingClientRect();
      if (rect.left + rect.width / 2 < centerX) {
        el.dataset.ticked = '1';
        playTick(getCtx(audioRef), velocity);
      }
    });
  }, []);

  const openBox = async () => {
    if (!user)                   { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!box || spinning || isLocked) return;

    // Cancel any in-flight animation immediately
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = 0; }

    setError(''); setSpinning(true); setWonItem(null); setShowResult(false);

    let result: { inventoryId: number; wonItem: WonItem } | null = null;
    try {
      const d = await api(`/shop/lootboxes/${id}/open`, { method: 'POST', token: getToken()! });
      result = d as unknown as { inventoryId: number; wonItem: WonItem };
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
      setSpinning(false); return;
    }
    if (!result) return;

    const won = result.wonItem;
    setWonItem(won); refresh();
    setBox(prev => prev ? { ...prev, sold_count: (prev.sold_count ?? 0) + 1 } : prev);

    const reelItems = buildReel(box.items, won);

    // flushSync: force React to commit the new reel to DOM synchronously
    // before we touch the DOM transform — eliminates the async re-render race
    flushSync(() => { setReel(reelItems); });

    if (!reelRef.current || !trackRef.current) { setSpinning(false); return; }

    // Reset position and tick markers after DOM is in sync
    trackRef.current.style.transform = 'translateX(0px)';
    trackRef.current.style.filter = 'none';
    trackRef.current.querySelectorAll<HTMLDivElement>('[data-item]').forEach(el => { el.dataset.ticked = ''; });

    // Two frames: let browser paint the reset before measuring + animating
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (!reelRef.current || !trackRef.current) { setSpinning(false); return; }

    const containerW = reelRef.current.offsetWidth;
    // Account for track padding (ITEM_GAP) so winner is centred exactly
    const jitter  = (Math.random() - 0.5) * (ITEM_W * 0.25); // ±20px
    const finalX  = -(ITEM_GAP + WINNER * ITEM_SLOT + ITEM_W / 2 - containerW / 2 + jitter);
    const duration = 7500;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const p = csgoEase(t);
      const x = finalX * p;

      // Direct DOM: no React re-render on every frame
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${x}px)`;
        const blur = t < 0.5 ? (1 - t / 0.5) * 2.5 : 0;
        trackRef.current.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
      }

      if (trackRef.current && reelRef.current) {
        const rect = reelRef.current.getBoundingClientRect();
        watchTicks(trackRef.current, rect.left + rect.width / 2, t);
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we stop exactly at finalX
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${finalX}px)`;
          trackRef.current.style.filter = 'none';
        }
        setSpinning(false); setShowResult(true);
        playWin(getCtx(audioRef), won.rarity);
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

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  /* loading */
  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <i className="fas fa-spinner fa-spin text-3xl text-green-400" />
      </div>
    </MainLayout>
  );
  if (!box) return null;

  const discount    = box.original_price && box.original_price > box.price
    ? Math.round((1 - box.price / box.original_price) * 100) : 0;
  const containerW  = VISIBLE * ITEM_SLOT;
  const totalWeight = box.items.reduce((s, i) => s + i.weight, 0);

  const previewReel = box.items.length > 0
    ? Array.from({ length: TOTAL }, (_, i) => box.items[i % box.items.length])
    : [];
  const displayReel = reel.length > 0 ? reel : previewReel;

  return (
    <MainLayout>
      <div className="flex flex-col gap-2">

        {/* Back */}
        <Link href="/lootbox" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-green-400 text-xs font-bold transition-colors group">
          <i className="fas fa-arrow-left text-[10px] group-hover:-translate-x-0.5 transition-transform" /> กลับกล่องสุ่มทั้งหมด
        </Link>

        {/* ── Hero card — centered box layout ──────────────────── */}
        <div className="rounded-xl overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.6),0_8px_32px_rgba(0,0,0,0.5)] border border-white/5"
          style={{ background: 'linear-gradient(160deg, #11141e 0%, #0d1017 60%, #080c13 100%)' }}>

          <div className="px-4 py-3 flex items-center gap-3">
            {/* left stat */}
            <div className="flex-shrink-0 text-center w-14">
              <p className="text-gray-700 text-[9px] font-black uppercase tracking-widest">ITEMS</p>
              <p className="text-gray-200 font-black text-2xl leading-none">{box.items.length}</p>
            </div>

            {/* center: image + name + price */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              {/* status badges */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {(isActive || isUnlimited) && !isSoldOut && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    style={{ background: '#16a34a18', borderColor: '#16a34a44', color: '#22c55e' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />กำลังขายอยู่
                  </span>
                )}
                {isPaused && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-400">
                    <i className="fas fa-pause text-[7px]" /> หยุดชั่วคราว
                  </span>
                )}
                {isSoldOut && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-400">
                    <i className="fas fa-box text-[7px]" /> หมดแล้ว
                  </span>
                )}
                {(isActive || isUnlimited || (box.stock_limit != null)) && !isSoldOut && !isPaused && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-400">
                    <i className="fas fa-gem text-[7px]" /> LIMITED
                  </span>
                )}
              </div>

              {/* box image centered */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(circle at 50% 60%, #f9731640 0%, transparent 70%)' }} />
                {box.image
                  ? <img src={box.image} alt={box.name} className="relative w-20 h-20 object-contain"
                      style={{ filter: 'drop-shadow(0 0 18px #f9731666)' }} />
                  : <i className="fas fa-box text-5xl text-amber-400 relative" style={{ filter: 'drop-shadow(0 0 14px #f97316)' }} />
                }
              </div>

              <h1 className="text-white font-black text-lg leading-tight text-center">{box.name}</h1>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                {discount > 0 && <>
                  <span className="text-gray-600 text-sm line-through tabular-nums">{parseFloat(String(box.original_price)).toLocaleString()}฿</span>
                  <span className="text-[10px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded-sm">-{discount}%</span>
                </>}
                <span className="text-amber-400 font-black text-2xl tabular-nums leading-none">
                  {parseFloat(String(box.price)).toLocaleString()}<span className="text-base ml-0.5 text-amber-600">฿</span>
                </span>
              </div>
            </div>

            {/* right stat */}
            <div className="flex-shrink-0 text-center w-14">
              <p className="text-gray-700 text-[9px] font-black uppercase tracking-widest">OPENS</p>
              <p className="text-amber-500 font-black text-2xl leading-none">{(box.sold_count ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {/* sale / stock strip */}
          {(isActive || isUnlimited || isSoldOut || (remaining !== null && box.stock_limit! > 0)) && (
            <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 flex-wrap">
              {isActive && (
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-clock text-amber-500 text-xs" />
                  <span className="text-gray-500 text-[11px]">เหลือเวลา</span>
                  <span className="bg-amber-500 text-black text-[11px] font-black tabular-nums px-2 py-0.5 rounded-sm min-w-[50px] text-center shadow-[0_2px_0_#92400e]">
                    {fmt(saleSecsLeft)}
                  </span>
                </div>
              )}
              {isUnlimited && !isSoldOut && (
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-infinity text-green-500 text-xs" />
                  <span className="text-green-500 text-[11px] font-bold">ไม่จำกัดเวลา</span>
                </div>
              )}
              {inGrace && (
                <div className="ml-auto flex items-center gap-1.5">
                  <i className="fas fa-hourglass-end text-gray-600 text-xs" />
                  <span className="text-gray-600 text-[11px]">ปิดใน</span>
                  <span className="text-gray-400 font-black text-[11px] tabular-nums">{fmt(graceSecsLeft)}</span>
                </div>
              )}
              {remaining !== null && box.stock_limit! > 0 && (
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold flex items-center gap-1 ${isSoldOut ? 'text-red-400' : stockPct <= 20 ? 'text-orange-400' : 'text-gray-400'}`}>
                      <i className="fas fa-box text-[8px]" />
                      {isSoldOut ? 'หมดแล้ว' : `เหลือ ${remaining!.toLocaleString()} กล่อง`}
                    </span>
                    <span className="text-gray-700 text-[9px] tabular-nums font-bold">
                      {(box.sold_count ?? 0).toLocaleString()}/{box.stock_limit!.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1f2a' }}>
                    <div className={`h-full rounded-full transition-all duration-700 ${isSoldOut ? 'bg-red-500' : stockPct <= 20 ? 'bg-orange-400' : 'bg-green-500'}`}
                      style={{ width: `${Math.max(0, stockPct)}%`, boxShadow: `0 0 6px ${isSoldOut ? '#ef4444' : stockPct <= 20 ? '#fb923c' : '#22c55e'}88` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Recent drops — horizontal strip ────────────────────── */}
        {drops.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-white/5"
            style={{ background: '#0d1017' }}>
            <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: '#1a1f2a' }}>
              <div className="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0" style={{ background: '#f9731622' }}>
                <i className="fas fa-trophy text-amber-400 text-[9px]" />
              </div>
              <span className="text-gray-300 font-bold text-xs">รางวัลล่าสุด</span>
              <span className="ml-auto text-gray-700 text-[10px] font-bold flex-shrink-0">{drops.length} รายการ</span>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 py-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {drops.map((drop, i) => {
                const r = rc(drop.item_rarity);
                return (
                  <div key={i}
                    className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-sm"
                    style={{ background: '#111520', border: `1px solid ${r.stripe}28`, minWidth: '166px', maxWidth: '166px' }}>
                    <img
                      src={`https://minotar.net/avatar/${drop.username}/20`} alt=""
                      className="w-6 h-6 rounded-sm flex-shrink-0"
                      style={{ imageRendering: 'pixelated' }}
                      onError={e => { (e.target as HTMLImageElement).src = 'https://minotar.net/avatar/MHF_Steve/20'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-[10px] font-bold truncate leading-tight">{drop.username}</p>
                      <p className="text-gray-600 text-[9px] truncate leading-tight">{drop.item_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-px rounded-full text-white uppercase"
                        style={{ background: r.color }}>
                        <span className="w-1 h-1 rounded-full bg-white" />{r.label}
                      </span>
                      {drop.item_image ? (
                        <div className="w-6 h-6 flex items-center justify-center rounded-sm overflow-hidden"
                          style={{ background: r.bg, borderTop: `2px solid ${r.stripe}` }}>
                          <img src={drop.item_image} alt="" className="w-5 h-5 object-contain" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 flex items-center justify-center rounded-sm"
                          style={{ background: r.bg, borderTop: `2px solid ${r.stripe}` }}>
                          <i className="fas fa-cube text-[10px]" style={{ color: r.color }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Reel + button ──────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.6),0_8px_40px_rgba(0,0,0,0.5)] border border-white/5"
          style={{ background: '#08090d' }}>

          {/* Locked banners */}
          {(isSoldOut || (isExpired && !isSoldOut)) && (
            <div className={`mx-4 mt-3 mb-0 border rounded-sm px-4 py-2.5 flex items-center gap-3 ${isSoldOut ? 'border-red-900/60 bg-red-950/30' : 'border-gray-800 bg-gray-900/40'}`}>
              <i className={`fas text-lg ${isSoldOut ? 'fa-box text-red-500' : 'fa-clock text-gray-600'}`} />
              <div>
                <p className={`font-black text-sm ${isSoldOut ? 'text-red-400' : 'text-gray-400'}`}>
                  {isSoldOut ? 'กล่องสุ่มนี้หมดแล้ว' : 'หมดเวลาขายแล้ว'}
                </p>
                <p className={`text-xs mt-0.5 ${isSoldOut ? 'text-red-800' : 'text-gray-700'}`}>
                  {isSoldOut ? 'สต็อคหมด — กรุณารอรอบถัดไป' : inGrace ? `หน้านี้จะปิดอัตโนมัติใน ${fmt(graceSecsLeft)}` : 'การขายสิ้นสุดแล้ว'}
                </p>
              </div>
            </div>
          )}

          {/* error */}
          {error && (
            <div className="mx-4 mt-3 mb-0 border border-red-800/60 bg-red-950/30 rounded-sm px-4 py-2 flex items-center justify-center gap-2 text-red-400 text-sm">
              <i className="fas fa-exclamation-triangle" />{error}
            </div>
          )}

          {/* Reel area */}
          <div className="p-3 pb-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-1/2 -translate-x-px z-30 pointer-events-none"
                style={{ width: '2px', background: 'linear-gradient(180deg, transparent, #f59e0b, transparent)', boxShadow: spinning ? '0 0 12px #f59e0b, 0 0 24px #f59e0b44' : '0 0 6px #f59e0b88' }} />
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '16px solid #f59e0b', filter: 'drop-shadow(0 0 5px #f59e0b)' }} />
              <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderBottom: '16px solid #f59e0b', filter: 'drop-shadow(0 0 5px #f59e0b)' }} />
              <div className="absolute inset-y-0 left-0 w-28 z-20 pointer-events-none rounded-l"
                style={{ background: 'linear-gradient(to right, #08090d, transparent)' }} />
              <div className="absolute inset-y-0 right-0 w-28 z-20 pointer-events-none rounded-r"
                style={{ background: 'linear-gradient(to left, #08090d, transparent)' }} />

              <div ref={reelRef} className="overflow-hidden mx-auto"
                style={{
                  width: `${containerW}px`, maxWidth: '100%',
                  border: '1px solid #1a1f2a',
                  boxShadow: spinning ? '0 0 40px #f59e0b18 inset' : 'none',
                  transition: 'box-shadow 0.4s',
                }}>
                <div ref={trackRef} className="flex"
                  style={{ willChange: 'transform', gap: `${ITEM_GAP}px`, padding: `${ITEM_GAP}px` }}>
                  {displayReel.map((item, i) => (
                    <ReelItem key={i} item={item}
                      highlight={reel.length > 0 && i === WINNER && showResult} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Green open button */}
          <div className="flex flex-col items-center gap-2 px-4 py-4">
            <button onClick={openBox} disabled={spinning || isLocked}
              className="relative group overflow-hidden flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest rounded-sm select-none transition-all disabled:cursor-not-allowed"
              style={{
                minWidth: '260px', paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '0.875rem', paddingBottom: '0.875rem',
                background: spinning || isLocked
                  ? 'linear-gradient(135deg, #1a1f2a, #141820)'
                  : 'linear-gradient(135deg, #16a34a 0%, #15803d 40%, #16a34a 100%)',
                color: spinning || isLocked ? '#374151' : '#fff',
                boxShadow: spinning || isLocked
                  ? '0 4px 0 #0a0c10'
                  : '0 0 30px #16a34a44, 0 4px 0 #14532d, inset 0 1px 0 #22c55e55',
              }}>
              {!spinning && !isLocked && (
                <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover:translate-x-[200%] bg-white/20 transition-transform duration-700 ease-in-out pointer-events-none" />
              )}
              <i className={`fas text-lg ${spinning ? 'fa-spinner fa-spin' : isLocked ? (isPaused ? 'fa-pause' : isSoldOut ? 'fa-box' : 'fa-clock') : 'fa-box-open'}`} />
              <span>
                {spinning ? 'กำลังสุ่ม...'
                  : isPaused  ? 'หยุดจำหน่ายชั่วคราว'
                  : isSoldOut ? 'กล่องหมดแล้ว'
                  : isExpired ? 'หมดเวลาแล้ว'
                  : <>เปิดกล่อง &mdash; ฿{parseFloat(String(box.price)).toLocaleString()}</>
                }
              </span>
            </button>
            {!user && !isLocked && (
              <p className="text-gray-700 text-xs">กรุณาเข้าสู่ระบบเพื่อเปิดกล่อง</p>
            )}
          </div>
        </div>

        {/* ── Items in box — scrollable card ──────────────────────── */}
        <div className="rounded-xl overflow-hidden border border-white/5 shadow-[0_4px_0_rgba(0,0,0,0.4)] flex flex-col"
          style={{ background: '#0d1017' }}>
          <div className="px-4 py-2.5 border-b flex items-center gap-2 flex-shrink-0" style={{ borderColor: '#1a1f2a' }}>
            <div className="w-5 h-5 rounded-sm flex items-center justify-center bg-gray-800">
              <i className="fas fa-layer-group text-gray-400 text-[9px]" />
            </div>
            <span className="text-gray-200 font-bold text-sm">ไอเท็มในกล่องนี้</span>
            <span className="text-gray-600 text-xs">({box.items.length} ชิ้น)</span>
          </div>
          <div className="overflow-y-auto p-3" style={{ maxHeight: '32vh', scrollbarWidth: 'thin', scrollbarColor: '#1f2937 transparent' }}>
            {(() => {
              const order = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
              const sorted = [...box.items].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {sorted.map(item => {
                    const r = rc(item.rarity);
                    const chance = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(2) : '0';
                    return (
                      <div key={item.id}
                        className="relative flex flex-col items-center text-center overflow-hidden rounded-lg"
                        style={{ background: r.bg, border: `1px solid ${r.stripe}44`, borderTopWidth: '3px', borderTopColor: r.stripe }}>
                        {/* chance badge top-right */}
                        <div className="absolute top-1.5 right-1.5 tabular-nums text-[10px] font-black px-1.5 py-0.5 rounded-sm"
                          style={{ background: r.color + '33', color: r.color }}>
                          {chance}%
                        </div>
                        {/* image */}
                        <div className="pt-5 pb-1.5 px-3 flex items-center justify-center" style={{ minHeight: '88px' }}>
                          {item.image
                            ? <img src={item.image} alt={item.name} className="w-16 h-16 object-contain"
                                style={{ filter: `drop-shadow(0 0 8px ${r.color}66)` }} />
                            : <i className="fas fa-cube text-4xl" style={{ color: r.color }} />
                          }
                        </div>
                        {/* name + rarity badge */}
                        <div className="w-full px-2 pb-2.5">
                          <p className="text-gray-200 text-[11px] font-semibold leading-tight line-clamp-2 mb-1.5">{item.name}</p>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full text-white uppercase"
                            style={{ background: r.color }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            {r.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

      </div>

      {/* ── Result Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showResult && wonItem && (() => {
          const r = rc(wonItem.rarity);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div className="absolute inset-0 bg-black/90 backdrop-blur-md"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowResult(false)} />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-96 h-96 rounded-full opacity-20 blur-[80px]" style={{ background: r.color }} />
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="relative z-10 w-full max-w-sm overflow-hidden"
                style={{
                  borderTop: `3px solid ${r.stripe}`,
                  border: `1px solid ${r.color}33`,
                  borderTopWidth: '3px',
                  background: `linear-gradient(180deg, ${r.bg} 0%, #0d0f14 100%)`,
                  boxShadow: `0 0 80px ${r.color}33, 0 0 160px ${r.color}18, 0 20px 60px rgba(0,0,0,0.7)`,
                }}>
                <div className="p-6 text-center">
                  <span className={`inline-block text-xs font-black px-4 py-1 rounded-sm text-white uppercase tracking-widest mb-4 ${r.badge}`}>{r.label}</span>
                  <div className="relative inline-flex items-center justify-center mb-4">
                    <div className="absolute w-40 h-40 rounded-full opacity-30 animate-ping"
                      style={{ background: r.color, animationDuration: '2s', animationTimingFunction: 'ease-out' }} />
                    <div className="absolute w-32 h-32 rounded-full opacity-20"
                      style={{ background: `radial-gradient(circle, ${r.color}, transparent)`, filter: 'blur(16px)' }} />
                    {wonItem.image
                      ? <img src={wonItem.image} alt={wonItem.name}
                          className="relative w-36 h-36 object-contain drop-shadow-2xl z-10"
                          style={{ filter: `drop-shadow(0 0 28px ${r.color}) drop-shadow(0 0 8px ${r.color})` }} />
                      : <div className="relative w-36 h-36 flex items-center justify-center rounded-sm z-10"
                          style={{ background: `${r.color}18`, border: `1px solid ${r.color}44` }}>
                          <i className="fas fa-cube text-6xl" style={{ color: r.color }} />
                        </div>
                    }
                  </div>
                  <h3 className="text-white font-black text-xl mb-1">{wonItem.name}</h3>
                  {wonItem.description && <p className="text-gray-500 text-sm mb-2">{wonItem.description}</p>}
                  <div className="space-y-2 mt-5">
                    <button onClick={() => { setShowResult(false); openBox(); }}
                      disabled={spinning || isLocked}
                      className="w-full py-3 font-black text-sm uppercase tracking-widest rounded-sm transition-all"
                      style={{
                        background: isLocked ? '#1a1f2a' : 'linear-gradient(135deg, #16a34a, #15803d)',
                        color: isLocked ? '#374151' : '#fff',
                        boxShadow: isLocked ? 'none' : '0 4px 0 #14532d',
                      }}>
                      <i className="fas fa-redo text-sm mr-2" />เปิดอีกครั้ง
                    </button>
                    <button onClick={() => setShowResult(false)}
                      className="w-full py-2.5 font-bold text-sm rounded-sm text-gray-400 transition-colors"
                      style={{ background: '#141820', border: '1px solid #1f2937' }}>
                      ปิด
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </MainLayout>
  );
}
