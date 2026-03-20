'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface Slide {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
  sort_order: number;
  active: boolean;
}

const emptySlide = { title: '', image_url: '', link_url: '', sort_order: 0, active: true };

export default function AdminSlides() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Slide> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api('/admin/slides', { token: getToken()! })
      .then(d => setSlides((d.slides as Slide[]) || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        title: editing.title || null,
        image_url: editing.image_url,
        link_url: editing.link_url || null,
        sort_order: editing.sort_order,
        active: Boolean(editing.active),
      };
      if (editing.id) {
        await api(`/admin/slides/${editing.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/slides', { method: 'POST', token: getToken()!, body });
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
    if (!confirm('ต้องการลบสไลด์นี้?')) return;
    try {
      await api(`/admin/slides/${id}`, { method: 'DELETE', token: getToken()! });
      load();
    } catch { }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <i className="fas fa-images mr-2 text-gray-400"></i>จัดการสไลด์
        </h1>
        <button onClick={() => setEditing({ ...emptySlide })} className="btn-primary text-sm">
          <i className="fas fa-plus"></i> เพิ่มสไลด์
        </button>
      </div>

      <p className="text-sm text-gray-500">
        <i className="fas fa-info-circle mr-1.5"></i>
        สไลด์จะแสดงเป็น Carousel บนหน้าแรก แนะนำขนาดภาพ <strong>1920x500 px</strong>
      </p>

      {loading ? (
        <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>
      ) : slides.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <i className="fas fa-images text-3xl mb-3"></i>
          <p>ยังไม่มีสไลด์</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slides.map(s => (
            <div key={s.id} className="card overflow-hidden">
              <div className="relative h-40 bg-gray-100">
                <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <span className={`badge ${s.active ? 'bg-green-600 text-white' : 'bg-gray-500 text-white'}`}>
                    {s.active ? 'เปิด' : 'ปิด'}
                  </span>
                  <span className="badge bg-black/60 text-white">#{s.sort_order}</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1">{s.title || '(ไม่มีชื่อ)'}</h3>
                <p className="text-xs text-gray-400 truncate mb-3">{s.image_url}</p>
                <div className="flex gap-2">
                  <button onClick={() => setEditing({ ...s })} className="btn bg-gray-100 text-gray-600 text-xs px-3 py-1.5">
                    <i className="fas fa-pen"></i> แก้ไข
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="btn bg-red-50 text-red-600 text-xs px-3 py-1.5">
                    <i className="fas fa-trash"></i> ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => !saving && setEditing(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6">{editing.id ? 'แก้ไขสไลด์' : 'เพิ่มสไลด์ใหม่'}</h3>
              {error && <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ชื่อสไลด์</label>
                  <input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} className="input" placeholder="เช่น โปรโมชั่นพิเศษ" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Image URL *</label>
                  <input value={editing.image_url || ''} onChange={e => setEditing({ ...editing, image_url: e.target.value })} className="input" placeholder="https://example.com/banner.jpg" />
                </div>
                {editing.image_url && (
                  <div className="rounded-md overflow-hidden h-32 bg-gray-100">
                    <img src={editing.image_url} alt="Preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Link URL</label>
                  <input value={editing.link_url || ''} onChange={e => setEditing({ ...editing, link_url: e.target.value })} className="input" placeholder="https://... (ไม่บังคับ)" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ลำดับ</label>
                  <input type="number" value={editing.sort_order || 0} onChange={e => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="input" min={0} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editing.active !== false} onChange={e => setEditing({ ...editing, active: e.target.checked })} className="accent-black w-4 h-4" />
                  <span className="text-sm">เปิดใช้งาน</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                <button onClick={() => setEditing(null)} className="btn-ghost flex-1 justify-center">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <><i className="fas fa-spinner fa-spin"></i> บันทึก...</> : <><i className="fas fa-save"></i> บันทึก</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
