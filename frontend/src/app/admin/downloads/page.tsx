'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface Download {
  id: number;
  filename: string;
  description: string;
  file_size: string;
  download_url: string;
  category: string;
  active: number;
  sort_order: number;
}

const EMPTY: Omit<Download, 'id'> = {
  filename: '', description: '', file_size: '', download_url: '', category: '', active: 1, sort_order: 0,
};

export default function AdminDownloadsPage() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Download | null>(null);
  const [form, setForm] = useState<Omit<Download, 'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api('/admin/downloads', { token: getToken()! })
      .then(d => setDownloads((d.downloads as Download[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setShowForm(true); };
  const openEdit = (dl: Download) => {
    setEditing(dl);
    setForm({ filename: dl.filename, description: dl.description, file_size: dl.file_size, download_url: dl.download_url, category: dl.category, active: dl.active, sort_order: dl.sort_order });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.filename.trim() || !form.download_url.trim()) { setError('กรุณากรอกชื่อและ URL'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api(`/admin/downloads/${editing.id}`, { method: 'PUT', token: getToken()!, body: form });
      } else {
        await api('/admin/downloads', { method: 'POST', token: getToken()!, body: form });
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบรายการนี้?')) return;
    try {
      await api(`/admin/downloads/${id}`, { method: 'DELETE', token: getToken()! });
      load();
    } catch {}
  };

  const set = (key: keyof typeof form, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-download text-green-600"></i> จัดการดาวน์โหลด
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">เพิ่ม/แก้ไข/ลบไฟล์ดาวน์โหลดสำหรับผู้เล่น</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
          <i className="fas fa-plus"></i> เพิ่มรายการ
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <i className="fas fa-spinner fa-spin text-2xl text-green-600"></i>
          </div>
        ) : downloads.length === 0 ? (
          <div className="text-center py-16">
            <i className="fas fa-download text-4xl text-gray-300 mb-3"></i>
            <p className="text-gray-500 font-medium">ยังไม่มีรายการดาวน์โหลด</p>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors">
              <i className="fas fa-plus mr-1"></i> เพิ่มรายการแรก
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">ชื่อไฟล์</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">ขนาดไฟล์</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">URL</th>
                <th className="text-center px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">สถานะ</th>
                <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((dl, i) => (
                <tr key={dl.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-file-archive text-green-600 text-sm"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{dl.filename}</p>
                        {dl.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{dl.description}</p>}
                        {dl.category && <p className="text-[10px] text-green-600 font-medium mt-0.5">{dl.category}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-gray-600 text-sm">{dl.file_size || '—'}</span>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <a href={dl.download_url} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-xs truncate max-w-[200px] block">
                      {dl.download_url}
                    </a>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${dl.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dl.active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      {dl.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(dl)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors text-sm">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => handleDelete(dl.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {editing ? 'แก้ไขรายการดาวน์โหลด' : 'เพิ่มรายการดาวน์โหลด'}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">ชื่อไฟล์ <span className="text-red-500">*</span></label>
                <input type="text" value={form.filename} onChange={e => set('filename', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" placeholder="เช่น Minecraft 1.20.1 Client" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">รายละเอียด</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 resize-none" placeholder="คำอธิบายสั้น ๆ เกี่ยวกับไฟล์" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">ขนาดไฟล์</label>
                  <input type="text" value={form.file_size} onChange={e => set('file_size', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" placeholder="เช่น 250 MB" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">ลำดับ</label>
                  <input type="number" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" min={0} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">URL ดาวน์โหลด <span className="text-red-500">*</span></label>
                <input type="url" value={form.download_url} onChange={e => set('download_url', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" placeholder="https://..." required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">หมวดหมู่ (ไม่บังคับ)</label>
                <input type="text" value={form.category} onChange={e => set('category', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20" placeholder="เช่น Client, Mod, Texture" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-300'}`}
                  onClick={() => set('active', form.active ? 0 : 1)}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-sm font-medium text-gray-700">เปิดใช้งาน</span>
              </label>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  <i className="fas fa-exclamation-circle mr-1.5"></i>{error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                  {editing ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-colors">
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
