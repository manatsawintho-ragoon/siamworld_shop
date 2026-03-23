'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getRarity, RARITY } from '@/lib/rarity';

interface InventoryItem {
  id: number; loot_box_id: number; loot_box_item_id: number;
  item_name: string; item_image?: string; item_rarity: string;
  status: 'PENDING' | 'REDEEMED'; box_name: string; won_at: string; redeemed_at?: string;
}
interface Server { id: number; name: string; }

const PAGE_SIZE = 24;

const RARITY_ORDER: Record<string, number> = {
  mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5,
};

// Darkened shadow color per rarity tier (3D press-style bottom shadow)
const RARITY_SHADOW: Record<string, { bottom: string; glow: string }> = {
  mythic:    { bottom: '#991b1b', glow: 'rgba(220,38,38,0.28)'   },
  legendary: { bottom: '#c2410c', glow: 'rgba(249,115,22,0.28)'  },
  epic:      { bottom: '#6b21a8', glow: 'rgba(147,51,234,0.28)'  },
  rare:      { bottom: '#1d4ed8', glow: 'rgba(37,99,235,0.24)'   },
  uncommon:  { bottom: '#15803d', glow: 'rgba(22,163,74,0.24)'   },
  common:    { bottom: '#475569', glow: 'rgba(100,116,139,0.20)' },
};

/* ── Rarity Badge ── */
function RarityBadge({ rarity }: { rarity: string }) {
  const rar = getRarity(rarity);
  return (
    <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md text-white leading-none w-fit"
      style={{ backgroundColor: rar.color, boxShadow: `0 1px 0 ${rar.color}88` }}>
      <span className="w-1 h-1 rounded-sm bg-white/60 flex-shrink-0" />
      {rar.label}
    </span>
  );
}

/* ── Server Select ── */
function ServerSelect({ servers, value, onChange }: { servers: Server[]; value: number; onChange: (id: number) => void }) {
  return (
    <div className={`grid gap-2 ${servers.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {servers.map(s => (
        <button key={s.id} type="button" onClick={() => onChange(s.id)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${
            value === s.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}>
          <i className={`fas fa-server text-[10px] ${value === s.id ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="truncate">{s.name}</span>
          {value === s.id && <i className="fas fa-check text-green-500 text-[10px] ml-auto" />}
        </button>
      ))}
    </div>
  );
}

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const backdropRef = useRef(false);

  const [items, setItems]               = useState<InventoryItem[]>([]);
  const [servers, setServers]           = useState<Server[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<'ALL' | 'PENDING' | 'REDEEMED'>('ALL');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);

  const [redeemModal, setRedeemModal]   = useState<InventoryItem | null>(null);
  const [selectedServer, setSelectedServer] = useState<number>(0);
  const [redeemLoading, setRedeemLoading]   = useState(false);
  const [redeemError, setRedeemError]       = useState('');

  const [redeemAllModal, setRedeemAllModal]     = useState(false);
  const [redeemAllServer, setRedeemAllServer]   = useState<number>(0);
  const [redeemAllLoading, setRedeemAllLoading] = useState(false);
  const [redeemAllError, setRedeemAllError]     = useState('');

  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const load = () => {
    if (!getToken()) return;
    api('/user/inventory', { token: getToken()! })
      .then(d => setItems((d.items as InventoryItem[]) || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !user) { router.push('/'); return; }
    if (!authLoading && user) {
      load();
      api('/public/servers').then(d => {
        const srvs = (d.servers as Server[]) || [];
        setServers(srvs);
        if (srvs.length > 0) { setSelectedServer(srvs[0].id); setRedeemAllServer(srvs[0].id); }
      });
    }
  }, [authLoading, user]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const handleRedeem = async () => {
    if (!redeemModal || selectedServer === 0) return;
    setRedeemLoading(true); setRedeemError('');
    try {
      const result = await api(`/user/inventory/${redeemModal.id}/redeem`, {
        method: 'POST', token: getToken()!, body: { serverId: selectedServer },
      });
      showToast(`ส่ง "${(result as any).itemName || redeemModal.item_name}" เข้าเกมสำเร็จ!`);
      setRedeemModal(null); load();
    } catch (err: any) { setRedeemError(err?.message || 'เกิดข้อผิดพลาด'); }
    setRedeemLoading(false);
  };

  const handleRedeemAll = async () => {
    if (redeemAllServer === 0) return;
    setRedeemAllLoading(true); setRedeemAllError('');
    try {
      const result = await api('/user/inventory/redeem-all', {
        method: 'POST', token: getToken()!, body: { serverId: redeemAllServer },
      }) as any;
      setRedeemAllModal(false); load();
      showToast(result.successCount > 0
        ? `ส่งเข้าเกมสำเร็จ ${result.successCount} ชิ้น${result.failCount > 0 ? ` (ล้มเหลว ${result.failCount} ชิ้น)` : '!'}`
        : 'ไม่มีไอเท็มที่ส่งสำเร็จ');
    } catch (err: any) { setRedeemAllError(err?.message || 'เกิดข้อผิดพลาด'); }
    setRedeemAllLoading(false);
  };

  const pendingCount  = items.filter(i => i.status === 'PENDING').length;
  const redeemedCount = items.length - pendingCount;

  const sorted = useMemo(() =>
    [...items].sort((a, b) =>
      (RARITY_ORDER[a.item_rarity] ?? 99) - (RARITY_ORDER[b.item_rarity] ?? 99)
    ), [items]);

  const filtered = useMemo(() => sorted.filter(i => {
    if (filter !== 'ALL' && i.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return i.item_name.toLowerCase().includes(q) || i.box_name.toLowerCase().includes(q) || i.item_rarity.toLowerCase().includes(q);
    }
    return true;
  }), [sorted, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterTabs = [
    { key: 'ALL'      as const, label: 'ทั้งหมด', icon: 'layer-group', count: items.length      },
    { key: 'PENDING'  as const, label: 'รอรับ',   icon: 'clock',       count: pendingCount       },
    { key: 'REDEEMED' as const, label: 'รับแล้ว', icon: 'check-circle',count: redeemedCount      },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-box text-[#f97316]" />
              คลังของรางวัล
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full tabular-nums">
                  {pendingCount} รอรับ
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">ไอเท็มที่คุณสุ่มได้ กดรับเพื่อส่งเข้าเกม Minecraft ของคุณ</p>
          </div>
          {pendingCount > 0 && (
            <button onClick={() => { setRedeemAllError(''); setRedeemAllModal(true); }}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
              <i className="fas fa-gamepad text-[12px]" /> รับทั้งหมด ({pendingCount})
            </button>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div key="toast" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
              <i className="fas fa-circle-check text-green-500" />
              <span className="flex-1">{toast}</span>
              <button onClick={() => setToast('')} className="text-green-400 hover:text-green-600 transition-colors">
                <i className="fas fa-times text-[11px]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter + Search Bar ── */}
        <div className="flex flex-col sm:flex-row gap-2">

          {/* Filter Buttons — prominent clickable tabs */}
          <div className="flex gap-2 flex-shrink-0">
            {filterTabs.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap select-none ${
                  filter === f.key
                    ? 'bg-[#1e2735] text-white shadow-[0_4px_0_#38404d] active:shadow-[0_1px_0_#38404d] active:translate-y-[3px]'
                    : 'bg-white border border-gray-200 text-gray-600 shadow-[0_4px_0_#d1d5db] hover:brightness-95 active:shadow-[0_1px_0_#d1d5db] active:translate-y-[3px]'
                }`}>
                <i className={`fas fa-${f.icon} text-[11px] ${filter === f.key ? 'text-white/80' : 'text-gray-400'}`} />
                {f.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black tabular-nums min-w-[18px] text-center leading-none ${
                  filter === f.key ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
              <i className="fas fa-search text-sm" />
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อไอเท็ม, กล่อง, ระดับ..."
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white shadow-[0_3px_0_#e5e7eb]"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors">
                <i className="fas fa-times text-[11px]" />
              </button>
            )}
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl h-44 bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <i className="fas fa-box-open text-2xl text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-500">
              {search ? `ไม่พบ "${search}"` : filter === 'PENDING' ? 'ไม่มีไอเท็มรอรับ' : 'คลังว่างเปล่า'}
            </p>
            {!search && filter !== 'REDEEMED' && (
              <a href="/lootbox" className="text-xs mt-1.5 text-green-600 hover:underline font-medium">ลองเปิดกล่องสุ่มไหม?</a>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {paginated.map(item => {
                const rar       = getRarity(item.item_rarity);
                const shadow    = RARITY_SHADOW[item.item_rarity] ?? RARITY_SHADOW.common;
                const isPending = item.status === 'PENDING';

                const cardStyle = isPending
                  ? {
                      borderColor: rar.color + '55',
                      borderTopColor: rar.color,
                      borderTopWidth: '3px',
                      boxShadow: `0 4px 0 ${shadow.bottom}, 0 2px 16px ${shadow.glow}`,
                    }
                  : {
                      boxShadow: '0 3px 0 #d1d5db',
                    };

                return (
                  <div key={item.id}
                    className={`relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 ${
                      isPending ? 'bg-white border-gray-200' : 'bg-gray-50/80 border-gray-100'
                    }`}
                    style={cardStyle}
                  >
                    {/* Status badge — top right */}
                    <div className="absolute top-1.5 right-1.5 z-10">
                      {isPending ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white leading-none shadow-[0_2px_0_#b45309]">
                          <i className="fas fa-clock text-[8px]" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-gray-400 text-white leading-none shadow-[0_2px_0_#6b7280]">
                          <i className="fas fa-check text-[8px]" />
                        </span>
                      )}
                    </div>

                    {/* Image area */}
                    <div className="flex items-center justify-center pt-3 pb-2 px-2"
                      style={isPending ? { backgroundColor: rar.color + '0d' } : {}}>
                      {item.item_image ? (
                        <img src={item.item_image} alt={item.item_name}
                          className={`w-14 h-14 object-contain transition-all ${!isPending ? 'opacity-35 grayscale' : ''}`}
                          style={isPending ? { filter: `drop-shadow(0 0 6px ${rar.color}99)` } : {}}
                        />
                      ) : (
                        <i className="fas fa-cube text-4xl"
                          style={{ color: isPending ? rar.color : '#d1d5db', opacity: isPending ? 1 : 0.6,
                            ...(isPending ? { filter: `drop-shadow(0 0 6px ${shadow.glow})` } : {}) }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-2 pb-2 flex flex-col flex-1">
                      <RarityBadge rarity={item.item_rarity} />
                      <p className={`font-bold text-[12px] leading-tight line-clamp-2 mt-1 ${isPending ? 'text-gray-900' : 'text-gray-400'}`}>
                        {item.item_name}
                      </p>
                      <p className="text-[9px] text-gray-400 truncate mt-0.5">{item.box_name}</p>
                      <p className="text-[9px] text-gray-300 tabular-nums mt-0.5">
                        {new Date(item.won_at).toLocaleDateString('th-TH')}
                      </p>
                      {isPending && (
                        <button
                          onClick={() => { setRedeemModal(item); setRedeemError(''); }}
                          className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-bold text-white transition-all bg-[#16a34a] shadow-[0_3px_0_#0d6b2e] hover:brightness-110 active:shadow-none active:translate-y-[2px]"
                        >
                          <i className="fas fa-gamepad mr-1 text-[9px]" /> ส่งเข้าเกม
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-gray-400 tabular-nums">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length} ชิ้น
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-[0_3px_0_#d1d5db] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:shadow-none active:translate-y-[2px]">
                    <i className="fas fa-chevron-left text-[11px]" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                    const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                    if ((p === page - 2 && page > 3) || (p === page + 2 && page < totalPages - 2))
                      return <span key={p} className="text-gray-300 px-1 text-xs">…</span>;
                    if (!show) return null;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-all ${
                          p === page
                            ? 'bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e] active:shadow-none active:translate-y-[2px]'
                            : 'bg-white border border-gray-200 text-gray-500 shadow-[0_3px_0_#d1d5db] hover:brightness-95 active:shadow-none active:translate-y-[2px]'
                        }`}>{p}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-[0_3px_0_#d1d5db] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:shadow-none active:translate-y-[2px]">
                    <i className="fas fa-chevron-right text-[11px]" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Single Redeem Modal ── */}
      <AnimatePresence>
        {redeemModal && (() => {
          const rar = getRarity(redeemModal.item_rarity);
          const shadow = RARITY_SHADOW[redeemModal.item_rarity] ?? RARITY_SHADOW.common;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-[2px]"
              onMouseDown={e => { backdropRef.current = e.target === e.currentTarget; }}
              onMouseUp={e => { if (backdropRef.current && e.target === e.currentTarget) setRedeemModal(null); }}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.18)] border border-gray-200/80 w-full max-w-sm overflow-hidden">
                <div className="relative px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-gamepad text-green-600 text-xs" />
                  </div>
                  <div className="flex-1 text-center">
                    <h3 className="font-bold text-gray-900 text-base">ส่งไอเท็มเข้าเกม</h3>
                    <p className="text-[11px] text-gray-400">เลือกเซิร์ฟเวอร์ที่ออนไลน์อยู่</p>
                  </div>
                  <button onClick={() => setRedeemModal(null)}
                    className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-none active:translate-y-[2px]">
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{ backgroundColor: rar.color + '0d', borderColor: rar.color + '33',
                      borderTopColor: rar.color, borderTopWidth: '3px',
                      boxShadow: `0 3px 0 ${shadow.bottom}` }}>
                    {redeemModal.item_image
                      ? <img src={redeemModal.item_image} alt={redeemModal.item_name} className="w-14 h-14 object-contain flex-shrink-0" style={{ filter: `drop-shadow(0 0 6px ${rar.color}88)` }} />
                      : <i className="fas fa-cube text-3xl flex-shrink-0" style={{ color: rar.color }} />}
                    <div className="min-w-0">
                      <RarityBadge rarity={redeemModal.item_rarity} />
                      <p className="font-bold text-gray-900 text-sm leading-tight mt-1 line-clamp-2">{redeemModal.item_name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{redeemModal.box_name}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">เซิร์ฟเวอร์</label>
                    <ServerSelect servers={servers} value={selectedServer} onChange={setSelectedServer} />
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <i className="fas fa-triangle-exclamation text-amber-500 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-relaxed">คุณต้องออนไลน์อยู่ในเกมก่อนกดรับ ระบบจะส่งไอเท็มเข้าตัวละครทันที</p>
                  </div>
                  {redeemError && (
                    <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5">
                      <i className="fas fa-circle-xmark" /> {redeemError}
                    </div>
                  )}
                </div>
                <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
                  <button onClick={() => setRedeemModal(null)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-[0_1px_0_#d1d5db] active:translate-y-[2px]">
                    <i className="fas fa-times text-[12px]" /> ยกเลิก
                  </button>
                  <button onClick={handleRedeem} disabled={redeemLoading || selectedServer === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
                    {redeemLoading ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังส่ง...</> : <><i className="fas fa-gamepad text-[12px]" /> ส่งเข้าเกม</>}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── Redeem All Modal ── */}
      <AnimatePresence>
        {redeemAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-[2px]"
            onMouseDown={e => { backdropRef.current = e.target === e.currentTarget; }}
            onMouseUp={e => { if (backdropRef.current && e.target === e.currentTarget && !redeemAllLoading) setRedeemAllModal(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.18)] border border-gray-200/80 w-full max-w-sm overflow-hidden">
              <div className="relative px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-gamepad text-green-600 text-xs" />
                </div>
                <div className="flex-1 text-center">
                  <h3 className="font-bold text-gray-900 text-base">รับทั้งหมด</h3>
                  <p className="text-[11px] text-gray-400 tabular-nums">{pendingCount} ไอเท็มรอการรับ</p>
                </div>
                <button onClick={() => !redeemAllLoading && setRedeemAllModal(false)}
                  className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-none active:translate-y-[2px]">
                  <i className="fas fa-times text-xs" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">เซิร์ฟเวอร์</label>
                  <ServerSelect servers={servers} value={redeemAllServer} onChange={setRedeemAllServer} />
                </div>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <i className="fas fa-triangle-exclamation text-amber-500 text-xs mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">คุณต้องออนไลน์อยู่ในเกมก่อนรับของ ระบบจะส่งทุกไอเท็มเข้าเกมพร้อมกัน</p>
                </div>
                {redeemAllError && (
                  <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5">
                    <i className="fas fa-circle-xmark" /> {redeemAllError}
                  </div>
                )}
              </div>
              <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
                <button onClick={() => setRedeemAllModal(false)} disabled={redeemAllLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-[0_1px_0_#d1d5db] active:translate-y-[2px] disabled:opacity-50">
                  <i className="fas fa-times text-[12px]" /> ยกเลิก
                </button>
                <button onClick={handleRedeemAll} disabled={redeemAllLoading || redeemAllServer === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#16a34a] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
                  {redeemAllLoading ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังส่ง...</> : <><i className="fas fa-gamepad text-[12px]" /> ส่งทั้งหมด</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
