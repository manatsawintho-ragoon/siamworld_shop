'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────

interface LootBoxItem {
  id: number;
  loot_box_id: number;
  name: string;
  description?: string;
  image?: string;
  command: string;
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
  active: boolean;
  sort_order: number;
  items: LootBoxItem[];
}

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

const RARITY_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  common:    { label: 'Common',    color: '#95A5A6', badge: 'bg-gray-100 text-gray-600' },
  uncommon:  { label: 'Uncommon',  color: '#2ECC71', badge: 'bg-green-100 text-green-700' },
  rare:      { label: 'Rare',      color: '#3498DB', badge: 'bg-blue-100 text-blue-700' },
  epic:      { label: 'Epic',      color: '#9B59B6', badge: 'bg-purple-100 text-purple-700' },
  legendary: { label: 'Legendary', color: '#FFD700', badge: 'bg-yellow-100 text-yellow-700' },
};

interface Category { id: number; name: string; slug: string; icon?: string; sort_order: number; }

const emptyCategory: Partial<Category> = { name: '', slug: '', icon: '', sort_order: 0 };

const TOKEN = () => getToken()!;

// ─── Empty defaults ──────────────────────────────────────────

const emptyBox = (): Partial<LootBox> => ({
  name: '', description: '', image: '', price: 0, active: true, sort_order: 0,
});

const emptyItem = (boxId: number): Partial<LootBoxItem> => ({
  loot_box_id: boxId, name: '', description: '', image: '', command: '',
  weight: 100, rarity: 'common', color: '',
});

// ─── Helpers ──────────────────────────────────────────────────

function WeightBar({ items }: { items: LootBoxItem[] }) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  if (total === 0 || items.length === 0) return null;
  return (
    <div className="flex rounded-full overflow-hidden h-2 mt-2 w-full">
      {items.map(item => {
        const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
        const pct = (item.weight / total) * 100;
        return (
          <div key={item.id} style={{ width: `${pct}%`, backgroundColor: rc.color }}
            title={`${item.name}: ${pct.toFixed(1)}%`} />
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────

export default function AdminLootBoxes() {
  const [boxes, setBoxes] = useState<LootBox[]>([]);
  const [loading, setLoading] = useState(true);

  // Box form state
  const [boxModal, setBoxModal] = useState<Partial<LootBox> | null>(null);
  const [boxSaving, setBoxSaving] = useState(false);
  const [boxError, setBoxError] = useState('');

  // Item form state (editing items of a specific box)
  const [activeBox, setActiveBox] = useState<LootBox | null>(null);
  const [itemModal, setItemModal] = useState<Partial<LootBoxItem> | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState('');

  // Category management
  const [categories, setCategories] = useState<Category[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<Partial<Category> | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  // RCON viewer
  const [viewingCmd, setViewingCmd] = useState<{ name: string; command: string } | null>(null);

  // Search / filter
  const [boxSearch, setBoxSearch] = useState('');

  // ── Load ────────────────────────────────────────────────────

  const load = () => {
    setLoading(true);
    api('/admin/lootboxes', { token: TOKEN() })
      .then(d => {
        const allBoxes = (d.boxes as LootBox[]) || [];
        setBoxes(allBoxes);
        // Keep activeBox in sync
        if (activeBox) {
          const updated = allBoxes.find(b => b.id === activeBox.id);
          if (updated) setActiveBox(updated);
        }
      })
      .finally(() => setLoading(false));
  };

  const loadCategories = () => {
    api('/admin/categories', { token: TOKEN() }).then(d => setCategories((d.categories as Category[]) || []));
  };

  useEffect(() => { load(); loadCategories(); }, []);

  // ── Box CRUD ────────────────────────────────────────────────

  const handleSaveBox = async () => {
    if (!boxModal) return;
    setBoxSaving(true);
    setBoxError('');
    try {
      const body = {
        name: boxModal.name,
        description: boxModal.description || null,
        image: boxModal.image || null,
        price: Number(boxModal.price),
        sort_order: Number(boxModal.sort_order) || 0,
        active: boxModal.active !== false,
      };
      if (boxModal.id) {
        await api(`/admin/lootboxes/${boxModal.id}`, { method: 'PUT', token: TOKEN(), body });
      } else {
        await api('/admin/lootboxes', { method: 'POST', token: TOKEN(), body });
      }
      setBoxModal(null);
      load();
    } catch (err: any) {
      setBoxError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setBoxSaving(false);
    }
  };

  const handleDeleteBox = async (id: number) => {
    if (!confirm('ลบกล่องนี้? ไอเทมทั้งหมดภายในจะถูกลบด้วย')) return;
    try {
      await api(`/admin/lootboxes/${id}`, { method: 'DELETE', token: TOKEN() });
      if (activeBox?.id === id) setActiveBox(null);
      load();
    } catch (err: any) {
      alert(err?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleToggleActive = async (box: LootBox) => {
    try {
      await api(`/admin/lootboxes/${box.id}`, {
        method: 'PUT', token: TOKEN(),
        body: { active: !box.active },
      });
      load();
    } catch { }
  };

  // ── Item CRUD ────────────────────────────────────────────────

  const handleSaveItem = async () => {
    if (!itemModal || !activeBox) return;
    setItemSaving(true);
    setItemError('');
    try {
      const body = {
        name: itemModal.name,
        description: itemModal.description || null,
        image: itemModal.image || null,
        command: itemModal.command,
        weight: Number(itemModal.weight),
        rarity: itemModal.rarity || 'common',
        color: itemModal.color || null,
      };
      if (itemModal.id) {
        await api(`/admin/lootboxes/items/${itemModal.id}`, { method: 'PUT', token: TOKEN(), body });
      } else {
        await api(`/admin/lootboxes/${activeBox.id}/items`, { method: 'POST', token: TOKEN(), body });
      }
      setItemModal(null);
      load();
    } catch (err: any) {
      setItemError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('ลบไอเทมนี้?')) return;
    try {
      await api(`/admin/lootboxes/items/${itemId}`, { method: 'DELETE', token: TOKEN() });
      load();
    } catch (err: any) {
      alert(err?.message || 'ลบไม่สำเร็จ');
    }
  };

  // ── Category CRUD ─────────────────────────────────────────────

  const handleSaveCat = async () => {
    if (!catEditing) return;
    setCatSaving(true);
    setCatError('');
    try {
      const body = {
        name: catEditing.name,
        slug: catEditing.slug || catEditing.name?.toLowerCase().replace(/\s+/g, '-'),
        icon: catEditing.icon || null,
        sort_order: Number(catEditing.sort_order) || 0,
      };
      if (catEditing.id) {
        await api(`/admin/categories/${catEditing.id}`, { method: 'PUT', token: TOKEN(), body });
      } else {
        await api('/admin/categories', { method: 'POST', token: TOKEN(), body });
      }
      setCatEditing(null);
      loadCategories();
    } catch (err: any) {
      setCatError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async (id: number) => {
    if (!confirm('ลบหมวดหมู่นี้?')) return;
    try {
      await api(`/admin/categories/${id}`, { method: 'DELETE', token: TOKEN() });
      loadCategories();
    } catch { }
  };

  // ── Render ───────────────────────────────────────────────────

  const filteredBoxes = boxes.filter(b =>
    b.name.toLowerCase().includes(boxSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 112px)' }}>

      {/* Page header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            <i className="fas fa-box-open mr-2 text-[#f97316]"></i>จัดการกล่องสุ่ม
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">สร้างกล่อง Gacha เพิ่มไอเทม กำหนดน้ำหนักการสุ่ม</p>
        </div>
        <button
          onClick={() => { setCatError(''); setCatEditing(null); setCatModalOpen(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-bold rounded-lg shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all"
        >
          <i className="fas fa-tags text-[12px] text-[#f97316]"></i> จัดการหมวดหมู่
        </button>
      </div>

      {/* ── Two-pane grid (fills remaining height) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">

        {/* ─── Left pane: Box list ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 flex flex-col overflow-hidden">

          {/* Left header */}
          <div className="px-3 py-2.5 border-b border-gray-100 bg-slate-50/70 flex items-center gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]"></i>
              <input
                value={boxSearch}
                onChange={e => setBoxSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                placeholder={`ค้นหากล่อง... (${boxes.length})`}
              />
            </div>
            <button
              onClick={() => { setBoxError(''); setBoxModal(emptyBox()); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#16a34a] text-white text-[12px] font-bold rounded-lg shadow-[0_3px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d6b2e] active:translate-y-[2px] flex-shrink-0"
            >
              <i className="fas fa-plus text-[11px]"></i> สร้าง
            </button>
          </div>

          {/* Left body — scrolls independently */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {loading && (
              <div className="py-12 text-center text-gray-300">
                <i className="fas fa-spinner fa-spin text-2xl"></i>
              </div>
            )}
            {!loading && boxes.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                <i className="fas fa-box text-3xl mb-2 opacity-30 block"></i>
                <p className="text-sm">ยังไม่มีกล่องสุ่ม</p>
              </div>
            )}
            {!loading && boxes.length > 0 && filteredBoxes.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                <i className="fas fa-search text-2xl mb-2 opacity-30 block"></i>
                <p className="text-sm">ไม่พบกล่องที่ค้นหา</p>
              </div>
            )}
            {filteredBoxes.map(box => {
              const isActive = activeBox?.id === box.id;
              return (
                <div
                  key={box.id}
                  className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-all flex items-center gap-3 ${
                    isActive
                      ? 'border-[#16a34a]/50 bg-green-50/60 ring-2 ring-[#16a34a]/25'
                      : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveBox(isActive ? null : box)}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {box.image
                      ? <img src={box.image} alt={box.name} className="w-full h-full object-cover" />
                      : <i className="fas fa-box text-lg text-gray-300"></i>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold text-sm truncate ${isActive ? 'text-[#16a34a]' : 'text-gray-800'}`}>{box.name}</span>
                      {!box.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium flex-shrink-0">ปิด</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">฿{parseFloat(String(box.price)).toLocaleString()}</span>
                      <span>·</span>
                      <span>{box.items.length} ไอเทม</span>
                    </div>
                    <WeightBar items={box.items} />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setBoxError(''); setBoxModal({ ...box }); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                      title="แก้ไข"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                    </button>
                    <button
                      onClick={() => handleToggleActive(box)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-white active:translate-y-[1px] active:shadow-none transition-all ${box.active ? 'bg-[#16a34a] border border-green-700 shadow-[0_2px_0_#0d6b2e] hover:brightness-110' : 'bg-gray-400 border border-gray-500 shadow-[0_2px_0_#9ca3af] hover:brightness-110'}`}
                      title={box.active ? 'ปิดการขาย' : 'เปิดการขาย'}
                    >
                      <i className={`fas text-[10px] ${box.active ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                    </button>
                    <button
                      onClick={() => handleDeleteBox(box.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                      title="ลบ"
                    >
                      <i className="fas fa-trash text-[10px]"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Right pane: Item manager ─────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 flex flex-col overflow-hidden">

          {/* Right header */}
          <div className="px-3 py-2.5 border-b border-gray-100 bg-slate-50/70 flex items-center gap-2 flex-shrink-0 min-h-[48px]">
            {activeBox ? (
              <>
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {activeBox.image
                    ? <img src={activeBox.image} alt="" className="w-full h-full object-cover" />
                    : <i className="fas fa-box text-gray-400 text-xs"></i>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{activeBox.name}</p>
                  <p className="text-[10px] text-gray-400">{activeBox.items.length} ไอเทม</p>
                </div>
                <button
                  onClick={() => { setItemError(''); setItemModal(emptyItem(activeBox.id)); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2735] text-white text-[12px] font-bold rounded-lg shadow-[0_3px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[1px] flex-shrink-0"
                >
                  <i className="fas fa-plus text-[11px]"></i> เพิ่มไอเทม
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400 flex items-center gap-2">
                <i className="fas fa-hand-pointer opacity-50"></i>
                คลิกกล่องทางซ้ายเพื่อจัดการไอเทม
              </p>
            )}
          </div>

          {/* Right body — scrolls independently */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {!activeBox && (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 select-none">
                <i className="fas fa-layer-group text-5xl mb-3 opacity-30"></i>
                <p className="text-sm">เลือกกล่องสุ่มจากด้านซ้าย</p>
              </div>
            )}

            {activeBox && (
              <div className="space-y-2">
                {/* Weight distribution bar */}
                {activeBox.items.length > 0 && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">การกระจายน้ำหนัก</p>
                    <WeightBar items={activeBox.items} />
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {activeBox.items.map(item => {
                        const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                        const total = activeBox.items.reduce((s, it) => s + it.weight, 0);
                        const pct = total > 0 ? ((item.weight / total) * 100).toFixed(1) : '0';
                        return (
                          <span key={item.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: rc.color + '22', color: rc.color }}>
                            {item.name}: {pct}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeBox.items.length === 0 && (
                  <div className="py-12 text-center text-gray-400">
                    <i className="fas fa-inbox text-3xl mb-2 opacity-30 block"></i>
                    <p className="text-sm">ยังไม่มีไอเทม กด "เพิ่มไอเทม" เพื่อเริ่ม</p>
                  </div>
                )}

                {activeBox.items.map(item => {
                  const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                  const total = activeBox.items.reduce((s, it) => s + it.weight, 0);
                  const pct = total > 0 ? ((item.weight / total) * 100).toFixed(2) : '0';
                  return (
                    <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-2.5 flex items-center gap-2.5 hover:border-gray-300 transition-colors">
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: rc.color + '22', border: `1px solid ${rc.color}44` }}>
                        {item.image
                          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          : <i className="fas fa-cube text-xs" style={{ color: rc.color }}></i>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate text-gray-800">{item.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${rc.badge}`}>{rc.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                          <span>W: <strong className="text-gray-600">{item.weight}</strong></span>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: rc.color }}>{pct}%</span>
                          {item.command && <>
                            <span>·</span>
                            <code className="truncate max-w-[120px] text-gray-400">{item.command}</code>
                          </>}
                        </div>
                      </div>

                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setViewingCmd({ name: item.name, command: item.command || '' })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_2px_0_#1d4ed8] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                          title="ดูคำสั่ง RCON"
                        >
                          <i className="fas fa-terminal text-[10px]"></i>
                        </button>
                        <button
                          onClick={() => { setItemError(''); setItemModal({ ...item }); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                          title="แก้ไข"
                        >
                          <i className="fas fa-pen text-[10px]"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                          title="ลบ"
                        >
                          <i className="fas fa-trash text-[10px]"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Box Modal ───────────────────────────────────────────── */}
      {boxModal && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !boxSaving) setBoxModal(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/70 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-box-open text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">
                  {boxModal.id ? 'แก้ไขกล่องสุ่ม' : 'สร้างกล่องสุ่มใหม่'}
                </h3>
                <p className="text-[11px] text-gray-500">{boxModal.id ? 'แก้ไขรายละเอียดกล่องที่เลือก' : 'ตั้งค่าราคาและรายละเอียด'}</p>
              </div>
              <button onClick={() => setBoxModal(null)} className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {boxError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5"><i className="fas fa-exclamation-circle"></i> {boxError}</div>}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อกล่อง *</label>
                <input
                  value={boxModal.name || ''}
                  onChange={e => setBoxModal({ ...boxModal, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="เช่น กล่องสุ่มอาวุธ S+"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">คำอธิบาย</label>
                <textarea
                  value={boxModal.description || ''}
                  onChange={e => setBoxModal({ ...boxModal, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 h-16 resize-none"
                  placeholder="รายละเอียดกล่อง..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ราคา (฿) *</label>
                  <input
                    type="number"
                    value={boxModal.price || ''}
                    onChange={e => setBoxModal({ ...boxModal, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    min={1}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ลำดับการแสดง</label>
                  <input
                    type="number"
                    value={boxModal.sort_order ?? 0}
                    onChange={e => setBoxModal({ ...boxModal, sort_order: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">URL รูปภาพกล่อง</label>
                <input
                  value={boxModal.image || ''}
                  onChange={e => setBoxModal({ ...boxModal, image: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="https://..."
                />
                {boxModal.image && (
                  <img src={boxModal.image} alt="" className="mt-2 h-16 rounded-lg object-contain border border-gray-200" />
                )}
              </div>

            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 bg-slate-50/70 flex items-center justify-end gap-2">
              <button onClick={() => setBoxModal(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSaveBox} disabled={boxSaving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {boxSaving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })(), document.body)}

      {/* ─── Item Modal ──────────────────────────────────────────── */}
      {itemModal && activeBox && createPortal((() => {
        const bd = { current: false };
        const SUGGESTED: Record<string, number> = { common: 500, uncommon: 200, rare: 80, epic: 30, legendary: 10 };
        const activeRarity = itemModal.rarity || 'common';
        const rc = RARITY_CONFIG[activeRarity];
        const totalW = activeBox.items.reduce((s, it) => s + it.weight, 0);
        const w = Number(itemModal.weight || 0);
        const chance = totalW > 0
          ? ((w / (totalW + (itemModal.id ? 0 : w))) * 100).toFixed(1)
          : '100.0';
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
            onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !itemSaving) setItemModal(null); }}>
            <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden">

              {/* Header */}
              <div className="px-5 py-3.5 border-b border-gray-100 bg-slate-50/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rc.color + '22' }}>
                  <i className="fas fa-gem text-xs" style={{ color: rc.color }}></i>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-sm">
                    {itemModal.id ? 'แก้ไขไอเทม' : `เพิ่มไอเทม — ${activeBox.name}`}
                  </h3>
                  <p className="text-[10px] text-gray-400">RCON · น้ำหนัก · Rarity</p>
                </div>
                <button onClick={() => setItemModal(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] flex-shrink-0">
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>

              <div className="p-4 space-y-3">
                {itemError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5"><i className="fas fa-exclamation-circle"></i> {itemError}</div>}

                {/* Row 1: ชื่อ + คำอธิบาย */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">ชื่อไอเทม *</label>
                    <input
                      value={itemModal.name || ''}
                      onChange={e => setItemModal({ ...itemModal, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      placeholder="Netherite Sword"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">คำอธิบาย</label>
                    <input
                      value={itemModal.description || ''}
                      onChange={e => setItemModal({ ...itemModal, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      placeholder="คำอธิบายสั้นๆ"
                    />
                  </div>
                </div>

                {/* Row 2: Rarity picker — กด = เซ็ต rarity + weight พร้อมกัน */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1.5">Rarity <span className="font-normal text-gray-400">— กดเพื่อเลือกและตั้ง Weight อัตโนมัติ</span></label>
                  <div className="flex gap-1.5">
                    {RARITY_OPTIONS.map(r => {
                      const cfg = RARITY_CONFIG[r];
                      const isActive = activeRarity === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setItemModal({ ...itemModal, rarity: r, weight: SUGGESTED[r] })}
                          className="flex-1 py-2 rounded-lg text-[11px] font-bold border-2 transition-all"
                          style={isActive
                            ? { backgroundColor: cfg.color + '22', borderColor: cfg.color, color: cfg.color }
                            : { backgroundColor: 'transparent', borderColor: '#e5e7eb', color: '#9ca3af' }
                          }
                        >
                          {cfg.label}
                          <span className="block text-[9px] font-normal opacity-70">{SUGGESTED[r]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row 3: Weight + Image */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">
                      Weight *
                      {totalW > 0 && <span className="ml-1.5 font-normal" style={{ color: rc.color }}>≈ {chance}%</span>}
                    </label>
                    <input
                      type="number"
                      value={itemModal.weight ?? 100}
                      onChange={e => setItemModal({ ...itemModal, weight: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Image URL</label>
                    <div className="flex gap-1.5">
                      <input
                        value={itemModal.image || ''}
                        onChange={e => setItemModal({ ...itemModal, image: e.target.value })}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                        placeholder="https://..."
                      />
                      {itemModal.image && (
                        <img src={itemModal.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 4: RCON Command */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">
                    RCON Command * <span className="font-normal text-gray-400">— ใช้ <code className="bg-gray-100 px-1 rounded">{'{player}'}</code> แทนชื่อผู้เล่น</span>
                  </label>
                  <textarea
                    value={itemModal.command || ''}
                    onChange={e => setItemModal({ ...itemModal, command: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 h-16 resize-none font-mono"
                    placeholder={"give {player} minecraft:netherite_sword 1"}
                  />
                </div>

                {/* Row 5: Custom color (collapsed/optional) */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-white shadow flex-shrink-0"
                    style={{ backgroundColor: itemModal.color || rc.color }} />
                  <div className="flex-1">
                    <input
                      value={itemModal.color || ''}
                      onChange={e => setItemModal({ ...itemModal, color: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      placeholder={`Custom color (ปล่อยว่าง = ใช้สี ${rc.color})`}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 bg-slate-50/70 flex items-center justify-end gap-2">
                <button onClick={() => setItemModal(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all">
                  <i className="fas fa-times text-[12px]"></i> ยกเลิก
                </button>
                <button onClick={handleSaveItem} disabled={itemSaving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]">
                  {itemSaving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ─── RCON Command Viewer Modal ───────────────────────── */}
      {viewingCmd && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget) setViewingCmd(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/70 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-terminal text-blue-500 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">คำสั่ง RCON</h3>
                <p className="text-[11px] text-gray-500">{viewingCmd.name}</p>
              </div>
              <button onClick={() => setViewingCmd(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5">
              <pre className="bg-gray-900 text-green-400 text-sm font-mono p-4 rounded-lg whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                {viewingCmd.command || '(ยังไม่มีคำสั่ง)'}
              </pre>
              <p className="text-[10px] text-gray-400 mt-2">ใช้ <code className="bg-gray-100 px-1 rounded">{'{player}'}</code> แทนชื่อผู้เล่น</p>
            </div>
          </div>
        </div>
      ); })(), document.body)}

      {/* ─── Category Management Modal ───────────────────────── */}
      {catModalOpen && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !catSaving) { setCatModalOpen(false); setCatEditing(null); } }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/70 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-tags text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">จัดการหมวดหมู่</h3>
                <p className="text-[11px] text-gray-500">เพิ่ม แก้ไข ลบหมวดหมู่</p>
              </div>
              <button onClick={() => { setCatModalOpen(false); setCatEditing(null); }} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {categories.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <i className="fas fa-tags text-2xl mb-2 block opacity-30"></i>
                    <p className="text-sm">ยังไม่มีหมวดหมู่</p>
                  </div>
                )}
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <i className={`fas ${c.icon || 'fa-tag'} text-[#f97316] text-[10px]`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.slug}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setCatEditing({ ...c })}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                        <i className="fas fa-pen text-[10px]"></i>
                      </button>
                      <button onClick={() => handleDeleteCat(c.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-xs font-bold text-gray-500 mb-3">{catEditing?.id ? `แก้ไข: ${catEditing.name}` : 'เพิ่มหมวดหมู่ใหม่'}</h4>
                {catError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5 mb-3"><i className="fas fa-exclamation-circle"></i> {catError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อหมวดหมู่ *</label>
                    <input value={catEditing?.name || ''} onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), name: e.target.value, slug: prev?.id ? prev.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" placeholder="เช่น อาวุธ" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Slug</label>
                    <input value={catEditing?.slug || ''} onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), slug: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" placeholder="weapon" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Icon (FA class)</label>
                    <input value={catEditing?.icon || ''} onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), icon: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" placeholder="fa-sword" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ลำดับ</label>
                    <input type="number" value={catEditing?.sort_order ?? 0} onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), sort_order: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" min={0} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {catEditing?.id && (
                    <button onClick={() => setCatEditing(null)} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all">
                      <i className="fas fa-times text-[11px]"></i> ยกเลิก
                    </button>
                  )}
                  <button onClick={handleSaveCat} disabled={catSaving || !catEditing?.name}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2735] disabled:opacity-50 text-white text-[12px] font-bold rounded-lg shadow-[0_3px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[1px]">
                    {catSaving ? <><i className="fas fa-spinner fa-spin text-[11px]"></i> บันทึก...</> : <><i className="fas fa-save text-[11px]"></i> {catEditing?.id ? 'บันทึก' : 'เพิ่ม'}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ); })(), document.body)}
    </div>
  );
}
