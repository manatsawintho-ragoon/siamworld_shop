'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import HeroCarousel from '@/components/HeroCarousel';
import ProductCard from '@/components/ProductCard';
import { useSettings } from '@/context/SettingsContext';
import { api } from '@/lib/api';
import { getRarity } from '@/lib/rarity';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

interface Product {
  id: number; name: string; description: string;
  price: number; original_price?: number;
  image_url?: string; image?: string; category_name?: string;
}
interface Server  { id: number; name: string; max_players?: number; }
interface LootBox { id: number; name: string; description?: string; image?: string; price: number; original_price?: number | null; total_opens?: number; category_name?: string; category_color?: string; stock_limit?: number | null; sale_end?: string | null; sale_start?: string | null; sold_count?: number; is_paused?: boolean; }
interface RecentPurchase {
  username: string; product_name: string; image?: string;
  price: number; created_at: string;
}
interface RecentLootbox {
  username: string; box_name: string; item_name: string;
  item_image?: string; item_rarity: string; won_at: string;
}

// Rarity config imported from shared lib — see src/lib/rarity.ts

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function SectionHeader({ icon, iconBg, iconColor, title, count, href, btnLabel, btnColor }: {
  icon: string; iconBg: string; iconColor: string;
  title: string; count?: number;
  href: string; btnLabel: string; btnColor: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <i className={`fas ${icon} ${iconColor} text-sm`} />
      </div>
      <h2 className="font-black text-gray-900 text-base leading-none">{title}</h2>
      {count !== undefined && <span className="text-gray-400 text-sm font-normal">{count} รายการ</span>}
      <Link href={href}
        className={`ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl ${btnColor} text-white text-[11px] font-bold shadow-[0_3px_0_rgba(0,0,0,0.15)] hover:shadow-[0_1px_0_rgba(0,0,0,0.15)] hover:translate-y-[1px] active:shadow-none active:translate-y-[3px] transition-all`}>
        {btnLabel} <i className="fas fa-arrow-right text-[9px]" />
      </Link>
    </div>
  );
}

/* ── White activity card shared style ─────────────────────── */
const CARD_CLS = 'bg-white rounded-2xl overflow-hidden border-2 border-green-200 shadow-[0_4px_0_#86efac,0_2px_16px_rgba(0,0,0,0.06)]';

/* ── Countdown component ─────────────────────────────────── */
function Countdown({ endTime }: { endTime: string }) {
  const calc = () => Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
  const [secs, setSecs] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [endTime]);
  if (secs <= 0) return <span className="text-red-500 font-black text-[9px]">หมดเวลา</span>;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return <span className="tabular-nums font-black text-[9px] text-amber-600">{d}ว {h}ช {m}น</span>;
  if (h > 0) return <span className="tabular-nums font-black text-[9px] text-amber-600">{h}ช {m}น {s}ว</span>;
  return <span className="tabular-nums font-black text-[9px] text-red-500">{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

/* ── Server Status Widget ───────────────────────────────────── */
function ServerStatusWidget({ serverIp, dbServers }: { serverIp?: string; dbServers: Array<{ id: number; name: string; max_players?: number }> }) {
  const { servers: wsServers, totalOnline, connected } = useOnlinePlayers();
  const [copied, setCopied] = useState(false);

  const copyIp = () => {
    if (!serverIp) return;
    navigator.clipboard.writeText(serverIp).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const serverRows = dbServers.map(srv => {
    const ws = wsServers.find(s => s.serverId === srv.id);
    const count = ws?.count ?? 0;
    const maxPlayers = srv.max_players ?? 0;
    const pct = maxPlayers > 0
      ? Math.min(Math.round((count / maxPlayers) * 100), 100)
      : 0;
    return { id: srv.id, name: srv.name, count, maxPlayers, pct, online: !!ws };
  });

  return (
    <div className="bg-white rounded-2xl overflow-hidden border-2 border-green-200 shadow-[0_4px_0_#86efac,0_2px_16px_rgba(0,0,0,0.06)]">

      {/* Header */}
      <div className="px-4 py-3 bg-[#1e2735] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
          <i className="fas fa-server text-green-400 text-[11px]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-xs leading-none tracking-wide">SERVER STATUS</p>
          <p className="text-gray-400 text-[9px] mt-0.5">สถานะเซิร์ฟเวอร์</p>
        </div>
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      </div>

      <div className="p-3 space-y-2.5">

        {/* IP Copy */}
        {serverIp && (
          <button onClick={copyIp}
            className="w-full flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/60 transition-all group text-left">
            <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-network-wired text-green-600 text-[9px]" />
            </div>
            <span className="flex-1 font-mono text-[11px] font-bold text-gray-800 truncate">{serverIp}</span>
            <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md flex-shrink-0 transition-all ${
              copied
                ? 'bg-green-500 text-white shadow-[0_2px_0_#15803d]'
                : 'bg-white border border-gray-200 text-gray-400 group-hover:border-green-300 group-hover:text-green-600 shadow-[0_2px_0_#e5e7eb]'
            }`}>
              <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-[8px]`} />
              {copied ? 'Copied!' : 'คัดลอก'}
            </div>
          </button>
        )}

        {/* Total Online */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
          <span className="relative flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-green-600 font-black uppercase tracking-wider leading-none">กำลังออนไลน์</p>
            <p className="text-green-700 font-black text-2xl tabular-nums leading-tight mt-0.5">
              {totalOnline}
              <span className="text-sm font-bold text-green-600/70 ml-1">คน</span>
            </p>
          </div>
          <i className="fas fa-users text-green-200 text-2xl flex-shrink-0" />
        </div>

        {/* Per-server rows */}
        <div className="space-y-1.5">
          {!connected ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <i className="fas fa-spinner fa-spin text-gray-300 text-sm" />
              <span className="text-gray-300 text-[11px]">กำลังเชื่อมต่อ...</span>
            </div>
          ) : dbServers.length === 0 ? (
            <p className="text-gray-300 text-[11px] text-center py-3">ไม่มีเซิร์ฟเวอร์</p>
          ) : serverRows.map(srv => (
            <div key={srv.id} className="px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
              {/* Row 1: dot + name + count */}
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${srv.online ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-[11px] font-bold text-gray-700 truncate flex-1 min-w-0">{srv.name}</span>
                {srv.online ? (
                  <span className="text-[11px] font-black tabular-nums flex-shrink-0 text-green-600">
                    {srv.count}
                    {srv.maxPlayers > 0 && (
                      <span className="text-gray-300 font-normal">/{srv.maxPlayers}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-red-400 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                    <i className="fas fa-circle-xmark text-[8px]" /> offline
                  </span>
                )}
              </div>
              {/* Row 2: progress bar (only when online + maxPlayers known) */}
              {srv.online && srv.maxPlayers > 0 && (
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      srv.pct >= 80 ? 'bg-red-400' : srv.pct >= 50 ? 'bg-amber-400' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.max(srv.pct, srv.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default function HomePage() {
  const [slides,    setSlides]    = useState([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [servers,   setServers]   = useState<Server[]>([]);
  const [lootboxes, setLootboxes] = useState<LootBox[]>([]);
  const [recentBuy, setRecentBuy] = useState<RecentPurchase[]>([]);
  const [recentBox, setRecentBox] = useState<RecentLootbox[]>([]);
  const { settings } = useSettings();

  useEffect(() => {
    Promise.all([
      api('/public/slides').then(d => setSlides((d.slides as never[]) || [])).catch(() => {}),
      api('/public/products').then(d => setProducts((d.products as Product[]) || [])).catch(() => {}),
      api('/public/servers').then(d => setServers((d.servers as Server[]) || [])).catch(() => {}),
      api('/shop/lootboxes').then(d => setLootboxes((d.boxes as LootBox[]) || [])).catch(() => {}),
      api('/public/recent-purchases').then(d => setRecentBuy((d.purchases as RecentPurchase[]) || [])).catch(() => {}),
      api('/public/recent-lootbox').then(d => setRecentBox((d.openings as RecentLootbox[]) || [])).catch(() => {}),
    ]);
  }, []);

  const featured = [
    ...products.filter(p => p.original_price && p.original_price > p.price),
    ...products.filter(p => !(p.original_price && p.original_price > p.price)).sort((a, b) => b.id - a.id),
  ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, 12);

  return (
    <MainLayout>

      {/* ── Broadcast ─────────────────────────────────────────── */}
      {settings.welcome_message && (
        <div className="flex items-stretch overflow-hidden rounded-2xl mb-4 bg-white border-2 border-green-200 shadow-[0_4px_0_#86efac,0_2px_16px_rgba(0,0,0,0.06)]">
          <div className="bg-green-600 px-5 flex items-center gap-2.5 flex-shrink-0">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <i className="fas fa-bullhorn text-white text-sm" />
            <span className="text-white text-[11px] font-black uppercase tracking-[0.2em] hidden sm:inline">LIVE</span>
          </div>
          <div className="flex-1 overflow-hidden py-3">
            <div className="marquee-track">
              <span className="text-green-500 text-base px-6 select-none">✦</span>
              <span className="text-green-800 text-sm font-bold px-8">{settings.welcome_message}</span>
              <span className="text-green-500 text-base px-6 select-none">✦</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero row: Carousel + Activity (right) ────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 mb-5">

        {/* ── Left: Carousel ─── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Carousel */}
          <div className="rounded-2xl overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.12),0_2px_20px_rgba(0,0,0,0.08)]">
            <div className="w-full h-[220px] bg-gray-800">
              {slides.length > 0 ? (
                <HeroCarousel slides={slides} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-900 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #22c55e 0%, transparent 60%)' }} />
                  <div className="relative z-10 text-center logo-float">
                    <div className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] mb-2">
                      {settings.shop_name || 'SiamWorld'}
                    </div>
                    <p className="text-green-400 font-bold text-sm tracking-widest uppercase">
                      {settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GACHA boxes */}
          <div className="bg-white rounded-2xl overflow-hidden border-2 border-green-200 shadow-[0_4px_0_#86efac,0_2px_16px_rgba(0,0,0,0.06)]">
            <div className="px-4 py-3 border-b border-green-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-box-open text-amber-500 text-sm" />
              </div>
              <h2 className="font-black text-gray-900 text-sm leading-none">GACHA กล่องสุ่ม ยอดนิยม!! 🔥</h2>
              {lootboxes.length > 0 && <span className="text-gray-400 text-xs">{lootboxes.length} กล่อง</span>}
              <Link href="/lootbox"
                className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3498DB] text-white text-[11px] font-bold shadow-[0_3px_0_#1a6da5] hover:shadow-[0_1px_0_#1a6da5] hover:translate-y-[1px] active:shadow-none active:translate-y-[3px] transition-all">
                ดูกล่องสุ่มทั้งหมด <i className="fas fa-arrow-right text-[9px]" />
              </Link>
            </div>
            <div className="p-3">
              {lootboxes.length === 0 ? (
                <p className="text-gray-300 text-xs text-center py-6">ยังไม่มีกล่องสุ่ม</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[...lootboxes].sort((a, b) => (b.total_opens ?? 0) - (a.total_opens ?? 0)).slice(0, 4).map(box => {
                    const hasPromo  = box.original_price && box.original_price > box.price;
                    const discPct   = hasPromo ? Math.round((1 - box.price / box.original_price!) * 100) : 0;
                    const isPaused    = !!box.is_paused;
                    const hasSaleEnd  = !!box.sale_end;
                    const expired     = hasSaleEnd && new Date(box.sale_end!).getTime() <= Date.now();
                    const active      = !isPaused && hasSaleEnd && !expired;
                    const unlimited   = !isPaused && !!box.sale_start && !box.sale_end;
                    const remaining = box.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
                    const soldOut   = remaining !== null && remaining <= 0;
                    const stockPct  = (box.stock_limit && box.stock_limit > 0)
                      ? Math.round(((box.stock_limit - (box.sold_count ?? 0)) / box.stock_limit) * 100)
                      : 100;
                    return (
                    <Link key={box.id} href={`/lootbox/${box.id}`}
                      className={`group relative flex flex-col bg-white border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md ${isPaused ? 'border-orange-200 opacity-80' : soldOut || expired ? 'border-gray-200 opacity-75' : 'border-gray-200 hover:border-amber-300'}`}>

                      {/* Image area */}
                      <div className="relative aspect-[3/4] bg-amber-50 overflow-hidden">

                        {/* Category badge — top left */}
                        {box.category_name && (
                          <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-700 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-gray-200/80">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: box.category_color || '#f59e0b' }} />
                            {box.category_name}
                          </span>
                        )}

                        {/* Discount badge — top right */}
                        {hasPromo && !soldOut && !isPaused && (
                          <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-lg">
                            <i className="fas fa-tag text-[9px]" />
                            -{discPct}%
                          </span>
                        )}

                        {/* Paused overlay */}
                        {isPaused && (
                          <div className="absolute inset-0 z-10 bg-black/45 flex items-center justify-center">
                            <div className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg tracking-wide">
                              <i className="fas fa-pause text-[8px] mr-1" /> หยุดจำหน่ายชั่วคราว
                            </div>
                          </div>
                        )}

                        {/* Sold out overlay */}
                        {soldOut && !isPaused && (
                          <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center">
                            <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg rotate-[-8deg]">
                              <i className="fas fa-box text-[8px] mr-1" /> หมดแล้ว
                            </div>
                          </div>
                        )}

                        {/* Expired overlay */}
                        {expired && !soldOut && !isPaused && (
                          <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center">
                            <div className="bg-gray-700 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                              <i className="fas fa-clock text-[8px] mr-1" /> หมดเวลา
                            </div>
                          </div>
                        )}

                        {/* Image */}
                        {box.image ? (
                          <img src={box.image} alt={box.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <i className="fas fa-box text-5xl text-amber-200 group-hover:text-amber-300 transition-colors" />
                          </div>
                        )}

                        {/* Bottom price overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent px-2.5 py-5 flex items-end justify-between gap-1">
                          {hasPromo ? (
                            <span className="text-white/75 text-xs font-medium line-through tabular-nums leading-none drop-shadow">
                              {parseFloat(String(box.original_price)).toLocaleString()} ฿
                            </span>
                          ) : <span />}
                          <span className="bg-amber-500 text-white text-sm font-black px-2.5 py-1 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)] tabular-nums leading-none flex-shrink-0">
                            {parseFloat(String(box.price)).toLocaleString()} ฿
                          </span>
                        </div>
                      </div>

                      {/* ── Sale info bar (countdown + stock) ── */}
                      {(isPaused || active || unlimited || (remaining !== null && box.stock_limit! > 0)) && (
                        <div className={`px-2.5 py-2 border-t ${isPaused ? 'bg-orange-50 border-orange-100' : soldOut ? 'bg-red-50 border-red-100' : expired ? 'bg-gray-50 border-gray-100' : 'bg-amber-50 border-amber-100'}`}>
                          {/* Paused row */}
                          {isPaused && (
                            <div className="flex items-center gap-1 mb-1.5">
                              <i className="fas fa-pause text-orange-500 text-[10px]" />
                              <span className="text-[10px] font-bold text-orange-600">หยุดจำหน่ายชั่วคราว</span>
                            </div>
                          )}
                          {/* Countdown row (timed) */}
                          {active && (
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1">
                                <i className="fas fa-clock text-amber-500 text-[10px]" />
                                <span className="text-[10px] font-bold text-gray-600">เวลาเหลือ</span>
                              </div>
                              <div className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums shadow-[0_2px_0_#b45309]">
                                <Countdown endTime={box.sale_end!} />
                              </div>
                            </div>
                          )}
                          {/* Unlimited badge */}
                          {unlimited && !soldOut && (
                            <div className="flex items-center gap-1 mb-1.5">
                              <i className="fas fa-infinity text-green-500 text-[10px]" />
                              <span className="text-[10px] font-bold text-green-600">ไม่จำกัดเวลา</span>
                            </div>
                          )}
                          {/* Stock row */}
                          {remaining !== null && box.stock_limit! > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1">
                                  <i className={`fas fa-box text-[9px] ${soldOut ? 'text-red-400' : stockPct <= 20 ? 'text-orange-400' : 'text-green-500'}`} />
                                  <span className="text-[10px] font-bold text-gray-600">
                                    {soldOut ? 'หมดแล้ว' : `เหลือ ${remaining.toLocaleString()} กล่อง`}
                                  </span>
                                </div>
                                <span className="text-[9px] font-bold text-gray-400 tabular-nums">
                                  {(box.sold_count ?? 0).toLocaleString()}/{box.stock_limit!.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${soldOut ? 'bg-red-400' : stockPct <= 20 ? 'bg-orange-400' : 'bg-green-400'}`}
                                  style={{ width: `${Math.max(0, stockPct)}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info below image */}
                      <div className="p-2.5 flex flex-col flex-1 gap-1">
                        <p className="text-gray-900 font-bold text-xs leading-tight line-clamp-1">{box.name}</p>
                        {box.description && (
                          <p className="text-gray-400 text-[9px] leading-snug line-clamp-1">{box.description}</p>
                        )}
                      </div>
                    </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Items (inside right column, after GACHA boxes) ── */}
          {featured.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden border-2 border-green-200 shadow-[0_4px_0_#86efac,0_2px_16px_rgba(0,0,0,0.06)]">
              <div className="px-4 py-3 border-b border-green-100">
                <SectionHeader
                  icon="fa-store" iconBg="bg-green-100" iconColor="text-green-600"
                  title="ITEMS สินค้า" count={featured.length}
                  href="/shop" btnLabel="ดูทั้งหมด" btnColor="bg-[#3498DB]"
                />
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {featured.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Right: Activity column (SERVER STATUS + GACHA LIVE + SHOP LIVE) ─── */}
        <div className="flex flex-col gap-3 lg:w-[230px] flex-shrink-0 self-start">

          {/* SERVER STATUS */}
          <ServerStatusWidget serverIp={settings.server_ip} dbServers={servers} />

          {/* GACHA LIVE */}
          <div className={CARD_CLS}>
            <div className="px-4 py-3 border-b border-green-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-box-open text-amber-500 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-black text-xs leading-none">GACHA LIVE</p>
                <p className="text-gray-400 text-[9px] mt-0.5">เปิดกล่องล่าสุด</p>
              </div>
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </div>
            <div className="px-2 py-2 space-y-0.5">
              {recentBox.length === 0 ? (
                <p className="text-gray-300 text-xs text-center py-6">ยังไม่มีข้อมูล</p>
              ) : recentBox.slice(0, 5).map((r, i) => {
                const rar = getRarity(r.item_rarity);
                return (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-green-50 transition-colors">
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 border border-gray-200 bg-gray-50 flex items-center justify-center">
                      {r.item_image
                        ? <img src={r.item_image} alt={r.item_name} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} />
                        : <i className="fas fa-gem text-gray-300 text-sm" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900 text-[11px] font-bold truncate leading-snug">{r.item_name}</p>
                      <p className="text-gray-400 text-[9px] truncate">{r.username}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md text-white leading-none"
                        style={{ backgroundColor: rar.color, boxShadow: `0 1px 0 ${rar.color}88` }}>
                        <span className="w-1 h-1 rounded-sm bg-white/60 flex-shrink-0" />
                        {rar.label}
                      </span>
                      <span className="text-gray-400 text-[8px] tabular-nums">{timeAgo(r.won_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SHOP LIVE */}
          <div className={CARD_CLS}>
            <div className="px-4 py-3 border-b border-green-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-shopping-bag text-green-600 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-black text-xs leading-none">SHOP LIVE</p>
                <p className="text-gray-400 text-[9px] mt-0.5">ซื้อไอเท็มล่าสุด</p>
              </div>
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </div>
            <div className="px-2 py-2 space-y-0.5">
              {recentBuy.length === 0 ? (
                <p className="text-gray-300 text-xs text-center py-6">ยังไม่มีข้อมูล</p>
              ) : recentBuy.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-green-50 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 border border-gray-200 bg-gray-50 flex items-center justify-center">
                    {r.image
                      ? <img src={r.image} alt={r.product_name} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} />
                      : <i className="fas fa-box text-gray-300 text-sm" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-900 text-[11px] font-bold truncate leading-snug">{r.product_name}</p>
                    <p className="text-gray-400 text-[9px] truncate">{r.username}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-md text-white leading-none"
                      style={{ backgroundColor: '#16a34a', boxShadow: '0 1px 0 #15803d88' }}>
                      <i className="fas fa-coins text-[7px]" />
                      {parseFloat(String(r.price)).toLocaleString()}
                    </div>
                    <span className="text-gray-400 text-[8px] tabular-nums">{timeAgo(r.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </MainLayout>
  );
}
