'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image?: string;
  command: string;
  category_id?: number;
  category_name?: string;
  featured: boolean;
  active: boolean;
  server_ids?: number[];
  servers?: { id: number; name: string }[];
}

interface Category { id: number; name: string; slug: string; icon?: string; sort_order: number; }
interface Server { id: number; name: string; }

const emptyProduct = {
  name: '', description: '', price: 0, original_price: 0,
  image: '', command: '', category_id: 0, featured: false,
  active: true, server_ids: [] as number[],
};

const emptyCategory: Partial<Category> = { name: '', slug: '', icon: '', sort_order: 0 };

export default function AdminProducts() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  // Product edit modal
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Category management modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<Partial<Category> | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');
  const dragCatIdx = useRef<number | null>(null);

  // RCON viewer modal
  const [viewingCmd, setViewingCmd] = useState<{ name: string; command: string } | null>(null);

  // Buyers modal
  interface Purchase { id: number; price: number; status: string; created_at: string; username: string; server_name: string; }
  const [buyersModal, setBuyersModal] = useState<{ product: Product; purchases: Purchase[]; loading: boolean } | null>(null);

  const openBuyers = async (p: Product) => {
    setBuyersModal({ product: p, purchases: [], loading: true });
    try {
      const d = await api(`/admin/products/${p.id}/buyers`, { token: getToken()! });
      setBuyersModal(prev => prev ? { ...prev, purchases: (d.purchases as Purchase[]) || [], loading: false } : null);
    } catch {
      setBuyersModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      api('/admin/products', { token: getToken()! }).then(d => setProducts((d.products as Product[]) || [])),
      api('/admin/categories', { token: getToken()! }).then(d => setCategories((d.categories as Category[]) || [])),
      api('/admin/servers', { token: getToken()! }).then(d => setServers((d.servers as Server[]) || [])),
    ]).finally(() => setLoading(false));
  };

  const loadCategories = () => {
    api('/admin/categories', { token: getToken()! }).then(d => setCategories((d.categories as Category[]) || []));
  };

  const handleReorderCats = async (reordered: Category[]) => {
    setCategories(reordered);
    try {
      await api('/admin/categories/reorder', { method: 'PUT', token: getToken()!, body: { order: reordered.map(c => c.id) } });
    } catch { loadCategories(); }
  };

  useEffect(load, []);

  const openEdit = (p: Product) => {
    setEditing({
      ...p,
      server_ids: p.servers?.map((s: { id: number }) => s.id) || p.server_ids || [],
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        name: editing.name,
        description: editing.description || undefined,
        price: Number(editing.price),
        original_price: Number(editing.original_price) || null,
        image: editing.image || null,
        command: editing.command,
        category_id: Number(editing.category_id) || null,
        featured: Boolean(editing.featured),
        active: editing.active !== false,
        server_ids: editing.server_ids || [],
      };
      if (editing.id) {
        await api(`/admin/products/${editing.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/products', { method: 'POST', token: getToken()!, body });
      }
      setEditing(null);
      adminAlert({ title: editing.id ? 'แก้ไขสินค้าแล้ว' : 'เพิ่มสินค้าแล้ว', type: 'success' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    const newActive = !p.active;
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, active: newActive } : x));
    try {
      await api(`/admin/products/${p.id}`, { method: 'PUT', token: getToken()!, body: { active: newActive } });
    } catch { load(); }
  };

  const handleDelete = async (id: number) => {
    if (!await adminConfirm({ title: 'ลบสินค้า', message: 'ต้องการลบสินค้านี้?', type: 'danger', confirmLabel: 'ลบ' })) return;
    try {
      await api(`/admin/products/${id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ลบสินค้าแล้ว', type: 'success' });
      load();
    } catch { }
  };

  // ── Category CRUD ──────────────────────────────────────────

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
        await api(`/admin/categories/${catEditing.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/categories', { method: 'POST', token: getToken()!, body });
      }
      setCatEditing(null);
      adminAlert({ title: catEditing.id ? 'แก้ไขหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว', type: 'success' });
      loadCategories();
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async (id: number) => {
    if (!await adminConfirm({ title: 'ลบหมวดหมู่', message: 'สินค้าในหมวดหมู่จะยังอยู่แต่ไม่มีหมวดหมู่ ยืนยัน?', type: 'warning', confirmLabel: 'ลบ' })) return;
    try {
      await api(`/admin/categories/${id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ลบหมวดหมู่แล้ว', type: 'success' });
      loadCategories();
      load();
    } catch { }
  };

  // ── New state for redesign ────────────────────────────────
  const [selectedCat,    setSelectedCat]    = useState<number | null>(null);
  const [search,         setSearch]         = useState('');
  const [featFilter,     setFeatFilter]     = useState<'all' | 'featured' | 'normal'>('all');
  const [page,           setPage]           = useState(1);
  const dragProdIdx = useRef<number | null>(null);
  const PAGE_SIZE = 25;

  const handleToggleFeatured = async (p: Product) => {
    const next = !p.featured;
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, featured: next } : x));
    try { await api(`/admin/products/${p.id}`, { method: 'PUT', token: getToken()!, body: { featured: next } }); }
    catch { load(); }
  };

  const handleReorderProducts = async (reordered: Product[]) => {
    setProducts(reordered);
    try { await api('/admin/products/reorder', { method: 'PUT', token: getToken()!, body: { order: reordered.map(p => p.id) } }); }
    catch { /* silent — sort_order col may not exist yet */ }
  };

  const filtered = products
    .filter(p => selectedCat === null || p.category_id === selectedCat)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase()))
    .filter(p => featFilter === 'all' || (featFilter === 'featured' ? p.featured : !p.featured));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const catCount = (catId: number | null) =>
    catId === null ? products.length : products.filter(p => p.category_id === catId).length;

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-cube text-[#f97316]"></i> จัดการสินค้า
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">เพิ่ม แก้ไข และจัดการสินค้าไอเท็มทั้งหมดในร้าน</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setCatError(''); setCatEditing(null); setCatModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-bold rounded-lg shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all">
            <i className="fas fa-tags text-[12px] text-[#f97316]"></i> จัดการหมวดหมู่
          </button>
          <button onClick={() => setEditing({ ...emptyProduct })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
            <i className="fas fa-plus text-[12px]"></i> เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* ── Split layout ─────────────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ─ Left sidebar: category filter ─ */}
        <div className="w-52 flex-shrink-0 bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <i className="fas fa-layer-group text-[#f97316]"></i> หมวดหมู่
            </p>
          </div>
          <div className="p-2 space-y-0.5">
            {/* All */}
            <button onClick={() => { setSelectedCat(null); setPage(1); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                selectedCat === null
                  ? 'bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}>
              <i className="fas fa-border-all text-[10px] flex-shrink-0" />
              <span className="flex-1 truncate">ทั้งหมด</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${selectedCat === null ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {products.length}
              </span>
            </button>

            {categories.map(c => {
              const cnt = catCount(c.id);
              const isOn = selectedCat === c.id;
              return (
                <button key={c.id} onClick={() => { setSelectedCat(c.id); setPage(1); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                    isOn ? 'bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e]'
                         : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}>
                  <i className={`fas ${c.icon || 'fa-tag'} text-[10px] flex-shrink-0`} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${isOn ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {cnt}
                  </span>
                </button>
              );
            })}

            {/* No category */}
            {(() => {
              const cnt = products.filter(p => !p.category_id).length;
              const isOn = selectedCat === -1;
              return cnt > 0 ? (
                <button onClick={() => { setSelectedCat(-1); setPage(1); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                    isOn ? 'bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}>
                  <i className="fas fa-tag text-[10px] flex-shrink-0" />
                  <span className="flex-1 truncate">ไม่มีหมวดหมู่</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${isOn ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>
                </button>
              ) : null;
            })()}
          </div>
        </div>

        {/* ─ Right: main product table ─ */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex flex-col">

          {/* Card header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-store text-[#f97316] text-[10px]"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">
                {selectedCat === null ? 'ทั้งหมด' : selectedCat === -1 ? 'ไม่มีหมวดหมู่' : categories.find(c => c.id === selectedCat)?.name || ''}
              </p>
              <p className="text-[10px] text-gray-400">{filtered.length} รายการ</p>
            </div>
            {/* Search */}
            <div className="relative">
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]"></i>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="ค้นหาสินค้า..."
                className="pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 text-[11px] focus:outline-none focus:border-[#637469] focus:ring-1 focus:ring-[#637469]/20 w-44" />
            </div>
            {/* Featured filter pills */}
            <div className="flex gap-1">
              {(['all', 'featured', 'normal'] as const).map(f => (
                <button key={f} onClick={() => { setFeatFilter(f); setPage(1); }}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    featFilter === f
                      ? 'bg-[#1e2735] text-white shadow-[0_2px_0_#38404d]'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {f === 'all' ? 'ทั้งหมด' : f === 'featured' ? '⭐ แนะนำ' : 'ปกติ'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <i className="fas fa-spinner fa-spin text-2xl text-[#f97316]"></i>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1 pb-3">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50/40">
                      <th className="w-7 px-2 py-2"></th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">สินค้า</th>
                      {selectedCat === null && <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">หมวด</th>}
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">ราคา</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">แนะนำ</th>
                      <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">แสดง</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paged.map((p, idx) => {
                      const globalIdx = (page - 1) * PAGE_SIZE + idx;
                      return (
                        <tr key={p.id}
                          draggable
                          onDragStart={() => { dragProdIdx.current = globalIdx; }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            const from = dragProdIdx.current;
                            if (from === null || from === globalIdx) return;
                            const next = [...products];
                            const fromItem = filtered[from];
                            const toItem   = filtered[globalIdx];
                            const fi = next.findIndex(x => x.id === fromItem.id);
                            const ti = next.findIndex(x => x.id === toItem.id);
                            next.splice(ti, 0, next.splice(fi, 1)[0]);
                            dragProdIdx.current = null;
                            handleReorderProducts(next);
                          }}
                          className="hover:bg-gray-50/60 transition-colors group active:opacity-70"
                        >
                          {/* Grip */}
                          <td className="px-2 py-1.5 w-7">
                            <i className="fas fa-grip-vertical text-gray-200 group-hover:text-gray-400 text-sm transition-colors"></i>
                          </td>
                          {/* Product */}
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-cube text-gray-300 text-xs"></i>}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-bold text-gray-800 truncate max-w-[180px]">{p.name}</div>
                                {p.description && <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{p.description}</div>}
                              </div>
                            </div>
                          </td>
                          {/* Category (only when showing all) */}
                          {selectedCat === null && (
                            <td className="px-3 py-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-wide">
                                {p.category_name || '—'}
                              </span>
                            </td>
                          )}
                          {/* Price */}
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            <span className="text-[12px] font-black text-gray-800">{p.price?.toLocaleString()} ฿</span>
                            {p.original_price && p.original_price > p.price && (
                              <span className="text-[10px] text-gray-400 line-through ml-1">{p.original_price?.toLocaleString()}</span>
                            )}
                          </td>
                          {/* Featured — toggle switch */}
                          <td className="px-2 py-1.5 text-center">
                            <label className="flex items-center justify-center cursor-pointer" title={p.featured ? 'ยกเลิกแนะนำ' : 'ตั้งเป็นแนะนำ'} onClick={e => { e.stopPropagation(); handleToggleFeatured(p); }}>
                              <div className="relative">
                                <div className={`w-8 h-4 rounded-full transition-colors duration-200 ${p.featured ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${p.featured ? 'translate-x-4' : ''}`} />
                              </div>
                            </label>
                          </td>
                          {/* Active toggle */}
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => handleToggleActive(p)}
                              title={p.active ? 'ปิดสินค้า' : 'เปิดสินค้า'}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg border text-white shadow-[0_2px_0] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all mx-auto ${
                                p.active ? 'bg-green-500 border-green-600 shadow-[0_2px_0_#15803d]' : 'bg-gray-400 border-gray-500 shadow-[0_2px_0_#6b7280]'
                              }`}>
                              <i className={`fas text-[10px] ${p.active ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                            </button>
                          </td>
                          {/* Actions */}
                          <td className="px-3 py-1.5">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openBuyers(p)} title="ผู้ซื้อ"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-500 border border-purple-600 text-white shadow-[0_2px_0_#6d28d9] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                                <i className="fas fa-users text-[10px]"></i>
                              </button>
                              <button onClick={() => setViewingCmd({ name: p.name, command: p.command || '' })} title="RCON"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_2px_0_#1d4ed8] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                                <i className="fas fa-terminal text-[10px]"></i>
                              </button>
                              <button onClick={() => openEdit(p)} title="แก้ไข"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                                <i className="fas fa-pen text-[10px]"></i>
                              </button>
                              <button onClick={() => handleDelete(p.id)} title="ลบ"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                                <i className="fas fa-trash text-[10px]"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <i className="fas fa-box-open text-3xl text-gray-200 mb-3 block"></i>
                          <p className="text-sm text-gray-400">ไม่พบสินค้า</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
                  <p className="text-[10px] text-gray-400">
                    แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 disabled:opacity-40 transition-all text-xs">
                      <i className="fas fa-chevron-left text-[9px]"></i>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-bold transition-all ${
                            page === p ? 'bg-[#1e2735] text-white shadow-[0_2px_0_#38404d]' : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}>
                          {p}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 disabled:opacity-40 transition-all text-xs">
                      <i className="fas fa-chevron-right text-[9px]"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Product Edit Modal ──────────────────────────────── */}
      {editing && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setEditing(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-2xl my-4 overflow-hidden"
            onMouseDown={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-cube text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">{editing.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
                <p className="text-[11px] text-gray-500">{editing.id ? 'แก้ไขรายละเอียดสินค้าที่เลือก' : 'กำหนดรายละเอียดและ RCON commands'}</p>
              </div>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5">
              {error && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5 mb-4"><i className="fas fa-exclamation-circle"></i> {error}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อสินค้า *</label>
                  <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" placeholder="เช่น VIP Rank" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">รายละเอียด</label>
                  <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 h-20 resize-none" placeholder="รายละเอียดสินค้า..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ราคา (฿) *</label>
                  <input type="number" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ราคาเดิม (฿)</label>
                  <input type="number" value={editing.original_price || ''} onChange={e => setEditing({ ...editing, original_price: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" min={0} placeholder="ไม่บังคับ (แสดงส่วนลด)" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">หมวดหมู่</label>
                  <select value={editing.category_id || ''} onChange={e => setEditing({ ...editing, category_id: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20">
                    <option value="">-- เลือก --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Image URL</label>
                  <input value={editing.image || ''} onChange={e => setEditing({ ...editing, image: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" placeholder="https://..." />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">RCON Commands *</label>
                  <textarea
                    value={editing.command || ''}
                    onChange={e => setEditing({ ...editing, command: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 h-20 resize-none font-mono"
                    placeholder={"give {player} diamond 1\nsay {player} bought an item!"}
                  />
                  <p className="text-xs text-gray-400 mt-1">ใช้ <code className="bg-gray-100 px-1 rounded">{'{player}'}</code> แทนชื่อผู้เล่น (หนึ่งคำสั่งต่อบรรทัด)</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">เซิร์ฟเวอร์ที่ใช้ได้</label>
                  <div className="flex flex-wrap gap-2">
                    {servers.map(s => {
                      const checked = editing.server_ids?.includes(s.id) || false;
                      return (
                        <label key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm transition-all ${checked ? 'bg-[#1e2735] text-white border-[#1e2735]' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const ids = editing.server_ids || [];
                              setEditing({ ...editing, server_ids: checked ? ids.filter(id => id !== s.id) : [...ids, s.id] });
                            }}
                            className="accent-white"
                          />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.featured || false} onChange={e => setEditing({ ...editing, featured: e.target.checked })} className="accent-[#1e2735] w-4 h-4" />
                    <span className="text-sm"><i className="fas fa-star text-yellow-500 mr-1"></i>สินค้าแนะนำ</span>
                  </label>
                </div>
              </div>

            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]">
                {saving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })(), document.body)}

      {/* ─── Buyers Modal ───────────────────────────────────── */}
      {buyersModal && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget) setBuyersModal(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-users text-purple-500 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">ผู้ซื้อล่าสุด</h3>
                <p className="text-[11px] text-gray-500">{buyersModal.product.name}</p>
              </div>
              <button onClick={() => setBuyersModal(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {buyersModal.loading ? (
                <div className="flex items-center justify-center py-16">
                  <i className="fas fa-spinner fa-spin text-2xl text-purple-400"></i>
                </div>
              ) : buyersModal.purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <i className="fas fa-users text-3xl mb-3 text-gray-200"></i>
                  <p className="text-sm font-medium">ยังไม่มีประวัติการซื้อ</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-500 uppercase border-b border-gray-100 bg-slate-50/40">
                      <th className="px-5 py-3 font-bold">ผู้ซื้อ</th>
                      <th className="px-5 py-3 font-bold">เซิร์ฟเวอร์</th>
                      <th className="px-5 py-3 font-bold text-center">ราคา</th>
                      <th className="px-5 py-3 font-bold text-center">สถานะ</th>
                      <th className="px-5 py-3 font-bold">วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {buyersModal.purchases.map(pu => (
                      <tr key={pu.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://minotar.net/avatar/${pu.username}/24`}
                              alt={pu.username}
                              className="w-7 h-7 rounded flex-shrink-0 image-rendering-pixelated"
                              style={{ imageRendering: 'pixelated' }}
                              onError={e => { (e.target as HTMLImageElement).src = 'https://minotar.net/avatar/MHF_Steve/24'; }}
                            />
                            <span className="font-bold text-gray-800 text-[13px]">{pu.username}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{pu.server_name}</td>
                        <td className="px-5 py-3 text-center font-bold text-gray-800">{Number(pu.price).toLocaleString()} ฿</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            pu.status === 'delivered' ? 'bg-green-500 text-white' :
                            pu.status === 'failed' ? 'bg-red-500 text-white' :
                            pu.status === 'refunded' ? 'bg-orange-500 text-white' :
                            'bg-gray-400 text-white'
                          }`}>
                            {pu.status === 'delivered' ? 'สำเร็จ' : pu.status === 'failed' ? 'ล้มเหลว' : pu.status === 'refunded' ? 'คืนเงิน' : pu.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400">
                          {new Date(pu.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ); })(), document.body)}

      {/* ─── RCON Command Viewer Modal ───────────────────────── */}
      {viewingCmd && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget) setViewingCmd(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
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
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-tags text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">จัดการหมวดหมู่</h3>
                <p className="text-[11px] text-gray-500">เพิ่ม แก้ไข ลบหมวดหมู่สินค้า</p>
              </div>
              <button onClick={() => { setCatModalOpen(false); setCatEditing(null); }} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Category list */}
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {categories.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <i className="fas fa-tags text-2xl mb-2 block opacity-30"></i>
                    <p className="text-sm">ยังไม่มีหมวดหมู่</p>
                  </div>
                )}
                {categories.map((c, idx) => (
                  <div key={c.id}
                    draggable
                    onDragStart={() => { dragCatIdx.current = idx; }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      const from = dragCatIdx.current;
                      if (from === null || from === idx) return;
                      const next = [...categories];
                      next.splice(idx, 0, next.splice(from, 1)[0]);
                      dragCatIdx.current = null;
                      handleReorderCats(next);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group active:opacity-70"
                  >
                    <i className="fas fa-grip-vertical text-gray-300 group-hover:text-gray-400 text-sm flex-shrink-0 transition-colors"></i>
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <i className={`fas ${c.icon || 'fa-tag'} text-[#f97316] text-[10px]`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.slug}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setCatEditing({ ...c })}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                      >
                        <i className="fas fa-pen text-[10px]"></i>
                      </button>
                      <button
                        onClick={() => handleDeleteCat(c.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all"
                      >
                        <i className="fas fa-trash text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add/Edit form */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-xs font-bold text-gray-500 mb-3">
                  {catEditing?.id ? `แก้ไข: ${catEditing.name}` : 'เพิ่มหมวดหมู่ใหม่'}
                </h4>
                {catError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5 mb-3"><i className="fas fa-exclamation-circle"></i> {catError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อหมวดหมู่ *</label>
                    <input
                      value={catEditing?.name || ''}
                      onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), name: e.target.value, slug: prev?.id ? prev.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      placeholder="เช่น VIP Rank"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Slug</label>
                    <input
                      value={catEditing?.slug || ''}
                      onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), slug: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      placeholder="vip-rank"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Icon (FA class)</label>
                    <input
                      value={catEditing?.icon || ''}
                      onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), icon: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      placeholder="fa-crown"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ลำดับ</label>
                    <input
                      type="number"
                      value={catEditing?.sort_order ?? 0}
                      onChange={e => setCatEditing(prev => ({ ...(prev || emptyCategory), sort_order: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                      min={0}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {catEditing?.id && (
                    <button onClick={() => setCatEditing(null)} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all">
                      <i className="fas fa-times text-[11px]"></i> ยกเลิก
                    </button>
                  )}
                  <button
                    onClick={handleSaveCat}
                    disabled={catSaving || !catEditing?.name}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2735] disabled:opacity-50 text-white text-[12px] font-bold rounded-lg shadow-[0_3px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[1px]"
                  >
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
