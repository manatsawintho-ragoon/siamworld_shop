'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';

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
    if (!confirm('ต้องการลบสินค้านี้?')) return;
    try {
      await api(`/admin/products/${id}`, { method: 'DELETE', token: getToken()! });
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
      loadCategories();
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCat = async (id: number) => {
    if (!confirm('ลบหมวดหมู่นี้? สินค้าในหมวดหมู่จะยังอยู่แต่ไม่มีหมวดหมู่')) return;
    try {
      await api(`/admin/categories/${id}`, { method: 'DELETE', token: getToken()! });
      loadCategories();
      load();
    } catch { }
  };

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            <i className="fas fa-cube mr-2 text-[#f97316]"></i>จัดการสินค้า
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">เพิ่ม แก้ไข และจัดการสินค้าไอเทมทั้งหมดในร้าน</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setCatError(''); setCatEditing(null); setCatModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-bold rounded-lg shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all"
          >
            <i className="fas fa-tags text-[12px] text-[#f97316]"></i> จัดการหมวดหมู่
          </button>
          <button
            onClick={() => setEditing({ ...emptyProduct })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]"
          >
            <i className="fas fa-plus text-[12px]"></i> เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-store text-[#f97316] text-xs"></i>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">รายการสินค้า</h3>
              <p className="text-[11px] text-gray-500">สินค้าทั้งหมด {products.length} รายการ</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
            <p className="text-sm text-gray-400 mt-2">กำลังโหลด...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/40">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">สินค้า</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">หมวด</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">ราคา</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">คำสั่ง RCON</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">แนะนำ</th>
                  <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <i className="fas fa-cube text-gray-300"></i>}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{p.name}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{p.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                        {p.category_name || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-gray-800">{p.price?.toLocaleString()} ฿</span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="text-xs text-gray-400 line-through ml-1">{p.original_price?.toLocaleString()}</span>
                      )}
                    </td>
                    {/* RCON command column */}
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => setViewingCmd({ name: p.name, command: p.command || '' })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_3px_0_#1d4ed8] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all mx-auto"
                        title="ดูคำสั่ง RCON"
                      >
                        <i className="fas fa-terminal text-[11px]"></i>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {p.featured && <i className="fas fa-star text-yellow-500"></i>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5 justify-center">
                        {/* View buyers */}
                        <button
                          onClick={() => openBuyers(p)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500 border border-purple-600 text-white shadow-[0_3px_0_#6d28d9] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all"
                          title="ดูผู้ซื้อล่าสุด"
                        >
                          <i className="fas fa-users text-[11px]"></i>
                        </button>
                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg border text-white shadow-[0_3px_0] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all ${
                            p.active
                              ? 'bg-green-500 border-green-600 shadow-[0_3px_0_#15803d]'
                              : 'bg-gray-400 border-gray-500 shadow-[0_3px_0_#6b7280]'
                          }`}
                          title={p.active ? 'ปิดสินค้า' : 'เปิดสินค้า'}
                        >
                          <i className={`fas text-[11px] ${p.active ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(p)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_3px_0_#b45309] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all"
                          title="แก้ไข"
                        >
                          <i className="fas fa-pen text-[11px]"></i>
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all"
                          title="ลบ"
                        >
                          <i className="fas fa-trash text-[11px]"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <i className="fas fa-box-open text-3xl text-gray-200 mb-3 block"></i>
                      <p className="text-sm text-gray-400">ยังไม่มีสินค้า</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
