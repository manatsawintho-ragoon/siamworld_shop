'use client';
import { useEffect, useState } from 'react';
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

// ─── Countdown component ──────────────────────────────────────────────────────
function Countdown({ endTime }: { endTime: string }) {
  const calc = () => Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
  const [secs, setSecs] = useState(calc);

  useEffect(() => {
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [endTime]);

  if (secs <= 0) return <span className="text-red-500 font-black text-[10px]">หมดเวลา</span>;

  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  if (d > 0) return <span className="tabular-nums font-black text-[10px] text-amber-600">{d}ว {h}ช {m}น</span>;
  if (h > 0) return <span className="tabular-nums font-black text-[10px] text-amber-600">{h}ช {m}น {s}ว</span>;
  return <span className="tabular-nums font-black text-[10px] text-red-500">{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

export default function LootBoxListPage() {
  const [boxes, setBoxes] = useState<LootBox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/shop/lootboxes')
      .then(d => setBoxes((d.boxes as LootBox[]) || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <i className="fas fa-box-open text-amber-500 text-lg" />
              GACHA กล่องสุ่ม
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">สุ่มไอเท็มและรับของเข้าเกมทันที</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">

          {/* How it works strip */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-5 py-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-amber-700 text-[10px] font-black uppercase tracking-widest flex-shrink-0">วิธีเล่น</span>
              {[
                { icon: 'fa-gamepad', label: 'เข้าเกมก่อน' },
                { icon: 'fa-box-open', label: 'เปิดกล่อง' },
                { icon: 'fa-bolt', label: 'รับไอเท็มทันที' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <i className="fas fa-chevron-right text-amber-300 text-[8px]" />}
                  <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2 py-1">
                    <i className={`fas ${s.icon} text-amber-500 text-[10px]`} />
                    <span className="text-amber-700 text-[10px] font-bold">{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="p-4 min-h-[300px]">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : boxes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <i className="fas fa-box-open text-2xl text-gray-300" />
                </div>
                <p className="text-gray-600 font-bold text-sm">ยังไม่มีกล่องสุ่ม</p>
                <p className="text-gray-400 text-xs mt-1">ติดตามโปรโมชั่นใหม่เร็วๆ นี้</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {boxes.map(box => {
                  const hasPromo   = box.original_price && box.original_price > box.price;
                  const discPct    = hasPromo ? Math.round((1 - box.price / box.original_price!) * 100) : 0;
                  const isPaused   = !!box.is_paused;
                  const hasSaleEnd  = !!box.sale_end;
                  const expired     = hasSaleEnd && new Date(box.sale_end!).getTime() <= Date.now();
                  const active      = !isPaused && hasSaleEnd && !expired;
                  const unlimited   = !isPaused && !!box.sale_start && !box.sale_end;
                  const remaining  = box.stock_limit != null ? Math.max(0, box.stock_limit - (box.sold_count ?? 0)) : null;
                  const soldOut    = remaining !== null && remaining <= 0;
                  const stockPct   = (box.stock_limit && box.stock_limit > 0)
                    ? Math.round(((box.stock_limit - (box.sold_count ?? 0)) / box.stock_limit) * 100)
                    : 100;

                  return (
                  <div key={box.id} className={`group relative flex flex-col bg-white border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md ${isPaused ? 'border-orange-200 opacity-80' : soldOut || expired ? 'border-gray-200 opacity-75' : 'border-gray-200 hover:border-amber-300'}`}>
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
                          <div className="bg-orange-500 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg tracking-wide">
                            <i className="fas fa-pause text-[10px] mr-1" /> หยุดจำหน่ายชั่วคราว
                          </div>
                        </div>
                      )}

                      {/* Sold out overlay */}
                      {soldOut && !isPaused && (
                        <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center">
                          <div className="bg-red-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg tracking-wide rotate-[-8deg]">
                            <i className="fas fa-box text-[10px] mr-1" /> หมดแล้ว
                          </div>
                        </div>
                      )}

                      {/* Expired overlay */}
                      {expired && !soldOut && (
                        <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center">
                          <div className="bg-gray-700 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg tracking-wide">
                            <i className="fas fa-clock text-[10px] mr-1" /> หมดเวลา
                          </div>
                        </div>
                      )}

                      {/* Image */}
                      {box.image ? (
                        <img src={box.image} alt={box.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="fas fa-box text-6xl text-amber-200 group-hover:text-amber-300 transition-colors" />
                        </div>
                      )}

                      {/* Bottom price overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 py-4 flex items-end justify-between gap-2">
                        {hasPromo ? (
                          <span className="text-white/75 text-xs font-medium line-through tabular-nums leading-none drop-shadow">
                            {parseFloat(String(box.original_price)).toLocaleString()} ฿
                          </span>
                        ) : <span />}
                        <span className="bg-amber-500 text-white text-sm font-black px-3 py-1.5 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)] tabular-nums leading-none flex-shrink-0">
                          {parseFloat(String(box.price)).toLocaleString()} ฿
                        </span>
                      </div>
                    </div>

                    {/* ── Sale info bar (countdown + stock) ── */}
                    {(isPaused || active || unlimited || (remaining !== null && box.stock_limit! > 0)) && (
                      <div className={`px-3 py-2 border-t ${isPaused ? 'bg-orange-50 border-orange-100' : soldOut ? 'bg-red-50 border-red-100' : expired ? 'bg-gray-50 border-gray-100' : 'bg-amber-50 border-amber-100'}`}>
                        {/* Paused row */}
                        {isPaused && (
                          <div className="flex items-center gap-1.5">
                            <i className="fas fa-pause text-orange-500 text-[11px]" />
                            <span className="text-[11px] font-bold text-orange-600">หยุดจำหน่ายชั่วคราว</span>
                          </div>
                        )}
                        {/* Countdown row (timed sale) */}
                        {active && (
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <i className="fas fa-clock text-amber-500 text-[11px]" />
                              <span className="text-[11px] font-bold text-gray-600">เวลาเหลือ</span>
                            </div>
                            <div className="bg-amber-500 text-white text-[12px] font-black px-2 py-0.5 rounded-md tabular-nums shadow-[0_2px_0_#b45309]">
                              <Countdown endTime={box.sale_end!} />
                            </div>
                          </div>
                        )}
                        {/* Unlimited badge */}
                        {unlimited && !soldOut && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <i className="fas fa-infinity text-green-500 text-[11px]" />
                            <span className="text-[11px] font-bold text-green-600">ขายปกติ ไม่จำกัดเวลา</span>
                          </div>
                        )}
                        {/* Stock row */}
                        {remaining !== null && box.stock_limit! > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                <i className={`fas fa-box text-[10px] ${soldOut ? 'text-red-400' : stockPct <= 20 ? 'text-orange-400' : 'text-green-500'}`} />
                                <span className="text-[11px] font-bold text-gray-600">
                                  {soldOut ? 'หมดแล้ว' : `เหลืออีก ${remaining.toLocaleString()} กล่อง`}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                                {(box.sold_count ?? 0).toLocaleString()}/{box.stock_limit!.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${soldOut ? 'bg-red-400' : stockPct <= 20 ? 'bg-orange-400' : 'bg-green-400'}`}
                                style={{ width: `${Math.max(0, stockPct)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Info section */}
                    <div className="px-3 pt-2.5 pb-3 flex flex-col flex-1">
                      <p className="text-gray-900 font-bold text-sm leading-tight line-clamp-1">{box.name}</p>
                      {box.description && (
                        <p className="text-gray-400 text-[10px] leading-snug line-clamp-1 mt-0.5">{box.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {hasPromo && (
                          <span className="text-gray-400 text-[10px] line-through tabular-nums">
                            ฿{parseFloat(String(box.original_price)).toLocaleString()}
                          </span>
                        )}
                        <span className="text-amber-500 font-black text-sm tabular-nums">
                          ฿{parseFloat(String(box.price)).toLocaleString()}
                        </span>
                      </div>

                      <Link href={`/lootbox/${box.id}`}
                        className={`w-full mt-auto pt-2.5 pb-2.5 text-xs font-bold rounded-lg text-white transition-all flex items-center justify-center gap-1.5 min-h-[38px] ${
                          isPaused
                            ? 'bg-orange-400 shadow-[0_3px_0_#c2410c] cursor-not-allowed pointer-events-none'
                            : soldOut || expired
                            ? 'bg-gray-400 shadow-[0_3px_0_#9ca3af] cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-400 shadow-[0_3px_0_#b45309] hover:shadow-[0_1px_0_#b45309] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px]'
                        }`}>
                        <i className={`fas ${isPaused ? 'fa-pause' : 'fa-info-circle'} text-[11px]`} />
                        {isPaused ? 'หยุดจำหน่ายชั่วคราว' : 'ดูรายละเอียด'}
                      </Link>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
