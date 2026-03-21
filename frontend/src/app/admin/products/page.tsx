'use client';
import { useEffect, useState, useRef } from 'react';
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

interface Category { id: number; name: string; }
interface Server { id: number; name: string; }

const emptyProduct = {
  name: '', description: '', price: 0, original_price: 0,
  image: '', command: '', category_id: 0, featured: false,
  active: true, server_ids: [] as number[],
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api('/admin/products', { token: getToken()! }).then(d => setProducts((d.products as Product[]) || [])),
      api('/public/categories').then(d => setCategories((d.categories as Category[]) || [])),
      api('/admin/servers', { token: getToken()! }).then(d => setServers((d.servers as Server[]) || [])),
    ]).finally(() => setLoading(false));
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

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบสินค้านี้?')) return;
    try {
      await api(`/admin/products/${id}`, { method: 'DELETE', token: getToken()! });
      load();
    } catch { }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <i className="fas fa-cube mr-2 text-gray-400"></i>จัดการสินค้า
        </h1>
        <button onClick={() => setEditing({ ...emptyProduct })} className="btn-primary text-sm">
          <i className="fas fa-plus"></i> เพิ่มสินค้า
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th>หมวด</th>
                  <th>ราคา</th>
                  <th>สถานะ</th>
                  <th>แนะนำ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <i className="fas fa-cube text-gray-300"></i>}
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge bg-gray-100 text-gray-600">{p.category_name || '-'}</span></td>
                    <td>
                      <span className="font-bold">{p.price?.toLocaleString()} ฿</span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="text-xs text-gray-400 line-through ml-1">{p.original_price?.toLocaleString()}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.active ? 'เปิด' : 'ปิด'}
                      </span>
                    </td>
                    <td>{p.featured && <i className="fas fa-star text-yellow-500"></i>}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="แก้ไข">
                          <i className="fas fa-pen-to-square"></i>
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="ลบ">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-8">ยังไม่มีสินค้า</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setEditing(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-2xl my-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-store text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">{editing.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
                <p className="text-[11px] text-gray-400">{editing.id ? 'แก้ไขรายละเอียดสินค้าที่เลือก' : 'กำหนดรายละเอียดและ RCON commands'}</p>
              </div>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
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
                    placeholder="give {username} diamond 1&#10;say {username} bought an item!"
                  />
                  <p className="text-xs text-gray-400 mt-1">ใช้ <code className="bg-gray-100 px-1 rounded">{'{username}'}</code> แทนชื่อผู้เล่น (หนึ่งคำสั่งต่อบรรทัด)</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">เซิร์ฟเวอร์ที่ใช้ได้</label>
                  <div className="flex flex-wrap gap-2">
                    {servers.map(s => {
                      const checked = editing.server_ids?.includes(s.id) || false;
                      return (
                        <label key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border ${checked ? 'bg-black text-white border-black' : 'bg-white border-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const ids = editing.server_ids || [];
                              setEditing({ ...editing, server_ids: checked ? ids.filter(id => id !== s.id) : [...ids, s.id] });
                            }}
                            className="accent-black"
                          />
                          <span className="text-sm">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.featured || false} onChange={e => setEditing({ ...editing, featured: e.target.checked })} className="accent-black w-4 h-4" />
                    <span className="text-sm"><i className="fas fa-star text-yellow-500 mr-1"></i>สินค้าแนะนำ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} className="accent-black w-4 h-4" />
                    <span className="text-sm"><i className="fas fa-eye text-green-600 mr-1"></i>เปิดใช้งาน</span>
                  </label>
                </div>
              </div>

            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {saving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}
