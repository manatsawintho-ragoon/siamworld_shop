'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, X, List, Wand2 } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  body: string;
  level: 'info' | 'update' | 'important';
  is_published: 0 | 1;
  published_at: string | null;
  created_at: string;
}

const LEVELS = [
  { value: 'info',      label: 'ข้อมูล',      cls: 'bg-blue-100 text-blue-700',     bar: 'bg-blue-500',   dot: 'bg-blue-500' },
  { value: 'update',    label: 'อัพเดทใหม่',  cls: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  { value: 'important', label: 'สำคัญ',       cls: 'bg-red-100 text-red-700',       bar: 'bg-red-500',    dot: 'bg-red-500' },
] as const;
const levelMeta = (l: string) => LEVELS.find(x => x.value === l) || LEVELS[1];

const blank = { id: 0, title: '', body: '', level: 'update' as Announcement['level'] };

/** Normalize spacing/indent: trim trailing spaces, unify bullets to "• ", collapse
 *  3+ blank lines to one, drop leading/trailing blank lines. */
function tidy(text: string): string {
  const lines = text.split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .map(l => l.replace(/^(\s*)[-*•]\s+/, '$1• '));
  const out: string[] = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === '') { blanks++; if (blanks <= 1) out.push(''); }
    else { blanks = 0; out.push(l); }
  }
  while (out.length && out[0] === '') out.shift();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Live preview that mirrors the shop-side AnnouncementPopup. */
function PreviewCard({ title, body, level }: { title: string; body: string; level: string }) {
  const lv = levelMeta(level);
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 w-full max-w-sm">
      <div className={`h-1.5 ${lv.bar}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${lv.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lv.dot}`} /> {lv.label}
          </span>
          <span className="text-[11px] text-gray-400">
            {new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <h2 className="text-lg font-black text-gray-800 mb-2 break-words">{title || 'หัวข้อประกาศ'}</h2>
        <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed break-words min-h-[44px]">
          {body || 'เนื้อหาประกาศจะแสดงตรงนี้…'}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-4 h-4 rounded border border-gray-300" /> ไม่แสดงอีก
          </span>
          <span className="px-5 py-2 bg-[#1e2735] text-white rounded-lg text-sm font-bold">รับทราบ</span>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const taRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);     // caret to restore after a controlled-value edit
  const downOnBackdrop = useRef(false);             // distinguishes a real backdrop click from drag-select

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/announcements');
      setItems(data.announcements || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Restore caret after we programmatically rewrite the textarea value.
  useEffect(() => {
    if (caretRef.current != null && taRef.current) {
      taRef.current.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  }, [editing?.body]);

  const setBody = (v: string) => setEditing(e => (e ? { ...e, body: v } : e));

  // Smart editor: Tab indent, Enter auto-continues "• " bullets.
  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value } = ta;

    if (e.key === 'Tab') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      if (e.shiftKey) {
        const line = value.slice(lineStart);
        const remove = line.startsWith('  ') ? 2 : line.startsWith(' ') ? 1 : 0;
        if (remove) {
          caretRef.current = Math.max(lineStart, selectionStart - remove);
          setBody(value.slice(0, lineStart) + value.slice(lineStart + remove));
        }
      } else {
        caretRef.current = selectionStart + 2;
        setBody(value.slice(0, lineStart) + '  ' + value.slice(lineStart));
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const line = value.slice(lineStart, selectionStart);
      const m = line.match(/^(\s*)([•\-*])\s+/);
      if (m) {
        e.preventDefault();
        const rest = line.slice(m[0].length);
        if (rest.trim() === '') {
          // empty bullet → exit the list
          caretRef.current = lineStart;
          setBody(value.slice(0, lineStart) + value.slice(selectionEnd));
        } else {
          const insert = '\n' + m[1] + '• ';
          caretRef.current = selectionStart + insert.length;
          setBody(value.slice(0, selectionStart) + insert + value.slice(selectionEnd));
        }
      }
    }
  };

  const addBullet = () => {
    const ta = taRef.current;
    if (!ta || !editing) return;
    const { selectionStart, value } = ta;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const atLineStart = value.slice(lineStart, selectionStart).trim() === '';
    const prefix = atLineStart ? '• ' : '\n• ';
    caretRef.current = selectionStart + prefix.length;
    setBody(value.slice(0, selectionStart) + prefix + value.slice(selectionStart));
    ta.focus();
  };

  const runTidy = () => { if (editing) setBody(tidy(editing.body)); };

  const save = async () => {
    if (!editing) return;
    setErr('');
    if (!editing.title.trim()) { setErr('กรุณาระบุหัวข้อ'); return; }
    if (!editing.body.trim())  { setErr('กรุณาระบุเนื้อหา'); return; }
    setSaving(true);
    try {
      const payload = { ...editing, body: tidy(editing.body) };   // tidy on save so stored text is clean
      if (editing.id) await api.put(`/api/admin/announcements/${editing.id}`, payload);
      else            await api.post('/api/admin/announcements', payload);
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
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">ประกาศอัพเดท</h2>
          <p className="admin-sub">ประกาศที่เผยแพร่จะแสดงเป็น popup ในหลังบ้านของทุกร้าน</p>
        </div>
        <button onClick={() => { setErr(''); setEditing({ ...blank }); }} className="admin-btn admin-btn-primary">
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
              <div key={a.id} className="admin-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${lm.cls}`}>{lm.label}</span>
                      {a.is_published
                        ? <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">เผยแพร่แล้ว</span>
                        : <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">ฉบับร่าง</span>}
                    </div>
                    <h3 className="font-medium text-[15px] text-foreground mt-1.5 break-words">{a.title}</h3>
                    <p className="text-[13px] text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">{a.body}</p>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
          onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) setEditing(null); }}
        >
          <div className="admin-shell bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">{editing.id ? 'แก้ไขประกาศ' : 'สร้างประกาศ'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            {err && <div className="text-[13px] text-destructive bg-destructive/8 border border-destructive/25 rounded-md px-3 py-2 mb-3">{err}</div>}

            <div className="grid md:grid-cols-2 gap-5">
              {/* ── Form ── */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="ann-title" className="admin-label">หัวข้อ</label>
                  <input id="ann-title" value={editing.title} maxLength={200} onChange={e => setEditing({ ...editing, title: e.target.value })}
                    className="admin-input" placeholder="เช่น อัพเดทแดชบอร์ดใหม่" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="ann-body" className="admin-label mb-0">เนื้อหา</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={addBullet} className="admin-btn admin-btn-sm">
                        <List className="w-3.5 h-3.5" /> หัวข้อย่อย
                      </button>
                      <button type="button" onClick={runTidy} className="admin-btn admin-btn-sm">
                        <Wand2 className="w-3.5 h-3.5" /> จัดระเบียบ
                      </button>
                    </div>
                  </div>
                  <textarea id="ann-body" ref={taRef} value={editing.body} rows={9}
                    onKeyDown={onBodyKeyDown}
                    onChange={e => setEditing({ ...editing, body: e.target.value })}
                    className="admin-textarea font-mono leading-relaxed"
                    placeholder={'พิมพ์เนื้อหา\nEnter หลัง "• " จะขึ้น bullet ใหม่อัตโนมัติ\nกด Tab เพื่อเยื้อง'} />
                  <p className="admin-meta mt-1.5">Enter ต่อ bullet อัตโนมัติ, Tab เยื้อง, ปุ่มจัดระเบียบช่วยจัด spacing ให้</p>
                </div>
                <div>
                  <span className="admin-label">ระดับ</span>
                  <div className="mt-1 flex gap-2">
                    {LEVELS.map(l => (
                      <button key={l.value} type="button" onClick={() => setEditing({ ...editing, level: l.value })}
                        aria-pressed={editing.level === l.value}
                        className={`admin-btn admin-btn-sm ${editing.level === l.value ? l.cls + ' border-transparent' : ''}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Live preview ── */}
              <div>
                <span className="admin-label">ตัวอย่างที่ร้านจะเห็น</span>
                <div className="rounded-md border border-border bg-secondary p-4 flex items-start justify-center min-h-[260px]">
                  <PreviewCard title={editing.title} body={editing.body} level={editing.level} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap pt-4 mt-1 border-t border-border">
              <p className="admin-meta">บันทึกแล้วยังเป็นฉบับร่าง กดปุ่มรูปตาเพื่อเผยแพร่ให้ทุกร้าน</p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setEditing(null)} className="admin-btn flex-1 sm:flex-none">ยกเลิก</button>
                <button onClick={save} disabled={saving} className="admin-btn admin-btn-primary flex-1 sm:flex-none">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
