'use client';
import { useEffect, useState, useRef } from 'react';
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

  useEffect(load, []);

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

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            <i className="fas fa-box-open mr-2 text-gray-400"></i>จัดการกล่องสุ่ม
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">สร้างกล่อง เพิ่มไอเทม กำหนดน้ำหนักการสุ่ม</p>
        </div>
        <button onClick={() => { setBoxError(''); setBoxModal(emptyBox()); }} className="btn-primary text-sm">
          <i className="fas fa-plus"></i> สร้างกล่องใหม่
        </button>
      </div>

      {/* Layout: box list (left) + item details (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ─── Left: Box List ─────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            กล่องทั้งหมด ({boxes.length})
          </h2>

          {loading && (
            <div className="card p-8 text-center">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
            </div>
          )}

          {!loading && boxes.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <i className="fas fa-box text-4xl mb-3 opacity-30"></i>
              <p>ยังไม่มีกล่องสุ่ม กดปุ่ม "สร้างกล่องใหม่" เพื่อเริ่ม</p>
            </div>
          )}

          {boxes.map(box => {
            const isActive = activeBox?.id === box.id;
            const totalWeight = box.items.reduce((s, it) => s + it.weight, 0);
            return (
              <div
                key={box.id}
                className={`card p-4 cursor-pointer transition-all ${isActive ? 'border-black ring-1 ring-black' : 'hover:border-gray-300'}`}
                onClick={() => setActiveBox(isActive ? null : box)}
              >
                <div className="flex items-start gap-3">
                  {/* Box image */}
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {box.image ? (
                      <img src={box.image} alt={box.name} className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-box text-2xl text-gray-300"></i>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold truncate">{box.name}</span>
                      <span className={`badge text-xs ${box.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {box.active ? 'เปิด' : 'ปิด'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="font-semibold text-gray-900">฿{parseFloat(String(box.price)).toLocaleString()}</span>
                      <span>·</span>
                      <span>{box.items.length} ไอเทม</span>
                      {totalWeight > 0 && <span>· น้ำหนักรวม {totalWeight}</span>}
                    </div>
                    <WeightBar items={box.items} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setBoxError(''); setBoxModal({ ...box }); }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                      title="แก้ไข"
                    >
                      <i className="fas fa-pen-to-square text-sm"></i>
                    </button>
                    <button
                      onClick={() => handleToggleActive(box)}
                      className={`p-1.5 rounded text-sm ${box.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={box.active ? 'ปิดการขาย' : 'เปิดการขาย'}
                    >
                      <i className={`fas ${box.active ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                    </button>
                    <button
                      onClick={() => handleDeleteBox(box.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      title="ลบ"
                    >
                      <i className="fas fa-trash text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Right: Item Manager ─────────────────────────────────── */}
        <div>
          {!activeBox ? (
            <div className="card h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 p-10">
              <i className="fas fa-hand-pointer text-4xl mb-3 opacity-20"></i>
              <p className="text-sm">คลิกกล่องทางซ้ายเพื่อจัดการไอเทม</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  ไอเทมใน "{activeBox.name}" ({activeBox.items.length})
                </h2>
                <button
                  onClick={() => { setItemError(''); setItemModal(emptyItem(activeBox.id)); }}
                  className="btn-primary text-xs"
                >
                  <i className="fas fa-plus"></i> เพิ่มไอเทม
                </button>
              </div>

              {/* Weight distribution bar */}
              {activeBox.items.length > 0 && (
                <div className="card p-3">
                  <p className="text-xs text-gray-500 mb-1">การกระจายน้ำหนัก</p>
                  <WeightBar items={activeBox.items} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {activeBox.items.map(item => {
                      const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                      const total = activeBox.items.reduce((s, it) => s + it.weight, 0);
                      const pct = total > 0 ? ((item.weight / total) * 100).toFixed(2) : '0';
                      return (
                        <span key={item.id} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: rc.color + '22', color: rc.color }}>
                          {item.name}: {pct}%
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeBox.items.length === 0 && (
                <div className="card p-8 text-center text-gray-400">
                  <i className="fas fa-inbox text-3xl mb-2 opacity-30"></i>
                  <p className="text-sm">ยังไม่มีไอเทม</p>
                </div>
              )}

              {/* Items grid */}
              <div className="space-y-2">
                {activeBox.items.map(item => {
                  const rc = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
                  const total = activeBox.items.reduce((s, it) => s + it.weight, 0);
                  const pct = total > 0 ? ((item.weight / total) * 100).toFixed(2) : '0';
                  return (
                    <div key={item.id} className="card p-3 flex items-center gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: rc.color + '22', border: `1px solid ${rc.color}44` }}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <i className="fas fa-cube" style={{ color: rc.color }}></i>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm truncate">{item.name}</span>
                          <span className={`badge text-xs ${rc.badge}`}>{rc.label}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>W: <strong>{item.weight}</strong></span>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: rc.color }}>{pct}%</span>
                          <span>·</span>
                          <code className="text-gray-400 truncate max-w-[140px]">{item.command}</code>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => { setItemError(''); setItemModal({ ...item }); }}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          title="แก้ไข"
                        >
                          <i className="fas fa-pen-to-square text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="ลบ"
                        >
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Box Modal ───────────────────────────────────────────── */}
      {boxModal && (() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !boxSaving) setBoxModal(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-box-open text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">
                  {boxModal.id ? 'แก้ไขกล่องสุ่ม' : 'สร้างกล่องสุ่มใหม่'}
                </h3>
                <p className="text-[11px] text-gray-400">{boxModal.id ? 'แก้ไขรายละเอียดกล่องที่เลือก' : 'ตั้งค่าราคาและรายละเอียด'}</p>
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={boxModal.active !== false}
                  onChange={e => setBoxModal({ ...boxModal, active: e.target.checked })}
                  className="accent-black w-4 h-4"
                />
                <span className="text-sm"><i className="fas fa-eye text-green-600 mr-1"></i>เปิดการขาย</span>
              </label>
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button onClick={() => setBoxModal(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSaveBox} disabled={boxSaving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {boxSaving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })()}

      {/* ─── Item Modal ──────────────────────────────────────────── */}
      {itemModal && activeBox && (() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !itemSaving) setItemModal(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-lg my-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-gem text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">
                  {itemModal.id ? 'แก้ไขไอเทม' : `เพิ่มไอเทมใน "${activeBox.name}"`}
                </h3>
                <p className="text-[11px] text-gray-400">{itemModal.id ? 'แก้ไขรายละเอียดไอเทมที่เลือก' : 'กำหนด RCON command และน้ำหนักการสุ่ม'}</p>
              </div>
              <button onClick={() => setItemModal(null)} className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {itemError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5"><i className="fas fa-exclamation-circle"></i> {itemError}</div>}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อไอเทม *</label>
                <input
                  value={itemModal.name || ''}
                  onChange={e => setItemModal({ ...itemModal, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="เช่น Netherite Sword"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">คำอธิบาย</label>
                <input
                  value={itemModal.description || ''}
                  onChange={e => setItemModal({ ...itemModal, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="คำอธิบายสั้นๆ..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">RCON Command *</label>
                <textarea
                  value={itemModal.command || ''}
                  onChange={e => setItemModal({ ...itemModal, command: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 h-20 resize-none font-mono"
                  placeholder="give {player} minecraft:netherite_sword 1&#10;say {player} got a Netherite Sword!"
                />
                <p className="text-xs text-gray-400 mt-1">
                  ใช้ <code className="bg-gray-100 px-1 rounded">{'{player}'}</code> แทนชื่อผู้เล่น — รองรับหลายบรรทัด
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">
                    น้ำหนักการสุ่ม (Weight) *
                    <span className="text-gray-400 font-normal ml-1">— ยิ่งมากยิ่งออกบ่อย</span>
                  </label>
                  <input
                    type="number"
                    value={itemModal.weight ?? 100}
                    onChange={e => setItemModal({ ...itemModal, weight: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    min={1}
                  />
                  {activeBox.items.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      โอกาส ≈{' '}
                      <strong>
                        {((Number(itemModal.weight || 0) / (activeBox.items.reduce((s, it) => s + it.weight, 0) + (itemModal.id ? 0 : Number(itemModal.weight || 0)))) * 100).toFixed(2)}%
                      </strong>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Rarity</label>
                  <select
                    value={itemModal.rarity || 'common'}
                    onChange={e => setItemModal({ ...itemModal, rarity: e.target.value as LootBoxItem['rarity'] })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  >
                    {RARITY_OPTIONS.map(r => (
                      <option key={r} value={r}>{RARITY_CONFIG[r].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: itemModal.color || RARITY_CONFIG[itemModal.rarity || 'common'].color }}
                />
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">สีไอเทม (Custom)</label>
                  <input
                    value={itemModal.color || ''}
                    onChange={e => setItemModal({ ...itemModal, color: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    placeholder={`ปล่อยว่างเพื่อใช้สีตาม rarity (${RARITY_CONFIG[itemModal.rarity || 'common'].color})`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">URL รูปภาพไอเทม</label>
                <input
                  value={itemModal.image || ''}
                  onChange={e => setItemModal({ ...itemModal, image: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="https://..."
                />
                {itemModal.image && (
                  <img src={itemModal.image} alt="" className="mt-2 h-14 rounded-lg object-contain border border-gray-200" />
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p className="font-semibold mb-1 text-gray-700">Weight แนะนำตาม Rarity:</p>
                <div className="flex flex-wrap gap-2">
                  {RARITY_OPTIONS.map(r => {
                    const suggested: Record<string, number> = { common: 500, uncommon: 200, rare: 80, epic: 30, legendary: 10 };
                    const rc = RARITY_CONFIG[r];
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setItemModal({ ...itemModal, rarity: r, weight: suggested[r] })}
                        className="px-2 py-1 rounded-full font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: rc.color + '22', color: rc.color }}
                      >
                        {rc.label}: {suggested[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button onClick={() => setItemModal(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSaveItem} disabled={itemSaving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {itemSaving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}
