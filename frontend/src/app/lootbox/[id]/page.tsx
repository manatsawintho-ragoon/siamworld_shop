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
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  color?: string;
}

interface LootBox {
  id: number;
  name: string;
  description?: string;
  image?: string;
  price: number;
  items: LootBoxItem[];
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

  const watchTicks = useCallback((trackEl: HTMLDivElement, centerX: number) => {
    const items = trackEl.querySelectorAll<HTMLDivElement>('[data-item]');
    items.forEach(el => {
      const rect = el.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      if (itemCenterX < centerX && lastTickXRef.current > 0 && el.dataset.ticked !== '1') {
        el.dataset.ticked = '1';
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        playTick(audioCtxRef.current);
      }
    });
  }, []);

  const openBox = async () => {
    if (!user) { setError('กรุณาเข้าสู่ระบบก่อน'); return; }
    if (!box || spinning) return;
    setError('');
    setSpinning(true);
    setWonItem(null);
    setShowResult(false);

    lastTickXRef.current = 0;
    if (trackRef.current) {
      trackRef.current.querySelectorAll<HTMLDivElement>('[data-item]').forEach(el => {
        el.dataset.ticked = '';
      });
    }

    let result: { inventoryId: number; wonItem: WonItem } | null = null;
    try {
      const d = await api(`/shop/lootboxes/${id}/open`, {
        method: 'POST',
        token: getToken()!,
      });
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
    const startX = 0;

    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

    const reelEl = reelRef.current;
    const trackEl = trackRef.current;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuint(progress);
      const currentX = startX + (finalTranslate - startX) * eased;
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
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <i className="fas fa-spinner fa-spin text-3xl text-foreground-subtle" aria-hidden="true"></i>
        </div>
      </MainLayout>
    );
  }

  if (!box) return null;

  const rarityConfig = RARITY_CONFIG;
  const containerWidth = VISIBLE_COUNT * ITEM_WIDTH;

  return (
    <MainLayout>
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Back link */}
          <Link href="/lootbox" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary text-sm mb-6 transition-colors">
            <i className="fas fa-arrow-left" aria-hidden="true"></i> กลับไปยังกล่องสุ่ม
          </Link>

          {/* Box header */}
          <div className="text-center mb-8">
            {box.image ? (
              <img src={box.image} alt={box.name} className="w-24 h-24 object-contain mx-auto mb-3 drop-shadow-2xl" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-box text-4xl text-primary/30" aria-hidden="true"></i>
              </div>
            )}
            <h1 className="text-2xl font-black text-foreground">{box.name}</h1>
            {box.description && <p className="text-foreground-muted text-sm mt-1">{box.description}</p>}
          </div>

          {/* ─── Reel ─── */}
          <div className="relative mb-6">
            {/* Center indicator */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px z-30 pointer-events-none flex flex-col">
              <div className="w-0.5 h-2 bg-yellow-400 mx-auto"></div>
              <div className="w-0.5 flex-1 bg-yellow-400/80 mx-auto"></div>
              <div className="w-0.5 h-2 bg-yellow-400 mx-auto"></div>
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 w-0 h-0
              border-l-[8px] border-r-[8px] border-t-[12px]
              border-l-transparent border-r-transparent border-t-yellow-400" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 w-0 h-0
              border-l-[8px] border-r-[8px] border-b-[12px]
              border-l-transparent border-r-transparent border-b-yellow-400" />

            {/* Fade edges */}
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-gray-900 to-transparent z-20 pointer-events-none rounded-l-2xl" />
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-gray-900 to-transparent z-20 pointer-events-none rounded-r-2xl" />

            {/* Viewport */}
            <div
              ref={reelRef}
              className="rounded-2xl border border-gray-700 bg-gray-900 shadow-lg"
              style={{
                width: `${containerWidth}px`,
                maxWidth: '100%',
                margin: '0 auto',
                overflowX: reel.length > 0 ? 'hidden' : 'auto',
                overflowY: 'hidden',
              }}
            >
              <div
                ref={trackRef}
                className="flex items-center"
                style={{
                  transform: `translateX(${translateX}px)`,
                  willChange: 'transform',
                  transition: 'none',
                  gap: '8px',
                  padding: '8px',
                }}
              >
                {reel.length > 0
                  ? reel.map((item, i) => {
                      const rc = rarityConfig[item.rarity] || rarityConfig.common;
                      return (
                        <div
                          key={i}
                          data-item="1"
                          data-ticked=""
                          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border"
                          style={{
                            width: `${ITEM_WIDTH - 8}px`,
                            height: '140px',
                            borderColor: rc.color + '44',
                            background: `linear-gradient(135deg, #1a1a2e, #16213e)`,
                            boxShadow: i === WINNER_INDEX && showResult ? rc.glow : undefined,
                          }}
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-16 h-16 object-contain mb-1 drop-shadow-lg" />
                          ) : (
                            <i className="fas fa-cube text-3xl mb-2" style={{ color: rc.color }} aria-hidden="true"></i>
                          )}
                          <p className="text-xs text-center text-gray-300 font-medium px-1 leading-tight line-clamp-2">{item.name}</p>
                          <div className="mt-1 text-xs font-bold px-2 py-0.5 rounded" style={{ color: rc.color, backgroundColor: rc.color + '22' }}>
                            {rc.label}
                          </div>
                        </div>
                      );
                    })
                  : box.items.map((item, i) => {
                      const rc = rarityConfig[item.rarity] || rarityConfig.common;
                      return (
                        <div
                          key={i}
                          className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border"
                          style={{
                            width: `${ITEM_WIDTH - 8}px`,
                            height: '140px',
                            borderColor: rc.color + '55',
                            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                          }}
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-16 h-16 object-contain mb-1 drop-shadow-lg" style={{ filter: `drop-shadow(0 0 6px ${rc.color}88)` }} />
                          ) : (
                            <i className="fas fa-cube text-3xl mb-2" style={{ color: rc.color }} aria-hidden="true"></i>
                          )}
                          <p className="text-xs text-center text-gray-300 font-medium px-1 leading-tight line-clamp-2">{item.name}</p>
                          <div className="mt-1 text-xs font-bold px-2 py-0.5 rounded" style={{ color: rc.color, backgroundColor: rc.color + '22' }}>
                            {rc.label}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>

          {/* Open button */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 text-center animate-fade-in">
              <i className="fas fa-exclamation-triangle mr-2" aria-hidden="true"></i>{error}
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={openBox}
              disabled={spinning}
              className="group relative overflow-hidden px-10 py-4 rounded-2xl font-black text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 min-h-[56px]"
              style={!spinning ? {
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                color: '#000',
              } : {
                background: '#374151',
                color: '#9CA3AF',
              }}
            >
              {spinning ? (
                <span className="flex items-center gap-2">
                  <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> กำลังสุ่ม...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <i className="fas fa-box-open" aria-hidden="true"></i>
                  เปิดกล่อง — <span className="tabular-nums">฿{parseFloat(String(box.price)).toLocaleString()}</span>
                </span>
              )}
            </button>
            {!user && (
              <p className="text-gray-500 text-sm">กรุณา<button className="text-primary font-bold underline">เข้าสู่ระบบ</button>เพื่อเปิดกล่อง</p>
            )}
          </div>

          {/* ─── Items in this box ─── */}
          <div className="mt-12">
            <h2 className="text-foreground font-bold text-base mb-5 flex items-center gap-2">
              <i className="fas fa-list text-primary" aria-hidden="true"></i>ไอเท็มในกล่องนี้
              <span className="text-foreground-muted font-normal text-sm tabular-nums">({box.items.length} ชิ้น)</span>
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {box.items.map(item => {
                const rc = rarityConfig[item.rarity] || rarityConfig.common;
                const totalWeight = box.items.reduce((s, it) => s + it.weight, 0);
                const chance = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(2) : '0';
                return (
                  <div
                    key={item.id}
                    className="group relative rounded-xl p-2 text-center border bg-white transition-all hover:scale-105 hover:shadow-md"
                    style={{
                      borderColor: rc.color + '44',
                    }}
                  >
                    <div className="absolute top-1 right-1 text-xs font-bold tabular-nums" style={{ color: rc.color }}>
                      {chance}%
                    </div>
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-12 h-12 object-contain mx-auto mb-1" />
                    ) : (
                      <i className="fas fa-cube text-2xl mb-2 block" style={{ color: rc.color }} aria-hidden="true"></i>
                    )}
                    <p className="text-gray-700 text-xs font-medium leading-tight line-clamp-2">{item.name}</p>
                    <div className="mt-1 text-xs px-1 py-px rounded font-semibold inline-block" style={{ color: rc.color, backgroundColor: rc.color + '15' }}>
                      {rc.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Result Modal ─── */}
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
                    <div
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ backgroundColor: rc.color + '22', animationDuration: '1.5s' }}
                    />
                    {wonItem.image ? (
                      <img
                        src={wonItem.image}
                        alt={wonItem.name}
                        className="relative w-32 h-32 object-contain drop-shadow-2xl"
                        style={{ filter: `drop-shadow(0 0 20px ${rc.color})` }}
                      />
                    ) : (
                      <div className="relative w-32 h-32 flex items-center justify-center rounded-xl"
                        style={{ backgroundColor: rc.color + '22', border: `2px solid ${rc.color}66` }}>
                        <i className="fas fa-cube text-5xl" style={{ color: rc.color }} aria-hidden="true"></i>
                      </div>
                    )}
                  </div>

                  <div
                    className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2"
                    style={{ backgroundColor: rc.color + '22', color: rc.color, border: `1px solid ${rc.color}55` }}
                  >
                    <i className="fas fa-star text-[10px]" aria-hidden="true"></i> {rc.label}
                  </div>

                  <h3 className="text-white text-xl font-black mt-1">{wonItem.name}</h3>
                  {wonItem.description && (
                    <p className="text-gray-400 text-sm mt-1">{wonItem.description}</p>
                  )}

                  <div className="mt-5 space-y-2">
                    <Link
                      href="/inventory"
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm text-black min-h-[48px] active:scale-95 transition-transform"
                      style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.color}bb)` }}
                      onClick={() => setShowResult(false)}
                    >
                      <i className="fas fa-box" aria-hidden="true"></i> ไปรับของที่คลัง
                    </Link>
                    <button
                      onClick={() => setShowResult(false)}
                      className="w-full py-3.5 rounded-xl font-bold text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors min-h-[48px] active:scale-95"
                    >
                      <i className="fas fa-xmark mr-2" aria-hidden="true"></i>ปิด
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
