'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';

interface LootBox {
  id: number;
  name: string;
  description?: string;
  image?: string;
  price: number;
  original_price?: number | null;
  sort_order: number;
  category_name?: string;
  category_color?: string;
  stock_limit?: number | null;
  sale_end?: string | null;
  sold_count?: number;
  is_paused?: boolean;
  sale_start?: string | null;
}

type TypeFilter = 'all' | 'limited' | 'hot' | 'normal';

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ endTime }: { endTime: string }) {
  const calc = () => Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
  const [secs, setSecs] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [endTime]);
  if (secs <= 0) return <span className="text-red-500 font-black text-[10px]">หมดเวลา</span>;
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60), s = secs % 60;
  if (d > 0) return <span className="tabular-nums font-black text-[10px] text-white">{d}ว {h}ช {m}น</span>;
  if (h > 0) return <span className="tabular-nums font-black text-[10px] text-white">{h}ช {m}น {s}ว</span>;
  return <span className="tabular-nums font-black text-[10px] text-red-500">{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

// ─── BoxCard ──────────────────────────────────────────────────────────────────
function BoxCard({ box }: { box: LootBox }) {
  const hasPromo   = box.original_price && box.original_price > box.price;
  const discPct    = hasPromo ? Math.round((1 - box.price / box.original_price!) * 100) : 0;
  const isPaused   = !!box.is_paused;
  const hasSaleEnd = !!box.sale_end;
  const expired    = hasSaleEnd && new Date(box.sale_end!).getTime() <= Date.now();
  const active     = !isPaused && hasSaleEnd && !expired;
  const unlimited  = !isPaused && !!box.sale_start && !box.sale_end;
  const remaining  = box.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
  const soldOut    = remaining !== null && remaining <= 0;
  const stockPct   = box.stock_limit && box.stock_limit > 0
    ? Math.round(((box.sold_count ?? 0) / box.stock_limit) * 100)
    : 0;

  // Intrinsic type badge — priority: LIMITED > HOT > category
  const isLimitedBox = !isPaused && (!!box.sale_end || box.stock_limit != null);
  const isHotBox     = !isPaused && !box.sale_end && box.stock_limit == null && (box.sold_count ?? 0) > 0;

  return (
    <div className={`group relative flex flex-col bg-white border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md ${
      isPaused ? 'border-orange-200 opacity-80' :
      soldOut || expired ? 'border-gray-200 opacity-60' :
      'border-gray-200 hover:border-amber-300'
    }`}>

      {/* Image area */}
      <div className="relative aspect-[3/4] bg-amber-50 overflow-hidden">

        {/* Type badge — top left (priority: LIMITED > HOT > category) */}
        {isLimitedBox && (
          <span className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 bg-violet-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm leading-none">
            <i className="fas fa-gem text-[7px]" /> LIMITED
          </span>
        )}
        {!isLimitedBox && isHotBox && (
          <span className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm leading-none">
            <i className="fas fa-fire text-[7px]" /> HOT
          </span>
        )}
        {!isLimitedBox && !isHotBox && box.category_name && (
          <span className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-gray-200/80 leading-none">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: box.category_color || '#f59e0b' }} />
            {box.category_name}
          </span>
        )}
        {/* Category badge below type badge (when type badge present) */}
        {(isLimitedBox || isHotBox) && box.category_name && (
          <span className="absolute top-6 left-1.5 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-gray-200/80 leading-none">
            <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: box.category_color || '#f59e0b' }} />
            {box.category_name}
          </span>
        )}

        {/* Discount badge — top right */}
        {hasPromo && !soldOut && !isPaused && (
          <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md leading-none">
            <i className="fas fa-tag text-[8px]" />-{discPct}%
          </span>
        )}

        {/* Overlays */}
        {isPaused && (
          <div className="absolute inset-0 z-10 bg-black/45 flex items-center justify-center">
            <div className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
              <i className="fas fa-pause text-[8px] mr-1" /> หยุดชั่วคราว
            </div>
          </div>
        )}
        {soldOut && !isPaused && (
          <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center">
            <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg rotate-[-8deg]">
              <i className="fas fa-box text-[8px] mr-1" /> หมดแล้ว
            </div>
          </div>
        )}
        {expired && !soldOut && (
          <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center">
            <div className="bg-gray-700 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
              <i className="fas fa-clock text-[8px] mr-1" /> หมดเวลา
            </div>
          </div>
        )}

        {/* Image */}
        {box.image ? (
          <img src={box.image} alt={box.name} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="fas fa-box text-5xl text-amber-200 group-hover:text-amber-300 transition-colors" />
          </div>
        )}

        {/* Price overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent px-2 py-3 flex items-end justify-between gap-1">
          {hasPromo ? (
            <span className="text-white/70 text-[10px] font-medium line-through tabular-nums leading-none drop-shadow">
              {parseFloat(String(box.original_price)).toLocaleString()} ฿
            </span>
          ) : <span />}
          <span className="bg-amber-500 text-white text-xs font-black px-2 py-1 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)] tabular-nums leading-none flex-shrink-0">
            {parseFloat(String(box.price)).toLocaleString()} ฿
          </span>
        </div>
      </div>

      {/* Sale info bar */}
      {(isPaused || active || unlimited || (remaining !== null && box.stock_limit! > 0)) && (
        <div className={`px-2.5 py-1.5 border-t text-[10px] ${isPaused ? 'bg-orange-50 border-orange-100' : soldOut ? 'bg-red-50 border-red-100' : expired ? 'bg-gray-50 border-gray-100' : 'bg-amber-50 border-amber-100'}`}>
          {isPaused && <span className="flex items-center gap-1 font-bold text-orange-600"><i className="fas fa-pause text-[9px]" /> หยุดจำหน่าย</span>}
          {/* Timer + stock on same row when both present */}
          {(active || unlimited) && (
            <div className="flex items-center justify-between gap-1">
              {active && (
                <span className="bg-amber-500 text-white font-black px-1.5 py-0.5 rounded tabular-nums shadow-[0_1px_0_#b45309] flex items-center gap-1 flex-shrink-0">
                  <i className="fas fa-hourglass-half text-[8px]" />
                  <Countdown endTime={box.sale_end!} />
                </span>
              )}
              {unlimited && !soldOut && (
                <span className="flex items-center gap-1 font-bold text-green-600 flex-shrink-0">
                  <i className="fas fa-infinity text-[9px]" /> ไม่จำกัดเวลา
                </span>
              )}
              {remaining !== null && box.stock_limit! > 0 && (
                <span className={`flex items-center gap-0.5 font-black tabular-nums ml-auto flex-shrink-0 ${soldOut ? 'text-red-500' : stockPct <= 20 ? 'text-orange-500' : 'text-gray-500'}`}>
                  <i className="fas fa-box text-[8px]" />
                  {(box.sold_count ?? 0).toLocaleString()}/{box.stock_limit!.toLocaleString()}
                </span>
              )}
            </div>
          )}
          {/* Stock only (no sale timer) */}
          {!active && !unlimited && remaining !== null && box.stock_limit! > 0 && (
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1 font-bold ${soldOut ? 'text-red-500' : stockPct <= 20 ? 'text-orange-500' : 'text-gray-500'}`}>
                <i className="fas fa-box text-[9px]" />{soldOut ? 'หมดแล้ว' : `เหลือ ${remaining.toLocaleString()}`}
              </span>
              <span className="text-gray-400 tabular-nums font-bold">{(box.sold_count ?? 0).toLocaleString()}/{box.stock_limit!.toLocaleString()}</span>
            </div>
          )}
          {/* Progress bar */}
          {remaining !== null && box.stock_limit! > 0 && (
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full ${soldOut ? 'bg-red-400' : stockPct <= 20 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.max(0, stockPct)}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col flex-1">
        <p className="text-gray-900 font-bold text-xs leading-tight line-clamp-1">{box.name}</p>
        {box.description && <p className="text-gray-400 text-[9px] line-clamp-1 mt-0.5">{box.description}</p>}
        <div className="mt-2.5" />
        <Link href={`/lootbox/${box.id}`}
          className={`w-full mt-auto pt-2 pb-2 text-[11px] font-bold rounded-lg text-white transition-all flex items-center justify-center gap-1.5 min-h-[34px] ${
            isPaused
              ? 'bg-orange-400 shadow-[0_3px_0_#c2410c] cursor-not-allowed pointer-events-none'
              : soldOut || expired
              ? 'bg-gray-400 shadow-[0_3px_0_#9ca3af] cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 shadow-[0_3px_0_#b45309] hover:shadow-[0_1px_0_#b45309] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px]'
          }`}>
          <i className={`fas ${isPaused ? 'fa-pause' : soldOut || expired ? 'fa-info-circle' : 'fa-box-open'} text-[10px]`} />
          {isPaused ? 'หยุดจำหน่าย' : soldOut || expired ? 'ดูรายละเอียด' : 'เปิดกล่อง'}
        </Link>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
const TYPE_FILTERS: { key: TypeFilter; label: string; icon: string; color: string; activeBg: string; activeShadow: string }[] = [
  { key: 'all',     label: 'ทั้งหมด',   icon: 'fa-layer-group', color: 'text-green-600',  activeBg: 'bg-green-500',  activeShadow: 'shadow-[0_3px_0_#15803d]' },
  { key: 'limited', label: 'LIMITED',   icon: 'fa-gem',          color: 'text-violet-600', activeBg: 'bg-violet-500', activeShadow: 'shadow-[0_3px_0_#5b21b6]' },
  { key: 'hot',     label: 'ยอดนิยม',   icon: 'fa-fire',         color: 'text-amber-500',  activeBg: 'bg-amber-500',  activeShadow: 'shadow-[0_3px_0_#b45309]' },
  { key: 'normal',  label: 'กล่องปกติ', icon: 'fa-box',          color: 'text-gray-500',   activeBg: 'bg-[#1e2735]',  activeShadow: 'shadow-[0_3px_0_#38404d]' },
];

export default function LootBoxListPage() {
  const [boxes, setBoxes]       = useState<LootBox[]>([]);
  const [loading, setLoading]   = useState(true);
  const [typeFilter, setTypeFilter]       = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    api('/shop/lootboxes')
      .then(d => setBoxes((d.boxes as LootBox[]) || []))
      .finally(() => setLoading(false));
  }, []);

  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  const urgencyScore = (b: LootBox) => {
    const t = b.sale_end ? Math.max(0, new Date(b.sale_end).getTime() - Date.now()) : Infinity;
    const rem = b.stock_limit != null ? Math.max(0, b.stock_limit - (b.sold_count ?? 0)) : null;
    const s = rem !== null && b.stock_limit! > 0 ? (rem / b.stock_limit!) * MS_30D : Infinity;
    return Math.min(t, s);
  };

  const isLimited = (b: LootBox) => !b.is_paused && (!!b.sale_end || b.stock_limit != null);
  const isHot     = (b: LootBox) => !b.is_paused && !b.sale_end && b.stock_limit == null && (b.sold_count ?? 0) > 0;
  const isNormal  = (b: LootBox) => !b.is_paused && !b.sale_end && b.stock_limit == null && (b.sold_count ?? 0) === 0;

  // Unique categories from all boxes (not filtered)
  const allCategories = useMemo(() => {
    const map = new Map<string, { name: string; color: string; count: number }>();
    boxes.forEach(b => {
      if (b.category_name) {
        const ex = map.get(b.category_name);
        map.set(b.category_name, { name: b.category_name, color: b.category_color || '#f59e0b', count: (ex?.count ?? 0) + 1 });
      }
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [boxes]);

  const { byType, counts } = useMemo(() => {
    const limited = [...boxes].filter(isLimited).sort((a, b) => urgencyScore(a) - urgencyScore(b));
    const hot     = [...boxes].filter(isHot).sort((a, b) => (b.sold_count ?? 0) - (a.sold_count ?? 0));
    const normal  = [...boxes].filter(isNormal).sort((a, b) => {
      const aDisc = a.original_price && a.original_price > a.price ? 1 : 0;
      const bDisc = b.original_price && b.original_price > b.price ? 1 : 0;
      if (bDisc !== aDisc) return bDisc - aDisc; // มีส่วนลดขึ้นก่อน
      return a.sort_order - b.sort_order;
    });
    const all     = [...limited, ...hot, ...normal];
    return {
      byType: { all, limited, hot, normal } as Record<TypeFilter, LootBox[]>,
      counts: { all: all.length, limited: limited.length, hot: hot.length, normal: normal.length },
    };
  }, [boxes]);

  // Apply category filter on top of type filter
  const filtered = useMemo(() => {
    const base = byType[typeFilter] ?? [];
    if (!categoryFilter) return base;
    return base.filter(b => b.category_name === categoryFilter);
  }, [byType, typeFilter, categoryFilter]);

  // Category counts within current type pool
  const categoryCounts = useMemo(() => {
    const base = byType[typeFilter] ?? [];
    const map = new Map<string, number>();
    base.forEach(b => { if (b.category_name) map.set(b.category_name, (map.get(b.category_name) ?? 0) + 1); });
    return map;
  }, [byType, typeFilter]);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <i className="fas fa-box-open text-amber-500 text-lg" />
            GACHA กล่องสุ่ม
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">สุ่มไอเท็มและรับของเข้าเกมทันที</p>
        </div>

        {/* ── Main card ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">

          {/* ── Row 1: Type filters ── */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setTypeFilter(f.key); setCategoryFilter(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all active:translate-y-[1px] ${
                  typeFilter === f.key
                    ? `${f.activeBg} ${f.activeShadow} text-white`
                    : `bg-white border border-gray-200 ${f.color} hover:border-gray-300`
                }`}
              >
                <i className={`fas ${f.icon} text-[10px]`} />
                {f.label}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  typeFilter === f.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {loading ? '…' : counts[f.key]}
                </span>
              </button>
            ))}

            <span className="ml-auto text-xs text-gray-400 font-bold flex-shrink-0">
              {loading ? '…' : `${filtered.length} กล่อง`}
            </span>
          </div>

          {/* ── Row 2: Category filters (แสดงเมื่อมี category) ── */}
          {allCategories.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/40 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex-shrink-0 mr-1">หมวด</span>

              {/* ทุกหมวด */}
              <button
                onClick={() => setCategoryFilter(null)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all active:translate-y-[1px] ${
                  categoryFilter === null
                    ? 'bg-[#1e2735] shadow-[0_2px_0_#38404d] text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-th-large text-[9px]" /> ทุกหมวด
              </button>

              {allCategories.map(cat => {
                const cnt = categoryCounts.get(cat.name) ?? 0;
                const active = categoryFilter === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setCategoryFilter(active ? null : cat.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all active:translate-y-[1px] ${
                      active
                        ? 'bg-gray-700 shadow-[0_2px_0_#374151] text-white'
                        : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                    <span className={`text-[9px] font-black ${active ? 'text-white/70' : cnt === 0 ? 'text-gray-300' : 'text-gray-400'}`}>
                      {cnt}
                    </span>
                  </button>
                );
              })}

              {/* active category clear badge */}
              {categoryFilter && (
                <button
                  onClick={() => setCategoryFilter(null)}
                  className="ml-1 flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors"
                >
                  <i className="fas fa-times text-[9px]" /> ล้าง
                </button>
              )}
            </div>
          )}

          {/* ── Grid body ── */}
          <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {[...Array(15)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <i className="fas fa-box-open text-2xl text-gray-300" />
                </div>
                <p className="text-gray-600 font-bold text-sm">ไม่มีกล่องในหมวดนี้</p>
                <p className="text-gray-400 text-xs mt-1">ลองเปลี่ยน filter หรือรอโปรโมชั่นใหม่</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filtered.map(box => <BoxCard key={box.id} box={box} />)}
              </div>
            )}
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
