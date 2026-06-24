'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import {
  GalleryHorizontalEnd, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X,
  ArrowUp, ArrowDown, Upload, ImageOff,
} from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  description: string;
  image_data: string;
  sort_order: number;
  is_active: 0 | 1;
}

const blank = { id: 0, title: '', description: '', image_data: '' };

/** Resize an uploaded image to a sane max dimension and re-encode as JPEG so the
 *  stored base64 stays small (landing loads every slide on first paint). */
function fileToResizedDataUrl(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas unsupported'));
        ctx.drawImage(img, 0, 0, width, height);
        // PNG with transparency would lose its alpha on JPEG; keep PNG only if small.
        const usesAlpha = file.type === 'image/png';
        const out = usesAlpha && file.size < 400_000
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

export default function ShowcasePage() {
  const [items, setItems] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/showcase/admin');
      setItems(data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persistOrder = async (ordered: Slide[]) => {
    setItems(ordered);
    setReordering(true);
    try {
      await api.post('/api/showcase/admin/reorder', { ids: ordered.map(i => i.id) });
    } catch { await load(); } finally { setReordering(false); }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    persistOrder(copy);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editing) return;
    if (!file.type.startsWith('image/')) { setErr('กรุณาเลือกไฟล์รูปภาพ'); return; }
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setEditing({ ...editing, image_data: dataUrl });
      setErr('');
    } catch (e: any) {
      setErr(e?.message || 'ประมวลผลรูปไม่สำเร็จ');
    }
  };

  const save = async () => {
    if (!editing) return;
    setErr('');
    if (!editing.title.trim()) { setErr('กรุณาระบุหัวข้อ'); return; }
    if (!editing.image_data)   { setErr('กรุณาอัปโหลดรูปภาพ'); return; }
    setSaving(true);
    try {
      const payload = {
        title: editing.title.trim(),
        description: editing.description,
        imageData: editing.image_data,
      };
      if (editing.id) await api.put(`/api/showcase/admin/${editing.id}`, payload);
      else            await api.post('/api/showcase/admin', payload);
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const toggleActive = async (s: Slide) => {
    await api.patch(`/api/showcase/admin/${s.id}/active`, { active: !s.is_active });
    await load();
  };

  const remove = async (s: Slide) => {
    if (!confirm(`ลบสไลด์ "${s.title}" ?`)) return;
    await api.delete(`/api/showcase/admin/${s.id}`);
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <GalleryHorizontalEnd className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ตัวอย่างฟีเจอร์ (หน้าแรก)</h1>
            <p className="text-xs text-muted-foreground">จัดการสไลด์โชว์ฟีเจอร์บนหน้า Landing เปลี่ยนรูปและข้อความได้ทุกเมื่อ</p>
          </div>
        </div>
        <button onClick={() => { setErr(''); setEditing({ ...blank }); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110">
          <Plus className="w-4 h-4" /> เพิ่มสไลด์
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          ยังไม่มีสไลด์ที่ตั้งค่าไว้ หน้าแรกจะแสดงสไลด์เริ่มต้นจนกว่าจะเพิ่มรายการแรก
        </div>
      ) : (
        <div className="space-y-3">
          {reordering && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> กำลังบันทึกลำดับ...
            </p>
          )}
          {items.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button disabled={i === 0} onClick={() => move(i, -1)}
                  className="p-1 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp className="w-4 h-4" /></button>
                <button disabled={i === items.length - 1} onClick={() => move(i, 1)}
                  className="p-1 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDown className="w-4 h-4" /></button>
              </div>
              <div className="w-24 h-16 rounded-lg overflow-hidden bg-secondary flex-shrink-0 border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image_data} alt={s.title} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {s.is_active
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">แสดงอยู่</span>
                    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ซ่อน</span>}
                  <h3 className="font-bold text-sm truncate">{s.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button title={s.is_active ? 'ซ่อน' : 'แสดง'} onClick={() => toggleActive(s)}
                  className={`p-2 rounded-lg hover:bg-secondary ${s.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {s.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button title="แก้ไข" onClick={() => { setErr(''); setEditing({ id: s.id, title: s.title, description: s.description, image_data: s.image_data }); }}
                  className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                <button title="ลบ" onClick={() => remove(s)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">{editing.id ? 'แก้ไขสไลด์' : 'เพิ่มสไลด์'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>}

            <div className="grid md:grid-cols-2 gap-5">
              {/* ── Form ── */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">หัวข้อ</label>
                  <input value={editing.title} maxLength={200} onChange={e => setEditing({ ...editing, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="เช่น ระบบกล่องสุ่ม Gacha" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">คำอธิบาย</label>
                  <textarea value={editing.description} rows={4} maxLength={2000}
                    onChange={e => setEditing({ ...editing, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
                    placeholder="อธิบายฟีเจอร์สั้น ๆ" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">รูปภาพ</label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary">
                    <Upload className="w-4 h-4" /> {editing.image_data ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-1">รูปจะถูกย่อขนาดอัตโนมัติเพื่อให้โหลดเร็ว</p>
                </div>
              </div>

              {/* ── Live preview ── */}
              <div>
                <label className="text-xs font-bold text-muted-foreground">ตัวอย่างที่หน้าแรกจะแสดง</label>
                <div className="mt-1 rounded-xl border border-border bg-secondary/30 p-4 space-y-3 min-h-[280px]">
                  <div className="rounded-xl overflow-hidden bg-background border border-border h-[160px] flex items-center justify-center">
                    {editing.image_data
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={editing.image_data} alt="preview" className="max-w-full max-h-full object-contain" />
                      : <div className="flex flex-col items-center gap-2 text-muted-foreground/50"><ImageOff className="w-8 h-8" /><span className="text-xs">ยังไม่มีรูป</span></div>}
                  </div>
                  <span className="inline-block text-primary border border-primary/20 px-3 py-1 text-xs rounded-full">ตัวอย่างฟีเจอร์</span>
                  <h3 className="text-lg font-bold text-foreground leading-tight">{editing.title || 'หัวข้อฟีเจอร์'}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{editing.description || 'คำอธิบายจะแสดงตรงนี้…'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-secondary">ยกเลิก</button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
