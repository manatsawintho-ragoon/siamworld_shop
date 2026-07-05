'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import HeroCarousel from '@/components/HeroCarousel';
import ProductCard from '@/components/ProductCard';
import { useSettings } from '@/context/SettingsContext';
import { api } from '@/lib/api';
import { getRarity } from '@/lib/rarity';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';
import { motion } from 'framer-motion';
import {
  ArrowRight, Server, Network, Check, Copy, Users, Loader2, XCircle,
  ChevronLeft, ChevronRight, Gem, Tag, Pause, Package, Clock,
  Infinity as InfinityIcon, PackageOpen, Megaphone, ShoppingBag, Coins,
  Flame, Star, type LucideIcon,
} from 'lucide-react';

interface Product {
  id: number; name: string; description: string;
  price: number; original_price?: number;
  image_url?: string; image?: string; category_name?: string;
  sold_count?: number;
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

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `${diff} วิ`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาที`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.`;
  return `${Math.floor(diff / 86400)} วัน`;
}

function SectionHeader({ Icon, tint, title, count, href, btnLabel }: {
  Icon: LucideIcon; tint: string;
  title: string; count?: number;
  href: string; btnLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 mb-4">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `rgb(${tint} / 0.12)` }}>
        <Icon className="w-4 h-4" strokeWidth={2.25} style={{ color: `rgb(${tint})` }} />
      </div>
      <h2 className="font-black text-foreground text-sm sm:text-base leading-tight truncate min-w-0">{title}</h2>
      {count !== undefined && <span className="hidden sm:inline text-foreground-subtle text-sm font-normal flex-shrink-0">{count} รายการ</span>}
      <Link href={href}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0">
        <span className="hidden sm:inline">{btnLabel}</span> <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

const CARD_CLS = 'theme-card';

function Countdown({ endTime }: { endTime: string }) {
  const calc = () => Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
  const [secs, setSecs] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [endTime]);
  if (secs <= 0) return <span className="text-error font-black text-[9px]">หมดเวลา</span>;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return <span className="tabular-nums font-black text-[9px] text-white">{d}ว {h}ช {m}น</span>;
  if (h > 0) return <span className="tabular-nums font-black text-[9px] text-white">{h}ช {m}น {s}ว</span>;
  return <span className="tabular-nums font-black text-[9px] text-white">{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

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
    <div className="theme-card">
      <div className="px-4 py-3 bg-surface-hover border-b border-border flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0">
          <Server className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-black text-xs leading-none tracking-wide">SERVER STATUS</p>
          <p className="text-foreground-subtle text-[9px] mt-0.5">สถานะเซิร์ฟเวอร์</p>
        </div>
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
      </div>
      <div className="p-3 space-y-2.5">
        {serverIp && (
          <button onClick={copyIp}
            className="w-full flex items-center gap-2.5 px-3 py-2 bg-surface-hover border border-border rounded-xl hover:border-primary/40 transition-all group text-left">
            <div className="w-6 h-6 rounded-md bg-primary/12 flex items-center justify-center flex-shrink-0">
              <Network className="w-3 h-3 text-primary" strokeWidth={2.25} />
            </div>
            <span className="flex-1 font-mono text-[11px] font-bold text-foreground truncate">{serverIp}</span>
            <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md flex-shrink-0 transition-all ${
              copied
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface border border-border text-foreground-subtle group-hover:border-primary/40 group-hover:text-primary'
            }`}>
              {copied ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <Copy className="w-2.5 h-2.5" strokeWidth={2.5} />}
              {copied ? 'Copied!' : 'คัดลอก'}
            </div>
          </button>
        )}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-primary/8 border border-primary/20 rounded-xl">
          <span className="relative flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-primary font-black uppercase tracking-wider leading-none">กำลังออนไลน์</p>
            <p className="text-primary font-black text-2xl tabular-nums leading-tight mt-0.5">
              {totalOnline}
              <span className="text-sm font-bold text-primary/70 ml-1">คน</span>
            </p>
          </div>
          <Users className="w-7 h-7 text-primary/25 flex-shrink-0" strokeWidth={2} />
        </div>
        <div className="space-y-1.5">
          {!connected ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-4 h-4 text-foreground-subtle animate-spin" />
              <span className="text-foreground-subtle text-[11px]">กำลังเชื่อมต่อ...</span>
            </div>
          ) : dbServers.length === 0 ? (
            <p className="text-foreground-subtle text-[11px] text-center py-3">ไม่มีเซิร์ฟเวอร์</p>
          ) : serverRows.map(srv => (
            <div key={srv.id} className="px-2.5 py-2 rounded-lg bg-surface-hover border border-border-muted space-y-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${srv.online ? 'bg-primary' : 'bg-error'}`} />
                <span className="text-[11px] font-bold text-foreground truncate flex-1 min-w-0">{srv.name}</span>
                {srv.online ? (
                  <span className="text-[11px] font-black tabular-nums flex-shrink-0 text-primary">
                    {srv.count}
                    {srv.maxPlayers > 0 && (
                      <span className="text-foreground-subtle font-normal">/{srv.maxPlayers}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-error bg-error/10 border border-error/20 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                    <XCircle className="w-2 h-2" strokeWidth={2.5} /> offline
                  </span>
                )}
              </div>
              {srv.online && srv.maxPlayers > 0 && (
                <div className="w-full h-1.5 bg-border-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      srv.pct >= 80 ? 'bg-error' : srv.pct >= 50 ? 'bg-warning' : 'bg-primary'
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

function HomeGachaCarousel({ boxes, noDrag }: { boxes: LootBox[]; noDrag?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [boxes]);

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'right' ? el.clientWidth * 0.85 : -el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragging.current = true;
    startX.current = e.clientX;
    scrollStart.current = el.scrollLeft;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = scrollStart.current - (e.clientX - startX.current);
  };
  const stopDrag = () => { dragging.current = false; };

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); stopDrag(); }}>
      <button onClick={() => scrollBy('left')} aria-label="เลื่อนซ้าย"
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-20 w-8 h-8 rounded-full bg-surface border border-border shadow-theme-md flex items-center justify-center text-foreground hover:border-primary/40 transition-opacity ${hovered && canLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ transition: 'opacity 0.15s' }}>
        <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
      </button>
      <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto pb-0.5 select-none scrollbar-hide"
        style={{ cursor: 'default' }} onMouseDown={noDrag ? undefined : onMouseDown} onMouseMove={noDrag ? undefined : onMouseMove} onMouseUp={noDrag ? undefined : stopDrag} onMouseLeave={noDrag ? undefined : stopDrag}>
        {boxes.map(box => {
          const hasPromo  = box.original_price && Number(box.original_price) > Number(box.price);
          const discPct   = hasPromo ? Math.round((1 - box.price / box.original_price!) * 100) : 0;
          const isPaused  = !!box.is_paused;
          const hasSaleEnd = !!box.sale_end;
          const expired   = hasSaleEnd && new Date(box.sale_end!).getTime() <= Date.now();
          const active    = !isPaused && hasSaleEnd && !expired;
          const unlimited = !isPaused && !!box.sale_start && !box.sale_end;
          const remaining = box.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
          const soldOut   = remaining !== null && remaining <= 0;
          const stockPct  = (box.stock_limit && box.stock_limit > 0) ? Math.round(((box.sold_count ?? 0) / box.stock_limit) * 100) : 0;
          return (
            <Link key={box.id} href={`/lootbox/${box.id}`}
              className={`group relative flex flex-col bg-surface border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-theme-md flex-shrink-0 w-[calc(50%-5px)] sm:w-[calc(25%-7.5px)] ${isPaused ? 'border-warning/40 opacity-80' : soldOut || expired ? 'border-border opacity-75' : 'border-border hover:border-primary/40'}`}>
              <div className="relative aspect-[3/4] bg-surface-hover overflow-hidden">
                {box.category_name && <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-surface/90 backdrop-blur-sm text-foreground-muted text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-border"><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: box.category_color || '#f59e0b' }} />{box.category_name}</span>}
                {hasPromo && !soldOut && !isPaused && <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-error text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-lg"><Tag className="w-2.5 h-2.5" strokeWidth={2.5} />-{discPct}%</span>}
                {isPaused && <div className="absolute inset-0 z-10 bg-black/45 flex items-center justify-center"><div className="bg-warning text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg tracking-wide flex items-center gap-1"><Pause className="w-2 h-2" strokeWidth={2.5} /> หยุดจำหน่ายชั่วคราว</div></div>}
                {soldOut && !isPaused && <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center"><div className="bg-error text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg rotate-[-8deg] flex items-center gap-1"><Package className="w-2 h-2" strokeWidth={2.5} /> หมดแล้ว</div></div>}
                {expired && !soldOut && !isPaused && <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center"><div className="bg-foreground/80 text-background text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1"><Clock className="w-2 h-2" strokeWidth={2.5} /> หมดเวลา</div></div>}
                {box.image ? <img src={box.image} alt={box.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-foreground-subtle/30" strokeWidth={1.5} /></div>}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent px-2.5 py-5 flex items-end justify-between gap-1">
                  {hasPromo ? <span className="text-white/75 text-xs font-medium line-through tabular-nums leading-none drop-shadow">{parseFloat(String(box.original_price)).toLocaleString()} ฿</span> : <span />}
                  <span className="theme-price-badge text-sm font-black px-2.5 py-1 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)] tabular-nums leading-none flex-shrink-0">{parseFloat(String(box.price)).toLocaleString()} ฿</span>
                </div>
              </div>
              {(isPaused || active || unlimited || (remaining !== null && box.stock_limit! > 0)) && (
                <div className={`px-2.5 py-2 border-t ${isPaused ? 'bg-warning/8 border-warning/20' : soldOut ? 'bg-error/8 border-error/20' : expired ? 'bg-surface-hover border-border-muted' : 'bg-warning/8 border-warning/20'}`}>
                  {isPaused && <div className="flex items-center gap-1 mb-1.5"><Pause className="w-2.5 h-2.5 text-warning" strokeWidth={2.5} /><span className="text-[10px] font-bold text-warning">หยุดจำหน่ายชั่วคราว</span></div>}
                  {active && <div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-warning" strokeWidth={2.5} /><span className="text-[10px] font-bold text-foreground-muted">เวลาเหลือ</span></div><div className="bg-warning text-white text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums"><Countdown endTime={box.sale_end!} /></div></div>}
                  {unlimited && !soldOut && <div className="flex items-center gap-1 mb-1.5"><InfinityIcon className="w-2.5 h-2.5 text-primary" strokeWidth={2.5} /><span className="text-[10px] font-bold text-primary">ไม่จำกัดเวลา</span></div>}
                  {remaining !== null && box.stock_limit! > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><Package className={`w-2.5 h-2.5 ${soldOut ? 'text-error' : stockPct >= 80 ? 'text-error' : stockPct >= 60 ? 'text-warning' : 'text-primary'}`} strokeWidth={2.5} /><span className="text-[10px] font-bold text-foreground-muted">{soldOut ? 'หมดแล้ว' : `เหลือ ${remaining.toLocaleString()} กล่อง`}</span></div><span className="text-[9px] font-bold text-foreground-subtle tabular-nums">{(box.sold_count ?? 0).toLocaleString()}/{box.stock_limit!.toLocaleString()}</span></div>
                      <div className="h-1.5 bg-border-muted rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${soldOut ? 'bg-error' : stockPct >= 80 ? 'bg-error' : stockPct >= 60 ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, Math.max(0, stockPct))}%` }} /></div>
                    </div>
                  )}
                </div>
              )}
              <div className="p-2.5 flex flex-col flex-1 gap-1"><p className="text-foreground font-bold text-xs leading-tight line-clamp-1">{box.name}</p>{box.description && <p className="text-foreground-subtle text-[9px] leading-snug line-clamp-1">{box.description}</p>}</div>
            </Link>
          );
        })}
      </div>
      <button onClick={() => scrollBy('right')} aria-label="เลื่อนขวา"
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-20 w-8 h-8 rounded-full bg-surface border border-border shadow-theme-md flex items-center justify-center text-foreground hover:border-primary/40 transition-opacity ${hovered && canRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ transition: 'opacity 0.15s' }}>
        <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function HomePage() {
  const [slides,      setSlides]      = useState([]);
  const [servers,     setServers]     = useState<Server[]>([]);
  const [lootboxes,   setLootboxes]   = useState<LootBox[]>([]);
  const [recentBuy,   setRecentBuy]   = useState<RecentPurchase[]>([]);
  const [recentBox,   setRecentBox]   = useState<RecentLootbox[]>([]);
  const [popularItems,   setPopularItems]   = useState<Product[]>([]);
  const [newArrivals,    setNewArrivals]    = useState<Product[]>([]);
  const [homeLoading,    setHomeLoading]    = useState(true);
  const [ipCopied,       setIpCopied]       = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
    Promise.all([
      api('/public/slides').then(d => setSlides((d.slides as never[]) || [])).catch(() => {}),
      api('/public/servers').then(d => setServers((d.servers as Server[]) || [])).catch(() => {}),
      api('/shop/lootboxes').then(d => setLootboxes((d.boxes as LootBox[]) || [])).catch(() => {}),
      api('/public/recent-purchases').then(d => setRecentBuy((d.purchases as RecentPurchase[]) || [])).catch(() => {}),
      api('/public/recent-lootbox').then(d => setRecentBox((d.openings as RecentLootbox[]) || [])).catch(() => {}),
      api('/public/products/popular').then(d => setPopularItems((d.products as Product[]) || [])).catch(() => {}),
      api('/public/products/new-arrivals').then(d => setNewArrivals((d.products as Product[]) || [])).catch(() => {}),
    ]).finally(() => setHomeLoading(false));
  }, []);

  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  const exclusiveUrgency = (b: LootBox): number => {
    const timeMs = b.sale_end ? Math.max(0, new Date(b.sale_end).getTime() - Date.now()) : Infinity;
    const remaining = b.stock_limit != null ? Math.max(0, b.stock_limit - (b.sold_count ?? 0)) : null;
    const stockNorm = remaining !== null && b.stock_limit! > 0 ? (remaining / b.stock_limit!) * MS_30D : Infinity;
    return Math.min(timeMs, stockNorm);
  };
  const exclusiveBoxes = lootboxes.filter(b => !b.is_paused && (b.sale_end || b.stock_limit != null)).sort((a, b) => exclusiveUrgency(a) - exclusiveUrgency(b));
  const popularBoxes = lootboxes.filter(b => !b.sale_end && b.stock_limit == null && (b.total_opens ?? b.sold_count ?? 0) > 0).sort((a, b) => (b.total_opens ?? b.sold_count ?? 0) - (a.total_opens ?? a.sold_count ?? 0)).slice(0, 4);

  return (
    <MainLayout>
      {settings.welcome_message && (settings.show_welcome_marquee ?? '1') === '1' && (
        <div className="flex items-stretch overflow-hidden rounded-2xl mb-4 theme-card">
          <div className="bg-primary px-5 flex items-center gap-2.5 flex-shrink-0">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" /></span>
            <Megaphone className="w-4 h-4 text-white" strokeWidth={2.25} /><span className="text-white text-[11px] font-black uppercase tracking-[0.2em] hidden sm:inline">LIVE</span>
          </div>
          <div className="flex-1 overflow-hidden py-3"><div className="marquee-track"><span className="inline-block w-1.5 h-1.5 rounded-full mx-6 bg-primary align-middle" /><span className="text-foreground text-sm font-bold px-8">{settings.welcome_message}</span><span className="inline-block w-1.5 h-1.5 rounded-full mx-6 bg-primary align-middle" /></div></div>
        </div>
      )}
      {settings.server_ip && (
        <button className="lg:hidden w-full flex items-center gap-3 px-4 py-3 bg-surface rounded-xl border border-border shadow-theme-sm mb-4" onClick={() => { navigator.clipboard.writeText(settings.server_ip!).then(() => { setIpCopied(true); setTimeout(() => setIpCopied(false), 2000); }).catch(() => {}); }}>
          <div className="w-7 h-7 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0"><Server className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} /></div>
          <span className="flex-1 font-mono text-sm font-bold text-foreground truncate text-left">{settings.server_ip}</span>
          <div className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all ${ipCopied ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-foreground-muted border border-border'}`}>{ipCopied ? <Check className="w-3 h-3" strokeWidth={3} /> : <Copy className="w-3 h-3" strokeWidth={2.5} />}{ipCopied ? 'Copied!' : 'คัดลอก IP'}</div>
        </button>
      )}
      {homeLoading && (
        <div className="flex flex-col lg:flex-row gap-4 mb-5 animate-pulse">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="rounded-2xl overflow-hidden bg-border-muted w-full h-[200px] md:h-[260px] lg:h-[300px]" />
            <div className="theme-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border-muted flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-border" /><div className="h-3 w-32 bg-border rounded-full" /><div className="h-4 w-14 bg-border rounded-full ml-auto" /></div>
              <div className="p-3 flex gap-2.5 overflow-hidden">{[0,1,2,3].map(i => (<div key={i} className="flex-shrink-0 w-[calc(50%-5px)] sm:w-[calc(25%-7.5px)] rounded-xl bg-surface-hover overflow-hidden border border-border-muted"><div className="aspect-[3/4] bg-border" /><div className="p-2.5 space-y-1.5"><div className="h-2.5 bg-border rounded-full w-3/4" /><div className="h-2 bg-border-muted rounded-full w-1/2" /></div></div>))}</div>
            </div>
            <div className="theme-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border-muted flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-border" /><div className="h-3 w-28 bg-border rounded-full" /><div className="h-4 w-14 bg-border rounded-full ml-auto" /></div>
              <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{[0,1,2,3].map(i => (<div key={i} className="rounded-xl border border-border-muted overflow-hidden"><div className="aspect-square bg-border" /><div className="p-2.5 space-y-1.5"><div className="h-2.5 bg-border rounded-full w-3/4" /><div className="h-5 bg-border rounded-lg w-1/2 mt-2" /></div></div>))}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:w-[230px] flex-shrink-0">
            <div className="theme-card overflow-hidden"><div className="px-4 py-3 bg-border h-[52px]" /><div className="p-3 space-y-2"><div className="h-10 bg-surface-hover rounded-xl" /><div className="h-16 bg-surface-hover rounded-xl" /><div className="space-y-1.5">{[0,1].map(i => <div key={i} className="h-10 bg-surface-hover rounded-lg" />)}</div></div></div>
            {[0,1].map(col => (<div key={col} className="theme-card overflow-hidden"><div className="px-4 py-3 border-b border-border-muted flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-border" /><div className="h-3 w-20 bg-border rounded-full" /></div><div className="px-2 py-2 space-y-1">{[0,1,2,3].map(i => (<div key={i} className="flex items-center gap-2.5 px-2 py-1.5"><div className="w-10 h-10 rounded-xl bg-border flex-shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-2.5 bg-border rounded-full w-3/4" /><div className="h-2 bg-border-muted rounded-full w-1/3" /></div></div>))}</div></div>))}
          </div>
        </div>
      )}
      <div className={`flex flex-col lg:flex-row gap-4 mb-5${homeLoading ? ' hidden' : ''}`}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} className="flex-1 min-w-0 flex flex-col gap-3">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="rounded-2xl overflow-hidden shadow-theme-lg">
            <div className="w-full h-[200px] md:h-[260px] lg:h-[300px] bg-gray-800">
              {slides.length > 0 ? <HeroCarousel slides={slides} /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-900 relative overflow-hidden"><div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #22c55e 0%, transparent 60%)' }} /><div className="relative z-10 text-center logo-float"><div className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] mb-2">{settings.shop_name || 'Siamsite'}</div><p className="text-green-400 font-bold text-sm tracking-widest uppercase">{settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ'}</p></div></div>}
            </div>
          </motion.div>
          {(settings.show_exclusive_gacha ?? '1') === '1' && exclusiveBoxes.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.5 }} className={CARD_CLS}>
              <div className="px-3 sm:px-4 py-3 border-b border-border-muted flex items-center gap-2 sm:gap-2.5"><div className="w-8 h-8 rounded-xl bg-violet-500/12 flex items-center justify-center flex-shrink-0"><Gem className="w-4 h-4 text-violet-500" strokeWidth={2.25} /></div><h2 className="font-black text-foreground text-sm leading-tight truncate min-w-0">GACHA Exclusive Box</h2><span className="bg-violet-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide flex-shrink-0">LIMITED</span><span className="hidden md:inline text-foreground-subtle text-xs flex-shrink-0">{exclusiveBoxes.length} กล่อง</span><Link href="/lootbox" className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0"><span className="hidden sm:inline">ดูกล่องสุ่มทั้งหมด</span><span className="sm:hidden">ทั้งหมด</span> <ArrowRight className="w-3 h-3" strokeWidth={2.5} /></Link></div>
              <div className="p-3"><HomeGachaCarousel boxes={exclusiveBoxes} noDrag /></div>
            </motion.div>
          )}
          {(settings.show_popular_gacha ?? '1') === '1' && popularBoxes.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.5, delay: 0.1 }} className={CARD_CLS}>
              <div className="px-3 sm:px-4 py-3 border-b border-border-muted flex items-center gap-2 sm:gap-2.5"><div className="w-8 h-8 rounded-xl bg-warning/12 flex items-center justify-center flex-shrink-0"><PackageOpen className="w-4 h-4 text-warning" strokeWidth={2.25} /></div><h2 className="font-black text-foreground text-sm leading-tight truncate min-w-0">GACHA กล่องสุ่ม ยอดนิยม</h2><span className="bg-warning text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide flex-shrink-0">HOT</span><span className="hidden md:inline text-foreground-subtle text-xs flex-shrink-0">{popularBoxes.length} กล่อง</span><Link href="/lootbox" className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/15 active:scale-95 transition-all flex-shrink-0"><span className="hidden sm:inline">ดูกล่องสุ่มทั้งหมด</span><span className="sm:hidden">ทั้งหมด</span> <ArrowRight className="w-3 h-3" strokeWidth={2.5} /></Link></div>
              <div className="p-3"><HomeGachaCarousel boxes={popularBoxes} /></div>
            </motion.div>
          )}
          {(settings.show_popular_widget ?? '1') === '1' && popularItems.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.5, delay: 0.2 }} className="theme-card">
              <div className="px-4 py-3 border-b border-border-muted"><SectionHeader Icon={Flame} tint="239 68 68" title="ITEMS สินค้ายอดนิยม" count={popularItems.length} href="/shop" btnLabel="ดูทั้งหมด" /></div>
              <div className="p-3"><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{popularItems.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}</div></div>
            </motion.div>
          )}
          {(settings.show_new_arrivals ?? '1') === '1' && newArrivals.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.5, delay: 0.3 }} className="theme-card">
              <div className="px-4 py-3 border-b border-border-muted"><SectionHeader Icon={Star} tint="59 130 246" title="ไอเท็มมาใหม่" count={newArrivals.length} href="/shop" btnLabel="ดูทั้งหมด" /></div>
              <div className="p-3"><div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{newArrivals.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}</div></div>
            </motion.div>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }} className="flex flex-col gap-3 lg:w-[230px] flex-shrink-0 self-start">
          {(settings.show_server_status_widget ?? '1') === '1' && (
            <ServerStatusWidget serverIp={settings.server_ip} dbServers={servers} />
          )}
          {(settings.show_gacha_live_widget ?? '1') === '1' && (
          <div className={CARD_CLS}>
            <div className="px-4 py-3 border-b border-border-muted flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-warning/12 flex items-center justify-center flex-shrink-0"><PackageOpen className="w-4 h-4 text-warning" strokeWidth={2.25} /></div><div className="flex-1 min-w-0"><p className="text-foreground font-black text-xs leading-none">GACHA LIVE</p><p className="text-foreground-subtle text-[9px] mt-0.5">เปิดกล่องล่าสุด</p></div><span className="relative flex h-2 w-2 flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-warning" /></span></div>
            <div className="px-2 py-2 space-y-0.5">{recentBox.length === 0 ? <p className="text-foreground-subtle text-xs text-center py-6">ยังไม่มีข้อมูล</p> : recentBox.slice(0, 5).map((r, i) => { const rar = getRarity(r.item_rarity); return (<div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-hover transition-colors"><div className="w-10 h-10 rounded-xl flex-shrink-0 border border-border bg-surface-hover flex items-center justify-center">{r.item_image ? <img src={r.item_image} alt={r.item_name} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} /> : <Gem className="w-4 h-4 text-foreground-subtle" strokeWidth={2} />}</div><div className="min-w-0 flex-1"><p className="text-foreground text-[11px] font-bold truncate leading-snug">{r.item_name}</p><p className="text-foreground-subtle text-[9px] truncate">{r.username}</p></div><div className="flex flex-col items-end gap-0.5 flex-shrink-0"><span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md text-white leading-none" style={{ backgroundColor: rar.color, boxShadow: `0 1px 0 ${rar.color}88` }}><span className="w-1 h-1 rounded-sm bg-white/60 flex-shrink-0" />{rar.label}</span><span className="text-foreground-subtle text-[8px] tabular-nums">{timeAgo(r.won_at)}</span></div></div>); })}</div>
          </div>
          )}
          {(settings.show_live_shop_widget ?? '1') === '1' && (
          <div className={CARD_CLS}>
            <div className="px-4 py-3 border-b border-border-muted flex items-center gap-2.5"><div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-4 h-4 text-primary" strokeWidth={2.25} /></div><div className="flex-1 min-w-0"><p className="text-foreground font-black text-xs leading-none">SHOP LIVE</p><p className="text-foreground-subtle text-[9px] mt-0.5">ซื้อไอเท็มล่าสุด</p></div><span className="relative flex h-2 w-2 flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary" /></span></div>
            <div className="px-2 py-2 space-y-0.5">{recentBuy.length === 0 ? <p className="text-foreground-subtle text-xs text-center py-6">ยังไม่มีข้อมูล</p> : recentBuy.slice(0, 5).map((r, i) => (<div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-hover transition-colors"><div className="w-10 h-10 rounded-xl flex-shrink-0 border border-border bg-surface-hover flex items-center justify-center">{r.image ? <img src={r.image} alt={r.product_name} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} /> : <Package className="w-4 h-4 text-foreground-subtle" strokeWidth={2} />}</div><div className="min-w-0 flex-1"><p className="text-foreground text-[11px] font-bold truncate leading-snug">{r.product_name}</p><p className="text-foreground-subtle text-[9px] truncate">{r.username}</p></div><div className="flex flex-col items-end gap-0.5 flex-shrink-0"><div className="inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-md text-white leading-none" style={{ backgroundColor: 'rgb(var(--color-primary-hover))', boxShadow: '0 1px 0 rgb(var(--color-primary-hover) / 0.53)' }}><Coins className="w-2 h-2" strokeWidth={2.5} />{parseFloat(String(r.price)).toLocaleString()}</div><span className="text-foreground-subtle text-[8px] tabular-nums">{timeAgo(r.created_at)}</span></div></div>))}</div>
          </div>)}
        </motion.div>
      </div>
    </MainLayout>
  );
}
