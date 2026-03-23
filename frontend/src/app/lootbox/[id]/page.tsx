'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface LootBoxItem {
  id: number;
  name: string;
  description?: string;
  image?: string;
  weight: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  color?: string;
}

interface LootBox {
  id: number;
  name: string;
  description?: string;
  image?: string;
  price: number;
  original_price?: number | null;
  items: LootBoxItem[];
  stock_limit?: number | null;
  sale_start?: string | null;
  sale_end?: string | null;
  sold_count?: number;
  is_paused?: boolean;
  sale_remaining_seconds?: number | null;
}

interface WonItem {
  id: number;
  name: string;
  image?: string | null;
  rarity: string;
  color?: string | null;
  description?: string | null;
}

const RARITY_CONFIG: Record<string, { label: string; color: string; glow: string; bg: string }> = {
  mythic:    { label: 'Mythic',    color: '#dc2626', glow: '0 0 30px #dc2626aa', bg: 'from-red-900/60 to-red-600/20' },
  legendary: { label: 'Legendary', color: '#FFD700', glow: '0 0 30px #FFD700aa', bg: 'from-yellow-900/60 to-yellow-600/20' },
  epic:      { label: 'Epic',      color: '#9B59B6', glow: '0 0 30px #9B59B6aa', bg: 'from-purple-900/60 to-purple-600/20' },
  rare:      { label: 'Rare',      color: '#3498DB', glow: '0 0 30px #3498DBaa', bg: 'from-blue-900/60 to-blue-600/20' },
  uncommon:  { label: 'Uncommon',  color: '#2ECC71', glow: '0 0 30px #2ECC71aa', bg: 'from-green-900/60 to-green-600/20' },
  common:    { label: 'Common',    color: '#95A5A6', glow: '0 0 30px #95A5A6aa', bg: 'from-gray-800/60 to-gray-600/20' },
};

const ITEM_WIDTH = 168;
const VISIBLE_COUNT = 7;
const WINNER_INDEX = 44;
const TOTAL_ITEMS = 50;
const GRACE_MINUTES = 5;

function buildReel(items: LootBoxItem[], winner: WonItem): LootBoxItem[] {
  const reel: LootBoxItem[] = [];
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    if (i === WINNER_INDEX) {
      const found = items.find(it => it.id === winner.id) || items[0];
      reel.push({ ...found, id: winner.id });
    } else {
      reel.push(items[Math.floor(Math.random() * items.length)]);
    }
  }
  return reel;
}

function playTick(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 1200;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.04);
}

/* ── Live Countdown ── */
function useLiveSecs(targetMs: number | null) {
  const calc = () => (targetMs != null ? Math.max(0, Math.floor((targetMs - Date.now()) / 1000)) : 0);
  const [secs, setSecs] = useState(calc);
  useEffect(() => {
    if (!targetMs) return;
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  return secs;
}

function fmtCountdown(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}ว ${h}ช ${m}น`;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function LootBoxOpenPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [box, setBox] = useState<LootBox | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState<LootBoxItem[]>([]);
  const [translateX, setTranslateX] = useState(0);
  const [wonItem, setWonItem] = useState<WonItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState('');

  const reelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTickXRef = useRef<number>(0);

  useEffect(() => {
    api(`/shop/lootboxes/${id}`)
      .then(d => setBox(d.box as LootBox))
      .catch(() => router.push('/lootbox'))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Derived sale state ── */
  const saleEndMs    = box?.sale_end ? new Date(box.sale_end).getTime() : null;
  const graceEndMs   = saleEndMs ? saleEndMs + GRACE_MINUTES * 60 * 1000 : null;
  const remaining    = box?.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
  const isSoldOut    = remaining !== null && remaining <= 0;
  const isUnlimited  = !!box?.sale_start && !box?.sale_end; // active sale, no time limit

  const saleSecsLeft  = useLiveSecs(saleEndMs);
  const graceSecsLeft = useLiveSecs(graceEndMs);

  const isPaused   = !!box?.is_paused;
  const isExpired  = !isPaused && saleEndMs !== null && saleSecsLeft <= 0;
  const isActive   = !isPaused && saleEndMs !== null && !isExpired;
  const inGrace    = isExpired && graceSecsLeft > 0;
  const isLocked   = isSoldOut || isExpired || isPaused;

  const stockPct = (box?.stock_limit && box.stock_limit > 0)
    ? Math.round(((box.stock_limit - (box?.sold_count ?? 0)) / box.stock_limit) * 100)
    : 100;

  /* ── Auto-redirect after grace period ── */
  useEffect(() => {
    if (!graceEndMs) return;
    const delay = graceEndMs - Date.now();
    if (delay <= 0) { router.push('/lootbox'); return; }
    const t = setTimeout(() => router.push('/lootbox'), delay);
    return () => clearTimeout(t);
  }, [graceEndMs]);

  const watchTicks = useCallback((trackEl: HTMLDivElement, centerX: number) => {
    const items = trackEl.querySelectorAll<HTMLDivElement>('[data-item]');
    items.forEach(el => {
      const rect = el.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      if (itemCenterX < centerX && lastTickXRef.current > 0 && el.dataset.ticked !== '1') {
        el.dataset.ticked = '1';
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        playTick(audioCtxRef.current);
      }
    });
  }, []);

  const openBox = async () => {
    if (!user) { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!box || spinning || isLocked) return;
    setError('');
    setSpinning(true);
    setWonItem(null);
    setShowResult(false);
    lastTickXRef.current = 0;
    if (trackRef.current) {
      trackRef.current.querySelectorAll<HTMLDivElement>('[data-item]').forEach(el => { el.dataset.ticked = ''; });
    }

    let result: { inventoryId: number; wonItem: WonItem } | null = null;
    try {
      const d = await api(`/shop/lootboxes/${id}/open`, { method: 'POST', token: getToken()! });
      result = d as unknown as { inventoryId: number; wonItem: WonItem };
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
      setSpinning(false);
      return;
    }
    if (!result) return;

    const won = result.wonItem;
    setWonItem(won);
    refresh();
    /* update local sold_count optimistically */
    setBox(prev => prev ? { ...prev, sold_count: (prev.sold_count ?? 0) + 1 } : prev);

    const reelItems = buildReel(box.items, won);
    setReel(reelItems);
    setTranslateX(0);
    await new Promise(r => setTimeout(r, 50));
    if (!reelRef.current) { setSpinning(false); return; }

    const containerCenterX = reelRef.current.offsetWidth / 2;
    const winnerCenterX = WINNER_INDEX * ITEM_WIDTH + 88;
    const offset = (Math.random() - 0.5) * 40;
    const finalTranslate = -(winnerCenterX - containerCenterX + offset);
    const duration = 6500;
    const startTime = performance.now();
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
    const reelEl = reelRef.current;
    const trackEl = trackRef.current;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentX = (finalTranslate) * easeOutQuint(progress);
      setTranslateX(currentX);
      if (trackEl && reelEl) {
        const reelRect = reelEl.getBoundingClientRect();
        const centerX = reelRect.left + reelRect.width / 2;
        lastTickXRef.current = centerX;
        watchTicks(trackEl, centerX);
      }
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setShowResult(true);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <i className="fas fa-spinner fa-spin text-3xl text-gray-300" />
        </div>
      </MainLayout>
    );
  }

  if (!box) return null;

  const rarityConfig = RARITY_CONFIG;
  const containerWidth = VISIBLE_COUNT * ITEM_WIDTH;

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Back link */}
        <Link href="/lootbox" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-xs font-bold transition-colors">
          <i className="fas fa-arrow-left text-[10px]" /> กลับกล่องสุ่มทั้งหมด
        </Link>

        {/* ── Hero header card (dark theme) ── */}
        <div className="rounded-2xl overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.3),0_2px_20px_rgba(0,0,0,0.15)]">

          {/* Top bar: image + name + price */}
          <div className="bg-[#1a1a2e] px-5 py-4 flex items-center gap-4">
            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
              {box.image ? (
                <img src={box.image} alt={box.name} className="w-16 h-16 object-contain drop-shadow-xl" />
              ) : (
                <i className="fas fa-box text-4xl text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-black text-xl leading-tight">{box.name}</h1>
              {box.description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{box.description}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {box.original_price && box.original_price > box.price && (
                  <>
                    <span className="text-gray-500 text-sm line-through tabular-nums">
                      {parseFloat(String(box.original_price)).toLocaleString()}฿
                    </span>
                    <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                      -{Math.round((1 - box.price / box.original_price) * 100)}%
                    </span>
                  </>
                )}
                <span className="text-amber-400 font-black text-xl tabular-nums leading-none">
                  {parseFloat(String(box.price)).toLocaleString()}
                  <span className="text-sm ml-0.5">฿</span>
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">items</p>
              <p className="text-gray-300 font-black text-xl">{box.items.length}</p>
            </div>
          </div>

          {/* ── Sale info strip ── */}
          {(isActive || isUnlimited || isSoldOut || isExpired || isPaused) && (
            <div className={`px-5 py-3 flex flex-col gap-2 ${
              isPaused   ? 'bg-orange-950/70 border-t border-orange-900/50' :
              isSoldOut  ? 'bg-red-950/80 border-t border-red-900/50' :
              isExpired  ? 'bg-gray-900/90 border-t border-gray-700/50' :
              'bg-[#0f1623] border-t border-amber-900/30'
            }`}>

              {/* Status badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                {isPaused && (
                  <span className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-[0_2px_0_#c2410c]">
                    <i className="fas fa-pause text-[9px]" /> หยุดจำหน่ายชั่วคราว
                  </span>
                )}
                {isSoldOut && !isPaused && (
                  <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-[0_2px_0_#7f1d1d]">
                    <i className="fas fa-box text-[9px]" /> กล่องหมดแล้ว
                  </span>
                )}
                {isExpired && !isSoldOut && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-600 text-white text-[11px] font-black px-3 py-1 rounded-full">
                    <i className="fas fa-clock text-[9px]" /> หมดเวลาแล้ว
                  </span>
                )}
                {(isActive || isUnlimited) && !isSoldOut && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[11px] font-black px-3 py-1 rounded-full">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                    </span>
                    กำลังขายอยู่
                  </span>
                )}

                {/* Countdown badge (timed sale) */}
                {isActive && saleSecsLeft > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <i className="fas fa-clock text-amber-500 text-[11px]" />
                    <span className="text-gray-400 text-[11px] font-bold">เวลาเหลือ</span>
                    <span className="bg-amber-500 text-white text-[13px] font-black tabular-nums px-2.5 py-0.5 rounded-lg shadow-[0_2px_0_#b45309] min-w-[60px] text-center">
                      {fmtCountdown(saleSecsLeft)}
                    </span>
                  </div>
                )}

                {/* Unlimited badge */}
                {isUnlimited && !isSoldOut && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <i className="fas fa-infinity text-green-400 text-[11px]" />
                    <span className="text-green-400 text-[11px] font-bold">ไม่จำกัดเวลา</span>
                  </div>
                )}

                {/* Grace period countdown */}
                {inGrace && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <i className="fas fa-hourglass-end text-gray-400 text-[11px]" />
                    <span className="text-gray-500 text-[11px]">ปิดหน้านี้ใน</span>
                    <span className="bg-gray-700 text-gray-300 text-[13px] font-black tabular-nums px-2 py-0.5 rounded-md min-w-[48px] text-center">
                      {fmtCountdown(graceSecsLeft)}
                    </span>
                  </div>
                )}
              </div>

              {/* Stock row */}
              {box.stock_limit != null && box.stock_limit > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <i className={`fas fa-box text-[11px] ${isSoldOut ? 'text-red-400' : stockPct <= 20 ? 'text-orange-400' : 'text-green-400'}`} />
                      <span className="text-gray-300 text-[12px] font-bold">
                        {isSoldOut
                          ? 'หมดแล้ว — รอรอบถัดไป'
                          : `เหลือ ${remaining!.toLocaleString()} กล่อง`}
                      </span>
                    </div>
                    <span className="text-gray-500 text-[11px] font-bold tabular-nums">
                      {(box.sold_count ?? 0).toLocaleString()} / {box.stock_limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSoldOut ? 'bg-red-500' : stockPct <= 20 ? 'bg-orange-400' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.max(0, stockPct)}%`, boxShadow: isSoldOut ? '0 0 8px #ef444480' : stockPct <= 20 ? '0 0 8px #fb923c80' : '0 0 8px #22c55e80' }}
                    />
                  </div>
                </div>
              )}

              {/* Opens count (no stock limit) */}
              {box.stock_limit == null && (box.sold_count ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <i className="fas fa-fire text-amber-500 text-[11px]" />
                  <span className="text-gray-400 text-[12px] font-bold">
                    เปิดไปแล้ว <span className="text-amber-400 font-black">{(box.sold_count ?? 0).toLocaleString()}</span> ครั้ง
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Opens count strip (no sale configured at all) */}
          {!isActive && !isUnlimited && !isSoldOut && !isExpired && (box.sold_count ?? 0) > 0 && (
            <div className="bg-[#0f1623] border-t border-gray-800/50 px-5 py-2.5 flex items-center gap-1.5">
              <i className="fas fa-fire text-amber-500 text-[11px]" />
              <span className="text-gray-400 text-[12px] font-bold">
                เปิดไปแล้ว <span className="text-amber-400 font-black">{(box.sold_count ?? 0).toLocaleString()}</span> ครั้ง
              </span>
            </div>
          )}
        </div>

        {/* ── Main card (reel) ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          <div className="p-4">

            {/* ── Locked banners ── */}
            {isSoldOut && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-box text-red-500 text-sm" />
                </div>
                <div>
                  <p className="text-red-700 font-black text-sm">กล่องสุ่มนี้หมดแล้ว</p>
                  <p className="text-red-400 text-xs mt-0.5">สต็อคหมด — กรุณารอรอบถัดไป</p>
                </div>
              </div>
            )}
            {isExpired && !isSoldOut && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-clock text-gray-400 text-sm" />
                </div>
                <div>
                  <p className="text-gray-700 font-black text-sm">หมดเวลาขายแล้ว</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {inGrace
                      ? `หน้านี้จะถูกปิดอัตโนมัติใน ${fmtCountdown(graceSecsLeft)}`
                      : 'การขายสิ้นสุดแล้ว'}
                  </p>
                </div>
              </div>
            )}

            {/* Reel */}
            <div className="relative mb-4">
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px z-30 pointer-events-none flex flex-col">
                <div className="w-0.5 h-2 bg-amber-400 mx-auto" />
                <div className="w-0.5 flex-1 bg-amber-400/80 mx-auto" />
                <div className="w-0.5 h-2 bg-amber-400 mx-auto" />
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-amber-400" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[12px] border-l-transparent border-r-transparent border-b-amber-400" />
              <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-gray-900 to-transparent z-20 pointer-events-none rounded-l-2xl" />
              <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-gray-900 to-transparent z-20 pointer-events-none rounded-r-2xl" />
              <div
                ref={reelRef}
                className="rounded-2xl border border-gray-700 bg-gray-900 shadow-lg"
                style={{ width: `${containerWidth}px`, maxWidth: '100%', margin: '0 auto', overflowX: reel.length > 0 ? 'hidden' : 'auto', overflowY: 'hidden' }}
              >
                <div ref={trackRef} className="flex items-center" style={{ transform: `translateX(${translateX}px)`, willChange: 'transform', transition: 'none', gap: '8px', padding: '8px' }}>
                  {reel.length > 0
                    ? reel.map((item, i) => {
                        const rc = rarityConfig[item.rarity] || rarityConfig.common;
                        return (
                          <div key={i} data-item="1" data-ticked="" className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border"
                            style={{ width: `${ITEM_WIDTH - 8}px`, height: '140px', borderColor: rc.color + '44', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', boxShadow: i === WINNER_INDEX && showResult ? rc.glow : undefined }}>
                            {item.image
                              ? <img src={item.image} alt={item.name} className="w-16 h-16 object-contain mb-1 drop-shadow-lg" />
                              : <i className="fas fa-cube text-3xl mb-2" style={{ color: rc.color }} />}
                            <p className="text-xs text-center text-gray-300 font-medium px-1 leading-tight line-clamp-2">{item.name}</p>
                            <div className="mt-1 text-xs font-bold px-2 py-0.5 rounded" style={{ color: rc.color, backgroundColor: rc.color + '22' }}>{rc.label}</div>
                          </div>
                        );
                      })
                    : box.items.map((item, i) => {
                        const rc = rarityConfig[item.rarity] || rarityConfig.common;
                        return (
                          <div key={i} className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border"
                            style={{ width: `${ITEM_WIDTH - 8}px`, height: '140px', borderColor: rc.color + '55', background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}>
                            {item.image
                              ? <img src={item.image} alt={item.name} className="w-16 h-16 object-contain mb-1 drop-shadow-lg" style={{ filter: `drop-shadow(0 0 6px ${rc.color}88)` }} />
                              : <i className="fas fa-cube text-3xl mb-2" style={{ color: rc.color }} />}
                            <p className="text-xs text-center text-gray-300 font-medium px-1 leading-tight line-clamp-2">{item.name}</p>
                            <div className="mt-1 text-xs font-bold px-2 py-0.5 rounded" style={{ color: rc.color, backgroundColor: rc.color + '22' }}>{rc.label}</div>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 text-center">
                <i className="fas fa-exclamation-triangle mr-2" />{error}
              </div>
            )}

            {/* Open button */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={openBox}
                disabled={spinning || isLocked}
                className={`flex items-center justify-center gap-2.5 px-10 py-4 rounded-xl font-black text-base transition-all ${
                  isLocked
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : spinning
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-500 text-white shadow-[0_4px_0_#b45309] hover:shadow-[0_2px_0_#b45309] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'
                }`}
              >
                {spinning ? (
                  <><i className="fas fa-spinner fa-spin" /> กำลังสุ่ม...</>
                ) : isPaused ? (
                  <><i className="fas fa-pause" /> หยุดจำหน่ายชั่วคราว</>
                ) : isSoldOut ? (
                  <><i className="fas fa-box" /> กล่องหมดแล้ว</>
                ) : isExpired ? (
                  <><i className="fas fa-clock" /> หมดเวลาแล้ว</>
                ) : (
                  <><i className="fas fa-box-open" /> เปิดกล่อง — <span className="tabular-nums">฿{parseFloat(String(box.price)).toLocaleString()}</span></>
                )}
              </button>
              {!user && !isLocked && (
                <p className="text-gray-400 text-xs">กรุณาเข้าสู่ระบบเพื่อเปิดกล่อง</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Items in this box ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <i className="fas fa-layer-group text-gray-400 text-xs" />
            <span className="text-gray-700 font-bold text-sm">ไอเท็มในกล่องนี้</span>
            <span className="text-gray-400 text-xs">({box.items.length} ชิ้น)</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {box.items.map(item => {
                const rc = rarityConfig[item.rarity] || rarityConfig.common;
                const totalWeight = box.items.reduce((s, it) => s + it.weight, 0);
                const chance = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(2) : '0';
                return (
                  <div key={item.id} className="group relative rounded-xl p-2 text-center border bg-white transition-all hover:scale-105 hover:shadow-md" style={{ borderColor: rc.color + '44' }}>
                    <div className="absolute top-1 right-1 text-[9px] font-bold tabular-nums" style={{ color: rc.color }}>{chance}%</div>
                    {item.image
                      ? <img src={item.image} alt={item.name} className="w-12 h-12 object-contain mx-auto mb-1" />
                      : <i className="fas fa-cube text-2xl mb-2 block" style={{ color: rc.color }} />}
                    <p className="text-gray-700 text-xs font-medium leading-tight line-clamp-2">{item.name}</p>
                    <div className="mt-1 text-[10px] px-1.5 py-px rounded font-bold inline-block" style={{ color: rc.color, backgroundColor: rc.color + '15' }}>{rc.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Result Modal ── */}
      <AnimatePresence>
        {showResult && wonItem && (() => {
          const rc = rarityConfig[wonItem.rarity] || rarityConfig.common;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowResult(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="relative z-10 rounded-2xl p-1 max-w-sm w-full"
                style={{ background: `linear-gradient(135deg, ${rc.color}66, ${rc.color}11)`, boxShadow: rc.glow }}
              >
                <div className="bg-[#0d0d0d] rounded-xl p-6 text-center">
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: rc.color + '22', animationDuration: '1.5s' }} />
                    {wonItem.image ? (
                      <img src={wonItem.image} alt={wonItem.name} className="relative w-32 h-32 object-contain drop-shadow-2xl" style={{ filter: `drop-shadow(0 0 20px ${rc.color})` }} />
                    ) : (
                      <div className="relative w-32 h-32 flex items-center justify-center rounded-xl" style={{ backgroundColor: rc.color + '22', border: `2px solid ${rc.color}66` }}>
                        <i className="fas fa-cube text-5xl" style={{ color: rc.color }} />
                      </div>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2"
                    style={{ backgroundColor: rc.color + '22', color: rc.color, border: `1px solid ${rc.color}55` }}>
                    <i className="fas fa-star text-[10px]" /> {rc.label}
                  </div>
                  <h3 className="text-white text-xl font-black mt-1">{wonItem.name}</h3>
                  {wonItem.description && <p className="text-gray-400 text-sm mt-1">{wonItem.description}</p>}
                  <div className="mt-5 space-y-2">
                    <Link href="/inventory"
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm text-black min-h-[48px] active:scale-95 transition-transform"
                      style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.color}bb)` }}
                      onClick={() => setShowResult(false)}>
                      <i className="fas fa-box" /> ไปรับของที่คลัง
                    </Link>
                    <button onClick={() => setShowResult(false)}
                      className="w-full py-3.5 rounded-xl font-bold text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors min-h-[48px] active:scale-95">
                      <i className="fas fa-xmark mr-2" />ปิด
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
