'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  body: string;
  level: 'info' | 'update' | 'important';
  is_published: 0 | 1;
  published_at: string | null;
  created_at: string;
}

const LEVELS: { value: Announcement['level']; label: string; cls: string }[] = [
  { value: 'info',      label: 'ข้อมูล',  cls: 'bg-blue-100 text-blue-700' },
  { value: 'update',    label: 'อัพเดท',  cls: 'bg-orange-100 text-orange-700' },
  { value: 'important', label: 'สำคัญ',   cls: 'bg-red-100 text-red-700' },
];
const levelMeta = (l: string) => LEVELS.find(x => x.value === l) || LEVELS[1];

const blank = { id: 0, title: '', body: '', level: 'update' as Announcement['level'] };

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/announcements');
      setItems(data.announcements || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setErr('');
    if (!editing.title.trim()) { setErr('กรุณาระบุหัวข้อ'); return; }
    if (!editing.body.trim())  { setErr('กรุณาระบุเนื้อหา'); return; }
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/api/admin/announcements/${editing.id}`, editing);
      } else {
        await api.post('/api/admin/announcements', editing);
      }
      setEditing(null);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const togglePublish = async (a: Announcement) => {
    await api.post(`/api/admin/announcements/${a.id}/publish`, { published: !a.is_published });
    await load();
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`ลบประกาศ "${a.title}" ?`)) return;
    await api.delete(`/api/admin/announcements/${a.id}`);
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ประกาศอัพเดท</h1>
            <p className="text-xs text-muted-foreground">เผยแพร่แล้วจะเด้งเป็น popup ในหลังบ้านของทุกร้าน</p>
          </div>
        </div>
        <button onClick={() => { setErr(''); setEditing({ ...blank }); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110">
          <Plus className="w-4 h-4" /> สร้างประกาศ
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">ยังไม่มีประกาศ</div>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const lm = levelMeta(a.level);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lm.cls}`}>{lm.label}</span>
                      {a.is_published
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">เผยแพร่แล้ว</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ฉบับร่าง</span>}
                      <h3 className="font-bold text-sm truncate">{a.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-line line-clamp-3">{a.body}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button title={a.is_published ? 'ยกเลิกเผยแพร่' : 'เผยแพร่'} onClick={() => togglePublish(a)}
                      className={`p-2 rounded-lg hover:bg-secondary ${a.is_published ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {a.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button title="แก้ไข" onClick={() => { setErr(''); setEditing({ id: a.id, title: a.title, body: a.body, level: a.level }); }}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                    <button title="ลบ" onClick={() => remove(a)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-2xl w-full max-w-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{editing.id ? 'แก้ไขประกาศ' : 'สร้างประกาศ'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
            <div>
              <label className="text-xs font-bold text-muted-foreground">หัวข้อ</label>
              <input value={editing.title} maxLength={200} onChange={e => setEditing({ ...editing, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="เช่น อัพเดทแดชบอร์ดใหม่" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">เนื้อหา (ขึ้นบรรทัดใหม่ได้)</label>
              <textarea value={editing.body} rows={6} onChange={e => setEditing({ ...editing, body: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y" placeholder={'- เพิ่มฟีเจอร์ A\n- แก้บั๊ก B'} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">ระดับ</label>
              <div className="mt-1 flex gap-2">
                {LEVELS.map(l => (
                  <button key={l.value} onClick={() => setEditing({ ...editing, level: l.value })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${editing.level === l.value ? l.cls + ' border-transparent' : 'border-border text-muted-foreground'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-secondary">ยกเลิก</button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">บันทึกแล้วยังเป็นฉบับร่าง กดปุ่มรูปตา (เผยแพร่) เพื่อส่งให้ทุกร้าน</p>
          </div>
        </div>
      )}
    </div>
  );
}
