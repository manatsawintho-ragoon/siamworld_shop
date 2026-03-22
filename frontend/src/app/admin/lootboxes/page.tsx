'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LootBoxItem {
  id: number;
  loot_box_id: number;
  name: string;
  description?: string;
  image?: string;
  command: string;
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
  active: boolean;
  sort_order: number;
  category_id?: number | null;
  items: LootBoxItem[];
}

interface LootBoxCategory {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RARITY_ORDER   = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as const;
const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;

const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; text: string; glow: string }> = {
  common:    { label: 'Common',    color: '#64748b', bg: 'bg-slate-100',  text: 'text-slate-700',  glow: 'rgba(100,116,139,0.25)' },
  uncommon:  { label: 'Uncommon',  color: '#16a34a', bg: 'bg-green-50',   text: 'text-green-800',  glow: 'rgba(22,163,74,0.30)'   },
  rare:      { label: 'Rare',      color: '#2563eb', bg: 'bg-blue-50',    text: 'text-blue-800',   glow: 'rgba(37,99,235,0.30)'   },
  epic:      { label: 'Epic',      color: '#9333ea', bg: 'bg-purple-50',  text: 'text-purple-800', glow: 'rgba(147,51,234,0.35)'  },
  legendary: { label: 'Legendary', color: '#f97316', bg: 'bg-orange-50',  text: 'text-orange-700', glow: 'rgba(249,115,22,0.35)'  },
  mythic:    { label: 'Mythic',    color: '#dc2626', bg: 'bg-red-50',     text: 'text-red-800',    glow: 'rgba(220,38,38,0.45)'   },
};

const RARITY_WEIGHTS: Record<string, { default: number; hint: string }> = {
  common:    { default: 500, hint: '~50%   ไอเท็มทั่วไป'  },
  uncommon:  { default: 300, hint: '~30%   ไอเท็มดี'      },
  rare:      { default: 150, hint: '~15%   หายาก'         },
  epic:      { default: 40,  hint: '~4%    หายากมาก'      },
  legendary: { default: 10,  hint: '~1%    หายากที่สุด'   },
  mythic:    { default: 3,   hint: '~0.3%  หายากมากที่สุด' },
};

const TOKEN     = () => getToken()!;
const emptyBox  = (): Partial<LootBox>     => ({ name: '', description: '', image: '', price: 0, active: true, category_id: null });
const emptyItem = (id: number): Partial<LootBoxItem> => ({
  loot_box_id: id, name: '', description: '', image: '', command: '',
  weight: RARITY_WEIGHTS.common.default, rarity: 'common', color: '',
});

type ViewMode = 'grid' | 'list';
type SortKey  = 'rarity' | 'weight' | 'name';

// ─── Rarity Stats ────────────────────────────────────────────────────────────

function RarityStats({ items }: { items: LootBoxItem[] }) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (!total) return null;
  const rows = RARITY_ORDER.map(r => {
    const count  = items.filter(i => i.rarity === r).length;
    const weight = items.filter(i => i.rarity === r).reduce((s, i) => s + i.weight, 0);
    const pct    = (weight / total) * 100;
    return { r, count, pct };
  }).filter(x => x.count > 0);

  return (
    <div className="space-y-1.5 pt-1">
      {rows.map(({ r, count, pct }) => {
        const rc = RARITY_CONFIG[r];
        return (
          <div key={r} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rc.color }} />
              <span className="text-[11px] font-bold text-gray-600">{rc.label}</span>
              <span className="text-[10px] text-gray-400">({count})</span>
            </div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: rc.color }} />
            </div>
            <span className="text-[11px] font-black tabular-nums w-14 text-right flex-shrink-0" style={{ color: rc.color }}>
              {pct.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Item Grid ───────────────────────────────────────────────────────────────

function ItemGrid({ items, totalWeight, onEdit, onDelete, onViewCmd }: {
  items: LootBoxItem[]; totalWeight: number;
  onEdit: (item: LootBoxItem) => void;
  onDelete: (id: number) => void;
  onViewCmd: (d: { name: string; command: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {items.map(item => {
        const rc  = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
        const pct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
        return (
          <div key={item.id}
            className="group relative bg-white rounded-xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col hover:z-10"
            style={{
              border: `2px solid ${rc.color}99`,
              boxShadow: `0 2px 10px ${rc.glow}, 0 1px 3px rgba(0,0,0,0.06)`,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px ${rc.glow}, 0 2px 8px rgba(0,0,0,0.10)`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 10px ${rc.glow}, 0 1px 3px rgba(0,0,0,0.06)`; }}
            onClick={() => onEdit(item)}
          >
            {/* Image area with rarity gradient */}
            <div className="relative pt-4 pb-3 px-3 flex flex-col items-center flex-shrink-0"
              style={{ background: item.rarity === 'mythic'
                ? `radial-gradient(ellipse at center, ${rc.color}40 0%, #1a0008 100%)`
                : `radial-gradient(ellipse at center, ${rc.color}38 0%, ${rc.color}08 100%)` }}>
              {/* Info icon — top left (RCON command) */}
              <button
                className="absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] z-10 transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: rc.color, border: `2px solid ${rc.color}cc`, color: '#fff', boxShadow: `0 2px 8px ${rc.color}80` }}
                onClick={e => { e.stopPropagation(); onViewCmd({ name: item.name, command: item.command || '' }); }}
                title="ดู RCON Command"
              >
                <i className="fas fa-terminal text-[8px]" />
              </button>
              {/* โอกาส badge — top right, subtle dark */}
              <div className="absolute top-2 right-2 z-10">
                <div className="px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                  <p className="text-[10px] font-black leading-none tabular-nums text-white">โอกาส {pct.toFixed(2)}%</p>
                </div>
              </div>
              {/* Item image with glow frame */}
              <div className="w-16 h-16 flex items-center justify-center mt-1 rounded-xl p-1 relative"
                style={{ backgroundColor: rc.color + '18', boxShadow: `0 0 16px ${rc.color}50, inset 0 0 8px ${rc.color}20`, border: `1px solid ${rc.color}44` }}>
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-contain" style={{ filter: `drop-shadow(0 2px 6px ${rc.color}88)` }} />
                  : <i className="fas fa-cube text-3xl" style={{ color: rc.color, filter: `drop-shadow(0 2px 6px ${rc.color}88)` }} />
                }
              </div>
            </div>
            {/* Info area */}
            <div className="px-2.5 pt-2 pb-2 flex-1">
              <span
                className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md text-white leading-none mb-1"
                style={{ backgroundColor: rc.color, boxShadow: `0 1px 0 ${rc.color}88` }}
              >
                <span className="w-1 h-1 rounded-sm bg-white/60 flex-shrink-0" />
                {rc.label}
              </span>
              <p className="text-[12px] font-bold text-gray-800 leading-tight line-clamp-2">{item.name}</p>
              {item.description && (
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.description}</p>
              )}
            </div>
            {/* Colored bottom accent */}
            <div className="h-2 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${rc.color}88, ${rc.color}, ${rc.color}88)` }} />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gray-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 px-3">
              <button onClick={e => { e.stopPropagation(); onEdit(item); }}
                className="w-full h-8 rounded-lg bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-px transition-all">
                <i className="fas fa-pen text-[9px]" /> แก้ไขไอเท็ม
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                className="w-full h-7 rounded-lg bg-red-500 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-px transition-all">
                <i className="fas fa-trash text-[9px]" /> ลบ
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Item List ───────────────────────────────────────────────────────────────

function ItemList({ items, totalWeight, onEdit, onDelete, onViewCmd }: {
  items: LootBoxItem[]; totalWeight: number;
  onEdit: (item: LootBoxItem) => void;
  onDelete: (id: number) => void;
  onViewCmd: (d: { name: string; command: string }) => void;
}) {
  return (
    <div className="space-y-1.5">
      {items.map(item => {
        const rc  = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
        const pct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
        return (
          <div key={item.id}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white transition-all group"
            style={{ border: `1.5px solid ${rc.color}55`, borderLeft: `4px solid ${rc.color}`, boxShadow: `0 1px 6px ${rc.glow}` }}
          >
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: rc.color + '14' }}>
              {item.image
                ? <img src={item.image} alt={item.name} className="w-full h-full object-contain rounded-lg" />
                : <i className="fas fa-cube text-sm" style={{ color: rc.color }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-[10px] text-gray-400 truncate mt-0.5">
                {item.description || <span className="font-mono">{item.command}</span>}
              </p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0 text-white"
              style={{ backgroundColor: rc.color }}>{rc.label}</span>
            <div className="w-24 flex-shrink-0 hidden lg:block">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: rc.color }} />
                </div>
                <span className="text-[11px] font-bold tabular-nums w-9 text-right" style={{ color: rc.color }}>{pct.toFixed(1)}%</span>
              </div>
              <p className="text-[9px] text-gray-400 text-right mt-0.5">W:{item.weight}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onViewCmd({ name: item.name, command: item.command || '' })}
                className="w-7 h-7 rounded-lg bg-blue-500 border border-blue-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#1d4ed8] hover:brightness-110 active:translate-y-px transition-all">
                <i className="fas fa-terminal" />
              </button>
              <button onClick={() => onEdit(item)}
                className="w-7 h-7 rounded-lg bg-amber-500 border border-amber-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-px transition-all">
                <i className="fas fa-pen" />
              </button>
              <button onClick={() => onDelete(item.id)}
                className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-px transition-all">
                <i className="fas fa-trash" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminLootBoxes() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [boxes,      setBoxes]      = useState<LootBox[]>([]);
  const [categories, setCategories] = useState<LootBoxCategory[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [boxModal,   setBoxModal]   = useState<Partial<LootBox> | null>(null);
  const [boxSaving,  setBoxSaving]  = useState(false);
  const [boxError,   setBoxError]   = useState('');

  const [catModal,   setCatModal]   = useState(false);

  const [activeBox,  setActiveBox]  = useState<LootBox | null>(null);
  const [itemModal,         setItemModal]         = useState<Partial<LootBoxItem> | null>(null);
  const [itemOriginalWeight, setItemOriginalWeight] = useState(0);
  const [itemSaving,        setItemSaving]        = useState(false);
  const [itemError,         setItemError]         = useState('');

  const [itemSearch,    setItemSearch]    = useState('');
  const [rarityFilter,  setRarityFilter]  = useState<string>('all');
  const [sortKey,       setSortKey]       = useState<SortKey>('rarity');
  const [viewMode,      setViewMode]      = useState<ViewMode>('grid');
  const [groupByRarity, setGroupByRarity] = useState(false);
  const [boxSearch,     setBoxSearch]     = useState('');
  const [viewingCmd,    setViewingCmd]    = useState<{ name: string; command: string } | null>(null);
  const viewingCmdBdRef = useRef(false);
  const dragBoxItem     = useRef<number | null>(null);  // stores box ID
  const dragOverBoxItem = useRef<number | null>(null);  // stores box ID

  const load = () => {
    setLoading(true);
    api('/admin/lootboxes', { token: TOKEN() })
      .then(d => {
        const all  = (d.boxes      as LootBox[])         || [];
        const cats = (d.categories as LootBoxCategory[]) || [];
        setBoxes(all);
        setCategories(cats);
        if (activeBox) {
          const updated = all.find(b => b.id === activeBox.id);
          if (updated) setActiveBox(updated);
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSaveBox = async () => {
    if (!boxModal) return;
    setBoxSaving(true); setBoxError('');
    try {
      const body = {
        name: boxModal.name,
        description: boxModal.description || null,
        image: boxModal.image || null,
        price: Number(boxModal.price),
        active: boxModal.active !== false,
        category_id: boxModal.category_id ?? null,
      };
      if (boxModal.id) await api(`/admin/lootboxes/${boxModal.id}`, { method: 'PUT', token: TOKEN(), body });
      else             await api('/admin/lootboxes', { method: 'POST', token: TOKEN(), body });
      setBoxModal(null);
      adminAlert({ title: boxModal.id ? 'แก้ไขกล่องสุ่มแล้ว' : 'สร้างกล่องสุ่มแล้ว', type: 'success' });
      load();
    } catch (err: any) { setBoxError(err?.message || 'เกิดข้อผิดพลาด'); }
    finally { setBoxSaving(false); }
  };

  const handleDeleteBox = async (id: number) => {
    if (!await adminConfirm({ title: 'ลบกล่องสุ่ม', message: 'ไอเท็มทั้งหมดภายในกล่องจะถูกลบด้วย ยืนยันการลบ?', type: 'danger', confirmLabel: 'ลบ' })) return;
    try {
      await api(`/admin/lootboxes/${id}`, { method: 'DELETE', token: TOKEN() });
      if (activeBox?.id === id) setActiveBox(null);
      adminAlert({ title: 'ลบกล่องสุ่มแล้ว', type: 'success' });
      load();
    }
    catch (err: any) { await adminAlert({ title: 'ลบไม่สำเร็จ', message: err?.message, type: 'error' }); }
  };

  const handleToggleActive = async (box: LootBox) => {
    try { await api(`/admin/lootboxes/${box.id}`, { method: 'PUT', token: TOKEN(), body: { active: !box.active } }); load(); } catch { }
  };

  const handleSaveItem = async () => {
    if (!itemModal || !activeBox) return;
    // Client-side validation
    if (!itemModal.name?.trim())    { setItemError('กรุณาใส่ชื่อไอเท็ม'); return; }
    if (!itemModal.command?.trim()) { setItemError('กรุณาใส่คำสั่ง RCON (command)'); return; }
    if (!itemModal.weight || Number(itemModal.weight) < 1) { setItemError('น้ำหนักต้องมากกว่า 0'); return; }
    setItemSaving(true); setItemError('');
    try {
      const body = { name: itemModal.name, description: itemModal.description || null, image: itemModal.image || null, command: itemModal.command, weight: Number(itemModal.weight), rarity: itemModal.rarity || 'common', color: itemModal.color || null };
      if (itemModal.id) await api(`/admin/lootboxes/items/${itemModal.id}`, { method: 'PUT', token: TOKEN(), body });
      else              await api(`/admin/lootboxes/${activeBox.id}/items`, { method: 'POST', token: TOKEN(), body });
      setItemModal(null);
      adminAlert({ title: itemModal.id ? 'แก้ไขไอเท็มแล้ว' : 'เพิ่มไอเท็มแล้ว', type: 'success' });
      load();
    } catch (err: any) { setItemError(err?.message || 'เกิดข้อผิดพลาด'); }
    finally { setItemSaving(false); }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!await adminConfirm({ title: 'ลบไอเท็ม', message: 'ต้องการลบไอเท็มนี้?', type: 'danger', confirmLabel: 'ลบ' })) return;
    try {
      await api(`/admin/lootboxes/items/${itemId}`, { method: 'DELETE', token: TOKEN() });
      adminAlert({ title: 'ลบไอเท็มแล้ว', type: 'success' });
      load();
    }
    catch (err: any) { await adminAlert({ title: 'ลบไม่สำเร็จ', message: err?.message, type: 'error' }); }
  };

  const filteredItems = useMemo(() => {
    if (!activeBox) return [];
    let items = [...activeBox.items];
    if (itemSearch.trim()) { const q = itemSearch.toLowerCase(); items = items.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)); }
    if (rarityFilter !== 'all') items = items.filter(i => i.rarity === rarityFilter);
    if (sortKey === 'name')        items.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    else if (sortKey === 'weight') items.sort((a, b) => b.weight - a.weight);
    else items.sort((a, b) => RARITY_ORDER.indexOf(a.rarity as any) - RARITY_ORDER.indexOf(b.rarity as any));
    return items;
  }, [activeBox, itemSearch, rarityFilter, sortKey]);

  const rarityCounts  = useMemo(() => {
    if (!activeBox) return {} as Record<string, number>;
    return RARITY_OPTIONS.reduce((acc, r) => { acc[r] = activeBox.items.filter(i => i.rarity === r).length; return acc; }, {} as Record<string, number>);
  }, [activeBox]);

  const totalWeight   = useMemo(() => activeBox?.items.reduce((s, i) => s + i.weight, 0) ?? 0, [activeBox]);
  const filteredBoxes = boxes.filter(b => b.name.toLowerCase().includes(boxSearch.toLowerCase()));

  // Group filtered boxes by category for sidebar display
  const groupedBoxes = useMemo(() => {
    const groups = categories.map(cat => ({
      category: cat,
      boxes: filteredBoxes.filter(b => b.category_id === cat.id),
    })).filter(g => g.boxes.length > 0);
    const uncategorized = filteredBoxes.filter(b => !b.category_id);
    return { groups, uncategorized };
  }, [categories, filteredBoxes]);

  // Drag uses box.id instead of array index (works correctly when filtered/grouped)
  const handleBoxDragStart = (boxId: number) => { dragBoxItem.current = boxId; };
  const handleBoxDragEnter = (boxId: number) => { dragOverBoxItem.current = boxId; };
  const handleBoxDragEnd   = async () => {
    if (dragBoxItem.current === null || dragOverBoxItem.current === null || dragBoxItem.current === dragOverBoxItem.current) {
      dragBoxItem.current = null; dragOverBoxItem.current = null; return;
    }
    const reordered = [...boxes];
    const fromIdx = reordered.findIndex(b => b.id === dragBoxItem.current);
    const toIdx   = reordered.findIndex(b => b.id === dragOverBoxItem.current);
    if (fromIdx === -1 || toIdx === -1) { dragBoxItem.current = null; dragOverBoxItem.current = null; return; }
    const [dragged] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, dragged);
    const withOrder = reordered.map((b, i) => ({ ...b, sort_order: i }));
    setBoxes(withOrder);
    dragBoxItem.current = null; dragOverBoxItem.current = null;
    try {
      await api('/admin/lootboxes/reorder', { method: 'PUT', token: TOKEN(), body: { order: withOrder.map(b => ({ id: b.id, sort_order: b.sort_order })) } });
    } catch { load(); }
  };

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 136px)' }}>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-box-open text-[#f97316]" /> จัดการกล่องสุ่ม
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">สร้างกล่อง Gacha · เพิ่มไอเท็ม · กำหนดน้ำหนักการสุ่ม</p>
        </div>
        {/* Summary pills */}
        <div className="hidden md:flex items-center gap-2">
          {[
            { v: boxes.length,                                     label: 'กล่องทั้งหมด', icon: 'fa-box',        color: 'text-orange-500', bg: 'bg-orange-50' },
            { v: boxes.reduce((s, b) => s + b.items.length, 0),   label: 'ไอเท็มรวม',    icon: 'fa-cubes',      color: 'text-blue-500',   bg: 'bg-blue-50'   },
            { v: boxes.filter(b => b.active).length,               label: 'เปิดขาย',     icon: 'fa-circle-dot', color: 'text-green-500',  bg: 'bg-green-50'  },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-white border border-gray-200/70 rounded-xl px-3 py-2 shadow-[0_2px_0_#e5e7eb]">
              <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                <i className={`fas ${s.icon} ${s.color} text-xs`} />
              </div>
              <div>
                <p className="text-sm font-black text-gray-800 tabular-nums leading-none">{s.v}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-pane ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Left: Box List ─────────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 bg-white overflow-hidden">

          {/* Sidebar header */}
          <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-boxes-stacked text-orange-500 text-xs" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">กล่องสุ่ม</p>
                <p className="text-[10px] text-gray-400">{boxes.length} กล่อง · {categories.length} หมวดหมู่</p>
              </div>
              <button
                onClick={() => setCatModal(true)}
                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 text-[10px] shadow-[0_2px_0_#e5e7eb] hover:bg-gray-50 transition-all"
                title="จัดการหมวดหมู่"
              >
                <i className="fas fa-tags" />
              </button>
              <button
                onClick={() => { setBoxError(''); setBoxModal(emptyBox()); }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#16a34a] text-white text-[11px] font-bold rounded-lg shadow-[0_3px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d6b2e] active:translate-y-px"
              >
                <i className="fas fa-plus text-[10px]" /> สร้าง
              </button>
            </div>
            <div className="relative">
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]" />
              <input
                value={boxSearch} onChange={e => setBoxSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                placeholder="ค้นหากล่อง..."
              />
            </div>
          </div>

          {/* Box list scroll */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 bg-[#f4f5f7]">
            {loading && (
              <div className="py-10 text-center">
                <i className="fas fa-spinner fa-spin text-lg text-orange-400" />
              </div>
            )}
            {!loading && filteredBoxes.length === 0 && (
              <div className="py-10 text-center">
                <i className="fas fa-box text-2xl text-gray-200 block mb-2" />
                <p className="text-xs text-gray-400">{boxes.length === 0 ? 'ยังไม่มีกล่องสุ่ม' : 'ไม่พบกล่องที่ค้นหา'}</p>
              </div>
            )}

            {/* Render helper — reusable box card */}
            {!loading && (() => {
              const BoxCard = (box: LootBox) => {
                const isSelected = activeBox?.id === box.id;
                const isOpen     = box.active;
                return (
                  <div
                    key={box.id}
                    draggable
                    onDragStart={() => handleBoxDragStart(box.id)}
                    onDragEnter={() => handleBoxDragEnter(box.id)}
                    onDragEnd={handleBoxDragEnd}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => { setActiveBox(isSelected ? null : box); setItemSearch(''); setRarityFilter('all'); }}
                    className={`rounded-xl transition-all group border-2 ${
                      isSelected
                        ? isOpen
                          ? 'bg-white border-[#16a34a] shadow-[0_3px_0_#86efac]'
                          : 'bg-gray-100 border-gray-400 shadow-[0_3px_0_#9ca3af]'
                        : isOpen
                          ? 'bg-white border-gray-200 shadow-[0_2px_0_#e5e7eb] hover:border-gray-300 hover:shadow-md'
                          : 'bg-gray-100 border-gray-300 shadow-[0_2px_0_#d1d5db] hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <i className="fas fa-grip-vertical text-gray-300 group-hover:text-gray-400 text-xs flex-shrink-0 transition-colors" />
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                        isSelected && isOpen ? 'border-green-200 bg-green-50'
                        : isOpen ? 'border-gray-100 bg-gray-50'
                        : 'border-gray-300 bg-gray-200'
                      }`}>
                        {box.image
                          ? <img src={box.image} alt={box.name} className={`w-full h-full object-cover rounded-lg ${!isOpen ? 'grayscale opacity-60' : ''}`} />
                          : <i className={`fas fa-box text-sm ${isSelected && isOpen ? 'text-green-400' : isOpen ? 'text-gray-300' : 'text-gray-400'}`} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`font-black text-[13px] leading-tight truncate ${
                            isSelected && isOpen ? 'text-[#16a34a]'
                            : isOpen ? 'text-gray-800'
                            : isSelected ? 'text-gray-500' : 'text-gray-400'
                          }`}>{box.name}</span>
                          {!isOpen && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-gray-300 text-gray-500 font-bold flex-shrink-0 uppercase tracking-wide">ปิด</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-nowrap">
                          <span className={`text-[12px] font-bold whitespace-nowrap flex-shrink-0 ${isOpen ? 'text-gray-700' : 'text-gray-400'}`}>
                            ฿{parseFloat(String(box.price)).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-300 flex-shrink-0">·</span>
                          <span className="text-[11px] whitespace-nowrap flex-shrink-0 text-gray-400">{box.items.length} ไอเท็ม</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setBoxError(''); setBoxModal({ ...box }); }}
                          className="cursor-pointer w-7 h-7 rounded-lg bg-amber-500 border border-amber-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-px active:shadow-none transition-all">
                          <i className="fas fa-pen text-[9px]" />
                        </button>
                        <button onClick={() => handleToggleActive(box)}
                          className={`cursor-pointer w-7 h-7 rounded-lg border flex items-center justify-center text-white text-[10px] active:translate-y-px active:shadow-none transition-all hover:brightness-110 ${box.active ? 'bg-[#16a34a] border-green-600 shadow-[0_2px_0_#0d6b2e]' : 'bg-gray-400 border-gray-500 shadow-[0_2px_0_#9ca3af]'}`}>
                          <i className={`fas ${box.active ? 'fa-eye' : 'fa-eye-slash'} text-[9px]`} />
                        </button>
                        <button onClick={() => handleDeleteBox(box.id)}
                          className="cursor-pointer w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-px active:shadow-none transition-all">
                          <i className="fas fa-trash text-[9px]" />
                        </button>
                      </div>
                    </div>
                    {box.items.length > 0 && (
                      <div className="mx-3 mb-2">
                        <div className={`flex h-1 rounded-full overflow-hidden gap-px ${isOpen ? 'bg-gray-100' : 'bg-gray-200'}`}>
                          {RARITY_ORDER.map(r => {
                            const w = box.items.filter(i => i.rarity === r).reduce((s, i) => s + i.weight, 0);
                            const t = box.items.reduce((s, i) => s + i.weight, 0);
                            if (!w || !t) return null;
                            return <div key={r} style={{ width: `${(w / t) * 100}%`, backgroundColor: isOpen ? RARITY_CONFIG[r].color : '#9ca3af' }} />;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="space-y-1.5">
                  {/* Grouped by category */}
                  {groupedBoxes.groups.map(({ category, boxes: catBoxes }) => (
                    <div key={category.id}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 px-1.5 pt-1 pb-0.5 mb-1">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black text-white flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        >
                          <i className="fas fa-layer-group text-[8px] opacity-80" />
                          {category.name}
                        </span>
                        <span className="text-[10px] text-gray-400">{catBoxes.length}</span>
                        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${category.color}55, transparent)` }} />
                      </div>
                      <div className="space-y-1.5">
                        {catBoxes.map(box => BoxCard(box))}
                      </div>
                    </div>
                  ))}

                  {/* Uncategorized */}
                  {groupedBoxes.uncategorized.length > 0 && (
                    <div>
                      {groupedBoxes.groups.length > 0 && (
                        <div className="flex items-center gap-2 px-1.5 pt-1 pb-0.5 mb-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-gray-300 text-gray-600 flex-shrink-0">
                            <i className="fas fa-inbox text-[8px] opacity-80" />
                            ไม่มีหมวดหมู่
                          </span>
                          <span className="text-[10px] text-gray-400">{groupedBoxes.uncategorized.length}</span>
                          <div className="flex-1 h-px bg-gradient-to-r from-gray-300/50 to-transparent" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {groupedBoxes.uncategorized.map(box => BoxCard(box))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Right: Item Manager ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 bg-white overflow-hidden">

          {!activeBox ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                <i className="fas fa-hand-pointer text-2xl text-gray-200" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-400">เลือกกล่องสุ่มทางซ้าย</p>
                <p className="text-xs text-gray-300 mt-1">เพื่อจัดการไอเท็มภายในกล่อง</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Panel header ── */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
                {/* Row A: image · name · badge · price · items · [add button] */}
                <div className="flex items-center gap-3">
                  {/* Box image */}
                  <div className="w-11 h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-[0_2px_0_#e5e7eb]">
                    {activeBox.image
                      ? <img src={activeBox.image} alt="" className="w-full h-full object-cover" />
                      : <i className="fas fa-box text-gray-300" />}
                  </div>

                  {/* Text block */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 text-[17px] leading-tight truncate">{activeBox.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[14px] font-black text-gray-800">฿{parseFloat(String(activeBox.price)).toLocaleString()}</span>
                      <span className="text-gray-300 text-[10px]">·</span>
                      <span className="text-[12px] text-gray-400">{activeBox.items.length} ไอเท็ม</span>
                    </div>
                  </div>

                  {/* Add item button */}
                  <button
                    onClick={() => { setItemError(''); setItemOriginalWeight(0); setItemModal(emptyItem(activeBox.id)); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#16a34a] text-white text-xs font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d6b2e] active:translate-y-[2px] flex-shrink-0"
                  >
                    <i className="fas fa-plus text-[10px]" /> เพิ่มไอเท็ม
                  </button>
                </div>
              </div>

              {/* ── Toolbar ── */}
              <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0 space-y-2">
                {/* Row 1: search (left) + sort · view · group (right) */}
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative w-48">
                    <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]" />
                    <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                      className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                      placeholder={`ค้นหาไอเท็ม...`}
                    />
                    {itemSearch && (
                      <button onClick={() => setItemSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-[10px]">
                        <i className="fas fa-times" />
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

                  {/* Sort */}
                  <div className="relative flex-shrink-0">
                    <i className="fas fa-sort absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[9px] pointer-events-none" />
                    <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                      className="pl-6 pr-2 py-1.5 text-[11px] font-medium border border-gray-200 rounded-lg focus:outline-none focus:border-[#637469] text-gray-600 bg-white appearance-none cursor-pointer">
                      <option value="rarity">Rarity</option>
                      <option value="weight">โอกาส</option>
                      <option value="name">A-Z</option>
                    </select>
                  </div>

                  {/* View mode toggle */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 shadow-[0_2px_0_#e5e7eb]">
                    <button onClick={() => setViewMode('grid')} title="Grid"
                      className={`w-7 h-7 flex items-center justify-center text-[11px] transition-colors ${viewMode === 'grid' ? 'bg-[#1e2735] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                      <i className="fas fa-th-large" />
                    </button>
                    <button onClick={() => setViewMode('list')} title="List"
                      className={`w-7 h-7 flex items-center justify-center text-[11px] border-l border-gray-200 transition-colors ${viewMode === 'list' ? 'bg-[#1e2735] text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                      <i className="fas fa-list" />
                    </button>
                  </div>

                  {/* Group toggle */}
                  <button onClick={() => setGroupByRarity(!groupByRarity)} title="จัดกลุ่มตาม Rarity"
                    className={`w-7 h-7 flex items-center justify-center text-[11px] rounded-lg border transition-all flex-shrink-0 shadow-[0_2px_0_#e5e7eb] ${groupByRarity ? 'bg-[#1e2735] text-white border-[#1e2735] shadow-[0_2px_0_#38404d]' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
                    <i className="fas fa-layer-group" />
                  </button>

                  {/* Result count */}
                  <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
                    {filteredItems.length !== activeBox.items.length
                      ? <><span className="font-bold text-gray-600">{filteredItems.length}</span>/{activeBox.items.length}</>
                      : <><span className="font-bold text-gray-600">{filteredItems.length}</span> รายการ</>}
                  </span>
                </div>

                {/* Row 2: rarity filter chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => setRarityFilter('all')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border-2 transition-all ${rarityFilter === 'all' ? 'bg-[#1e2735] text-white border-[#1e2735] shadow-[0_2px_0_#38404d]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                    <i className="fas fa-th text-[9px]" />
                    ทั้งหมด
                    <span className={`text-[9px] px-1 py-0.5 rounded font-black ${rarityFilter === 'all' ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{activeBox.items.length}</span>
                  </button>
                  {RARITY_ORDER.map(r => {
                    const count = rarityCounts[r] || 0;
                    if (!count) return null;
                    const rc       = RARITY_CONFIG[r];
                    const isActive = rarityFilter === r;
                    return (
                      <button key={r} onClick={() => setRarityFilter(isActive ? 'all' : r)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border-2 transition-all"
                        style={isActive
                          ? { backgroundColor: rc.color, borderColor: rc.color, color: '#fff', boxShadow: `0 2px 0 ${rc.color}88` }
                          : { backgroundColor: rc.color + '10', borderColor: rc.color + '55', color: rc.color }
                        }>
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : rc.color }} />
                        {rc.label}
                        <span className="text-[9px] px-1 py-0.5 rounded font-black"
                          style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : rc.color + '22', color: isActive ? '#fff' : rc.color }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Rarity stats */}
                {activeBox.items.length > 0 && rarityFilter === 'all' && !itemSearch && (
                  <RarityStats items={activeBox.items} />
                )}
              </div>

              {/* ── Items area (scrollable) ── */}
              <div className="flex-1 overflow-y-auto p-3 bg-[#f8f9fa]">
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-gray-300 gap-3">
                    <i className="fas fa-cube text-4xl" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-400">
                        {activeBox.items.length === 0 ? 'ยังไม่มีไอเท็ม' : 'ไม่พบไอเท็มที่ค้นหา'}
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        {activeBox.items.length === 0 ? 'กด "เพิ่มไอเท็ม" เพื่อเริ่ม' : 'ลองเปลี่ยนเงื่อนไขการค้นหา'}
                      </p>
                    </div>
                  </div>
                ) : groupByRarity ? (
                  <div className="space-y-5">
                    {RARITY_ORDER.map(r => {
                      const group = filteredItems.filter(i => i.rarity === r);
                      if (!group.length) return null;
                      const rc         = RARITY_CONFIG[r];
                      const groupPct   = totalWeight > 0 ? ((group.reduce((s, i) => s + i.weight, 0) / totalWeight) * 100).toFixed(1) : '0';
                      return (
                        <div key={r}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-white flex-shrink-0"
                              style={{ backgroundColor: rc.color, borderColor: rc.color + 'cc', boxShadow: `0 2px 0 ${rc.color}66` }}>
                              <span className="w-1.5 h-1.5 rounded-sm bg-white/60" />
                              <span className="text-[10px] font-black uppercase tracking-wide">{rc.label}</span>
                              <span className="text-[9px] px-1 rounded font-black bg-white/20">{group.length}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">{groupPct}% โอกาส</span>
                            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${rc.color}44, transparent)` }} />
                          </div>
                          {viewMode === 'grid'
                            ? <ItemGrid items={group} totalWeight={totalWeight} onEdit={i => { setItemError(''); setItemOriginalWeight(i.weight); setItemModal({ ...i }); }} onDelete={handleDeleteItem} onViewCmd={setViewingCmd} />
                            : <ItemList items={group} totalWeight={totalWeight} onEdit={i => { setItemError(''); setItemOriginalWeight(i.weight); setItemModal({ ...i }); }} onDelete={handleDeleteItem} onViewCmd={setViewingCmd} />
                          }
                        </div>
                      );
                    })}
                  </div>
                ) : viewMode === 'grid' ? (
                  <ItemGrid items={filteredItems} totalWeight={totalWeight}
                    onEdit={i => { setItemError(''); setItemOriginalWeight(i.weight); setItemModal({ ...i }); }} onDelete={handleDeleteItem} onViewCmd={setViewingCmd} />
                ) : (
                  <ItemList items={filteredItems} totalWeight={totalWeight}
                    onEdit={i => { setItemError(''); setItemOriginalWeight(i.weight); setItemModal({ ...i }); }} onDelete={handleDeleteItem} onViewCmd={setViewingCmd} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {catModal && typeof window !== 'undefined' && createPortal(
        <CategoryModal categories={categories} onClose={() => setCatModal(false)} onRefresh={load} />,
        document.body
      )}
      {boxModal && typeof window !== 'undefined' && createPortal(
        <BoxModal box={boxModal} categories={categories} saving={boxSaving} error={boxError} onChange={setBoxModal} onSave={handleSaveBox} onClose={() => { if (!boxSaving) setBoxModal(null); }} />,
        document.body
      )}
      {itemModal && activeBox && typeof window !== 'undefined' && createPortal(
        <ItemModal item={itemModal} saving={itemSaving} error={itemError} totalWeight={totalWeight} originalWeight={itemOriginalWeight} onChange={setItemModal} onSave={handleSaveItem} onClose={() => { if (!itemSaving) setItemModal(null); }} />,
        document.body
      )}
      {viewingCmd && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onMouseDown={e => { viewingCmdBdRef.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (viewingCmdBdRef.current && e.target === e.currentTarget) setViewingCmd(null); }}
        >
          <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-terminal text-green-400 text-xs" />
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-sm">{viewingCmd.name}</h3>
                <p className="text-[11px] text-gray-400">RCON Command</p>
              </div>
              <button onClick={() => setViewingCmd(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] hover:brightness-110 transition-all">
                <i className="fas fa-times text-xs" />
              </button>
            </div>
            <div className="p-5">
              <pre className="bg-gray-900 text-green-400 text-sm font-mono p-4 rounded-xl whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">{viewingCmd.command}</pre>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Box Modal ───────────────────────────────────────────────────────────────

function BoxModal({ box, categories, saving, error, onChange, onSave, onClose }: {
  box: Partial<LootBox>; categories: LootBoxCategory[]; saving: boolean; error: string;
  onChange: (b: Partial<LootBox>) => void; onSave: () => void; onClose: () => void;
}) {
  const bdRef = useRef(false);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onMouseDown={e => { bdRef.current = e.target === e.currentTarget; }}
      onMouseUp={e => { if (bdRef.current && e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-box-open text-orange-500 text-sm" />
          </div>
          <div className="flex-1 text-center">
            <h3 className="font-bold text-gray-900">{box.id ? 'แก้ไขกล่องสุ่ม' : 'สร้างกล่องสุ่มใหม่'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{box.id ? 'แก้ไขรายละเอียดและราคา' : 'ตั้งค่าราคาและรายละเอียดกล่อง'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] hover:brightness-110 transition-all flex-shrink-0">
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="text-red-600 text-xs bg-red-50 px-3 py-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
              <i className="fas fa-exclamation-circle" /> {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อกล่อง <span className="text-red-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><i className="fas fa-box text-sm" /></div>
              <input value={box.name || ''} onChange={e => onChange({ ...box, name: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                placeholder="ชื่อกล่อง..." />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">ราคา (฿) <span className="text-red-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><i className="fas fa-coins text-sm" /></div>
              <input type="number" value={box.price ?? ''} onChange={e => onChange({ ...box, price: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 transition-colors" placeholder="0" />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">URL รูปภาพ</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><i className="fas fa-image text-sm" /></div>
                <input value={box.image || ''} onChange={e => onChange({ ...box, image: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors" placeholder="https://..." />
              </div>
              {box.image && (
                <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0 bg-gray-50 overflow-hidden">
                  <img src={box.image} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">หมวดหมู่</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onChange({ ...box, category_id: null })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all ${
                  !box.category_id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-inbox text-[9px]" /> ไม่มีหมวดหมู่
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onChange({ ...box, category_id: cat.id })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all text-white`}
                  style={
                    box.category_id === cat.id
                      ? { backgroundColor: cat.color, borderColor: cat.color, boxShadow: `0 2px 0 ${cat.color}88` }
                      : { backgroundColor: cat.color + '22', borderColor: cat.color + '66', color: cat.color }
                  }
                >
                  <i className="fas fa-layer-group text-[9px]" /> {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">คำอธิบาย</label>
            <textarea value={box.description || ''} onChange={e => onChange({ ...box, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 resize-none transition-colors"
              rows={2} placeholder="คำอธิบายสั้นๆ..." />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all">
            <i className="fas fa-times text-xs" /> ยกเลิก
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]">
            {saving ? <><i className="fas fa-spinner fa-spin text-xs" /> บันทึก...</> : <><i className="fas fa-save text-xs" /> บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Modal ──────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#dc2626', '#f97316', '#eab308', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#db2777', '#64748b', '#1e2735',
];

function CategoryModal({ categories, onClose, onRefresh }: {
  categories: LootBoxCategory[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [list,    setList]    = useState<LootBoxCategory[]>(categories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[4]);
  const [adding,  setAdding]  = useState(false);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [saving,  setSaving]  = useState(false);
  const bdRef    = useRef(false);
  const dragIdx  = useRef<number | null>(null);

  const handleReorder = async (reordered: LootBoxCategory[]) => {
    setList(reordered);
    try {
      await api('/admin/lootboxes/categories/reorder', { method: 'PUT', token: getToken()!, body: { order: reordered.map(c => c.id) } });
      onRefresh();
    } catch { /* revert will happen on next load */ }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api('/admin/lootboxes/categories', { method: 'POST', token: getToken()!, body: { name: newName.trim(), color: newColor } });
      setNewName(''); setAdding(false); onRefresh();
      adminAlert({ title: 'เพิ่มหมวดหมู่แล้ว', type: 'success' });
      const d = await api('/admin/lootboxes/categories', { token: getToken()! });
      setList((d.categories as LootBoxCategory[]) || []);
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: number) => {
    setSaving(true);
    try {
      await api(`/admin/lootboxes/categories/${id}`, { method: 'PUT', token: getToken()!, body: { name: editName.trim(), color: editColor } });
      setEditId(null); onRefresh();
      adminAlert({ title: 'แก้ไขหมวดหมู่แล้ว', type: 'success' });
      const d = await api('/admin/lootboxes/categories', { token: getToken()! });
      setList((d.categories as LootBoxCategory[]) || []);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!await adminConfirm({ title: 'ลบหมวดหมู่', message: 'กล่องในหมวดหมู่นี้จะถูกย้ายไปไม่มีหมวดหมู่ ยืนยัน?', type: 'danger', confirmLabel: 'ลบ' })) return;
    try {
      await api(`/admin/lootboxes/categories/${id}`, { method: 'DELETE', token: getToken()! });
      onRefresh();
      adminAlert({ title: 'ลบหมวดหมู่แล้ว', type: 'success' });
      setList(list.filter(c => c.id !== id));
    } catch (e: any) { await adminAlert({ title: 'ลบไม่สำเร็จ', message: e?.message, type: 'error' }); }
  };

  const startEdit = (cat: LootBoxCategory) => {
    setEditId(cat.id); setEditName(cat.name); setEditColor(cat.color);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onMouseDown={e => { bdRef.current = e.target === e.currentTarget; }}
      onMouseUp={e => { if (bdRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-tags text-violet-500 text-sm" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">จัดการหมวดหมู่</h3>
            <p className="text-xs text-gray-400 mt-0.5">สร้าง แก้ไข และลบหมวดหมู่กล่องสุ่ม</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all">
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {list.length === 0 && !adding && (
            <div className="py-6 text-center text-gray-400 text-xs">ยังไม่มีหมวดหมู่</div>
          )}

          {list.map((cat, idx) => (
            <div key={cat.id}
              draggable={editId !== cat.id}
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                const from = dragIdx.current;
                if (from === null || from === idx) return;
                const next = [...list];
                next.splice(idx, 0, next.splice(from, 1)[0]);
                dragIdx.current = null;
                handleReorder(next);
              }}
            >
              {editId === cat.id ? (
                /* Edit mode */
                <div className="flex flex-col gap-2 p-3 rounded-xl border-2 border-dashed" style={{ borderColor: editColor + '88' }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    placeholder="ชื่อหมวดหมู่..." autoFocus />
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${editColor === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                      className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer p-0 overflow-hidden" title="สีกำหนดเอง" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                    <button onClick={() => handleUpdate(cat.id)} disabled={saving || !editName.trim()}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[#16a34a] text-white font-bold shadow-[0_2px_0_#0d6b2e] hover:brightness-110 disabled:opacity-50">
                      {saving ? 'บันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group active:opacity-70">
                  <i className="fas fa-grip-vertical text-gray-300 group-hover:text-gray-400 text-sm flex-shrink-0 transition-colors" />
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-sm font-bold text-gray-800">{cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(cat)}
                      className="w-7 h-7 rounded-lg bg-amber-500 border border-amber-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#b45309] hover:brightness-110 transition-all">
                      <i className="fas fa-pen text-[9px]" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)}
                      className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white text-[10px] shadow-[0_2px_0_#b91c1c] hover:brightness-110 transition-all">
                      <i className="fas fa-trash text-[9px]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new category */}
          {adding ? (
            <div className="flex flex-col gap-2 p-3 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/30">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                placeholder="ชื่อหมวดหมู่ เช่น S-Tier, Premium..." autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newColor === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                  className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer p-0 overflow-hidden" title="สีกำหนดเอง" />
              </div>
              {/* Preview */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">ตัวอย่าง:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black text-white" style={{ backgroundColor: newColor }}>
                  <i className="fas fa-layer-group text-[8px] opacity-80" />
                  {newName || 'ชื่อหมวดหมู่'}
                </span>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setAdding(false); setNewName(''); }} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                <button onClick={handleAdd} disabled={saving || !newName.trim()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#16a34a] text-white font-bold shadow-[0_2px_0_#0d6b2e] hover:brightness-110 disabled:opacity-50">
                  {saving ? 'กำลังสร้าง...' : 'สร้างหมวดหมู่'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/30 transition-all">
              <i className="fas fa-plus" /> เพิ่มหมวดหมู่ใหม่
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Item Modal ──────────────────────────────────────────────────────────────

function ItemModal({ item, saving, error, totalWeight, originalWeight, onChange, onSave, onClose }: {
  item: Partial<LootBoxItem>; saving: boolean; error: string;
  totalWeight: number; originalWeight: number;
  onChange: (i: Partial<LootBoxItem>) => void; onSave: () => void; onClose: () => void;
}) {
  const r  = item.rarity || 'common';
  const rc = RARITY_CONFIG[r];
  const rw = RARITY_WEIGHTS[r];
  const bdRef = useRef(false);

  // Live probability: weight of all OTHER items + this item's new weight
  const newWeight    = Number(item.weight) || 0;
  const otherWeight  = totalWeight - originalWeight;
  const livePct      = newWeight > 0 ? (newWeight / (otherWeight + newWeight)) * 100 : 0;
  const pctColor     = livePct >= 40 ? '#16a34a' : livePct >= 15 ? '#f97316' : livePct >= 5 ? '#3b82f6' : livePct >= 1 ? '#8b5cf6' : '#ef4444';

  const handleRarityClick = (rarity: string) => {
    onChange({ ...item, rarity: rarity as LootBoxItem['rarity'], weight: RARITY_WEIGHTS[rarity].default });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onMouseDown={e => { bdRef.current = e.target === e.currentTarget; }}
      onMouseUp={e => { if (bdRef.current && e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.2)] w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-cube text-orange-500 text-sm" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">{item.id ? 'แก้ไขไอเท็ม' : 'เพิ่มไอเท็มใหม่'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">กำหนด Rarity · น้ำหนัก · คำสั่ง RCON</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] hover:brightness-110 transition-all flex-shrink-0">
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="text-red-600 text-xs bg-red-50 px-3 py-2.5 rounded-lg border border-red-100 flex items-center gap-1.5 mb-4">
              <i className="fas fa-exclamation-circle" /> {error}
            </div>
          )}

          {/* Item name — full width */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อไอเท็ม <span className="text-red-400">*</span></label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><i className="fas fa-tag text-sm" /></div>
              <input value={item.name || ''} onChange={e => onChange({ ...item, name: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                placeholder="ชื่อไอเท็ม..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Left: Rarity picker */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                Rarity
                <span className="ml-1.5 font-normal text-gray-400">— กดเพื่อตั้งน้ำหนักอัตโนมัติ</span>
              </label>
              <div className="space-y-1.5">
                {RARITY_OPTIONS.map(rOpt => {
                  const cfg    = RARITY_CONFIG[rOpt];
                  const rOpt_w = RARITY_WEIGHTS[rOpt];
                  const isOn   = r === rOpt;
                  return (
                    <button key={rOpt} onClick={() => handleRarityClick(rOpt)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-left hover:scale-[1.01]"
                      style={isOn
                        ? { backgroundColor: cfg.color, borderColor: cfg.color, color: '#fff', boxShadow: `0 3px 0 ${cfg.color}88` }
                        : { borderColor: '#e5e7eb', backgroundColor: '#f9fafb', color: '#6b7280' }
                      }>
                      <span className="w-3 h-3 rounded-full flex-shrink-0 border-2"
                        style={{ backgroundColor: isOn ? '#fff' : cfg.color, borderColor: isOn ? '#ffffff66' : cfg.color + '44' }} />
                      <span className="flex-1 text-left">
                        <span className="block font-bold text-[12px]">{cfg.label}</span>
                        <span className="font-normal text-[10px]" style={{ opacity: isOn ? 0.8 : undefined, color: isOn ? undefined : '#9ca3af' }}>
                          {rOpt_w.hint}
                        </span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                        style={isOn
                          ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }
                          : { backgroundColor: cfg.color + '18', color: cfg.color }}>
                        W:{rOpt_w.default}
                      </span>
                      {isOn && <i className="fas fa-check-circle text-[12px] flex-shrink-0" style={{ color: '#fff' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Weight + Image + Desc + RCON */}
            <div className="space-y-4">

              {/* Weight */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">น้ำหนัก (Weight) <span className="text-red-400">*</span></label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"><i className="fas fa-weight-hanging text-sm" /></div>
                  <input type="number" value={item.weight ?? ''} onChange={e => onChange({ ...item, weight: Number(e.target.value) })}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{ borderColor: rc.color + '88' }}
                    onFocus={e  => (e.target.style.boxShadow = `0 0 0 3px ${rc.color}22`)}
                    onBlur={e   => (e.target.style.boxShadow = 'none')}
                    placeholder={String(rw.default)} min={1} />
                </div>
                {/* Live probability indicator */}
                <div className="mt-2 space-y-1.5">
                  {newWeight > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <i className="fas fa-chart-pie" style={{ color: pctColor }} />
                          โอกาสในกล่องนี้
                        </span>
                        <span className="text-[12px] font-bold tabular-nums" style={{ color: pctColor }}>
                          {livePct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(livePct, 100)}%`, backgroundColor: pctColor }} />
                      </div>
                      <p className="text-[10px] text-gray-400">
                        แนะนำ {rc.label}: W:{rw.default} — {rw.hint}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] flex items-center gap-1" style={{ color: rc.color }}>
                      <i className="fas fa-info-circle" />
                      แนะนำ {rc.label}: W:{rw.default} — {rw.hint}
                    </p>
                  )}
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">URL รูปภาพ</label>
                <div className="flex gap-2">
                  <input value={item.image || ''} onChange={e => onChange({ ...item, image: e.target.value })}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                    placeholder="https://..." />
                  {item.image && (
                    <div className="w-9 h-9 rounded-lg border border-gray-200 flex-shrink-0 bg-gray-50 overflow-hidden">
                      <img src={item.image} alt="" className="w-full h-full object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">คำอธิบาย</label>
                <textarea value={item.description || ''} onChange={e => onChange({ ...item, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 resize-none transition-colors"
                  rows={2} placeholder="รายละเอียดสั้นๆ..." />
              </div>

              {/* RCON Command */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  RCON Command <span className="text-red-400">*</span>
                  <span className="ml-1.5 font-normal text-gray-400">ใช้ {'{player}'} แทนชื่อผู้เล่น</span>
                </label>
                <textarea value={item.command || ''} onChange={e => onChange({ ...item, command: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 resize-none bg-gray-50 transition-colors"
                  rows={3} placeholder="give {player} diamond 1" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all">
            <i className="fas fa-times text-xs" /> ยกเลิก
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]">
            {saving ? <><i className="fas fa-spinner fa-spin text-xs" /> บันทึก...</> : <><i className="fas fa-save text-xs" /> บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}
