'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { DateTimeField, addYears } from '@/components/admin/datetime';
import { useAdminAlert } from '@/components/AdminAlert';
import { NEWS_CATEGORIES, NEWS_CATEGORY_ORDER, type NewsCategory } from '@/lib/news';

// ─── Types ──────────────────────────────────────────────────────────────────

type NewsState = 'draft' | 'scheduled' | 'published' | 'expired' | 'deleted';

interface NewsItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  category: NewsCategory;
  cover_image: string | null;
  pinned: number | boolean;
  published_at: string | null;
  expires_at: string | null;
  view_count: number;
  reader_count?: number;
  state: NewsState;
  created_at: string;
  deleted_at?: string | null;
}

interface MediaItem { url: string; caption: string }

interface NewsForm {
  id?: number;
  title: string;
  slug: string;
  category: NewsCategory;
  excerpt: string;
  coverImage: string;
  body: string;
  pinned: boolean;
  publishedAt: string;   // datetime-local
  expiresAt: string;
  mediaMode: 'images' | 'video';
  images: MediaItem[];    // up to 3
  video: MediaItem;       // one youtube
  originalSlug?: string;
  wasPublished?: boolean;
}

const emptyForm: NewsForm = {
  title: '', slug: '', category: 'general', excerpt: '', coverImage: '', body: '',
  pinned: false, publishedAt: '', expiresAt: '',
  mediaMode: 'images', images: [{ url: '', caption: '' }], video: { url: '', caption: '' },
};

const FIELD_LABELS: Record<string, string> = {
  title: 'หัวข้อข่าว', slug: 'URL (slug)', body: 'เนื้อหา', excerpt: 'เกริ่นนำ',
  category: 'หมวดหมู่', cover_image: 'รูปหน้าปก', published_at: 'เวลาเผยแพร่',
  expires_at: 'เวลาหมดอายุ', media: 'สื่อในบทความ',
};

const STATE_INFO: Record<NewsState, { label: string; className: string; dot: string }> = {
  published: { label: 'เผยแพร่แล้ว', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  scheduled: { label: 'ตั้งเวลาไว้', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  draft:     { label: 'ฉบับร่าง', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  expired:   { label: 'หมดอายุ', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  deleted:   { label: 'ถูกลบ', className: 'bg-rose-50 text-rose-600 border-rose-200', dot: 'bg-rose-500' },
};

const CATEGORY_ADMIN: Record<NewsCategory, string> = {
  update:      'bg-sky-50 text-sky-600 border-sky-200',
  event:       'bg-violet-50 text-violet-600 border-violet-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  patch:       'bg-emerald-50 text-emerald-600 border-emerald-200',
  general:     'bg-gray-100 text-gray-500 border-gray-200',
};

// The local <-> ISO pair lives in @/components/admin/datetime (thaiDate.ts).
// It used to be copied into this file, campaigns and rewards/news, plus
// lib/saleWindow - four copies that drifted into the sale-duration bug.
import { toLocalInput, fromLocalInput } from '@/components/admin/datetime';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

/** Client-side slug preview - keeps Thai, matches the server's slugify shape. */
function slugPreview(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function AdminNews() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'live' | 'trash'>('live');
  const [trash, setTrash] = useState<NewsItem[]>([]);
  const [trashLoaded, setTrashLoaded] = useState(false);
  const [, setTick] = useState(0);

  const [form, setForm] = useState<NewsForm | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([]);

  const [readersFor, setReadersFor] = useState<NewsItem | null>(null);
  const [readers, setReaders] = useState<{ id: number; username: string; read_at: string }[]>([]);
  const [readersLoading, setReadersLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const load = () => {
    setLoading(true);
    api('/admin/news', { token: getToken()! })
      .then(d => setItems((d.news as NewsItem[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadTrash = () => {
    api('/admin/news/deleted', { token: getToken()! })
      .then(d => setTrash((d.news as NewsItem[]) || []))
      .catch(() => {})
      .finally(() => setTrashLoaded(true));
  };
  const openTrash = () => { setTab('trash'); if (!trashLoaded) loadTrash(); };

  // Stored window captured at open; null when creating. Create and edit share
  // one modal and one form object, so a stale ref would let a new article
  // inherit the edited one's floor.
  const originalRef = useRef<{ expiresAt: Date | null }>({ expiresAt: null });

  const openCreate = () => {
    originalRef.current = { expiresAt: null };
    setForm({ ...emptyForm, images: [{ url: '', caption: '' }], video: { url: '', caption: '' } });
    setSlugTouched(false); setError(''); setFieldErrors([]);
  };

  const openEdit = async (n: NewsItem) => {
    try {
      const d = await api(`/admin/news/${n.id}`, { token: getToken()! });
      const full = d.news as NewsItem & { body: string | null; media: { type: string; url: string; caption: string | null }[] };
      const imgs = (full.media || []).filter(m => m.type === 'image').map(m => ({ url: m.url, caption: m.caption || '' }));
      const vid = (full.media || []).find(m => m.type === 'youtube');
      originalRef.current = { expiresAt: full.expires_at ? new Date(full.expires_at) : null };
      setForm({
        id: full.id,
        title: full.title,
        slug: full.slug,
        category: full.category,
        excerpt: full.excerpt || '',
        coverImage: full.cover_image || '',
        body: full.body || '',
        pinned: Boolean(full.pinned),
        publishedAt: toLocalInput(full.published_at),
        expiresAt: toLocalInput(full.expires_at),
        mediaMode: vid ? 'video' : 'images',
        images: imgs.length > 0 ? imgs : [{ url: '', caption: '' }],
        video: vid ? { url: vid.url, caption: vid.caption || '' } : { url: '', caption: '' },
        originalSlug: full.slug,
        wasPublished: full.state === 'published' || full.state === 'expired',
      });
      setSlugTouched(true);
      setError('');
      setFieldErrors([]);
    } catch (err: any) {
      await adminAlert({ title: 'โหลดข่าวไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const buildMedia = (f: NewsForm) => {
    if (f.mediaMode === 'video') {
      return f.video.url.trim() ? [{ type: 'youtube' as const, url: f.video.url.trim(), caption: f.video.caption.trim() || null }] : [];
    }
    return f.images.filter(m => m.url.trim()).slice(0, 3).map(m => ({ type: 'image' as const, url: m.url.trim(), caption: m.caption.trim() || null }));
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.title.trim()) { setError('กรอกหัวข้อข่าวก่อนบันทึก'); return; }

    // Guard the published-slug change here too, with a clear confirm, before the
    // backend rejects it - so the admin isn't surprised by a raw error.
    let allowSlugChange = false;
    if (form.id && form.wasPublished && slugPreview(form.slug) !== (form.originalSlug || '')) {
      const ok = await adminConfirm({
        title: 'เปลี่ยน URL ของข่าวที่เผยแพร่แล้ว',
        message: 'ข่าวนี้เผยแพร่แล้ว การแก้ URL จะทำให้ลิงก์เดิมที่แชร์ไปเสีย ยืนยันหรือไม่',
        type: 'warning', confirmLabel: 'ยืนยันเปลี่ยน URL',
      });
      if (!ok) return;
      allowSlugChange = true;
    }

    setSaving(true);
    setError('');
    setFieldErrors([]);
    try {
      const body: Record<string, any> = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        category: form.category,
        excerpt: form.excerpt.trim() || null,
        cover_image: form.coverImage.trim() || null,
        body: form.body.trim() || null,
        pinned: form.pinned,
        published_at: fromLocalInput(form.publishedAt),
        expires_at: fromLocalInput(form.expiresAt),
        media: buildMedia(form),
        allowSlugChange,
      };
      if (form.id) {
        await api(`/admin/news/${form.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/news', { method: 'POST', token: getToken()!, body });
      }
      setForm(null);
      adminAlert({ title: form.id ? 'บันทึกข่าวแล้ว' : 'สร้างข่าวแล้ว', type: 'success' });
      load();
    } catch (err: unknown) {
      const fe = (err as { fieldErrors?: { field: string; message: string }[] })?.fieldErrors;
      if (Array.isArray(fe) && fe.length > 0) {
        setFieldErrors(fe);
        setError('กรอกข้อมูลไม่ครบหรือไม่ถูกต้อง โปรดตรวจรายการด้านล่าง');
      } else {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (n: NewsItem) => {
    try {
      await api(`/admin/news/${n.id}/duplicate`, { method: 'POST', token: getToken()! });
      adminAlert({ title: 'คัดลอกเป็นฉบับร่างแล้ว', type: 'success' });
      load();
    } catch (err: any) {
      await adminAlert({ title: 'คัดลอกไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const handleDelete = async (n: NewsItem) => {
    if (!await adminConfirm({
      title: 'ลบข่าว',
      message: `ต้องการลบ "${n.title}" หรือไม่ (ย้ายไปถังขยะ กู้คืนได้ภายหลัง)`,
      type: 'danger', confirmLabel: 'ลบ',
    })) return;
    try {
      await api(`/admin/news/${n.id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ย้ายข่าวไปถังขยะแล้ว', type: 'success' });
      load();
      if (trashLoaded) loadTrash();
    } catch (err: any) {
      await adminAlert({ title: 'ลบไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const handleRestore = async (n: NewsItem) => {
    try {
      await api(`/admin/news/${n.id}/restore`, { method: 'POST', token: getToken()! });
      adminAlert({ title: 'กู้คืนข่าวแล้ว', type: 'success' });
      loadTrash();
      load();
    } catch (err: any) {
      await adminAlert({ title: 'กู้คืนไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const openReaders = async (n: NewsItem) => {
    setReadersFor(n);
    setReaders([]);
    setReadersLoading(true);
    try {
      const d = await api(`/admin/news/${n.id}/readers`, { token: getToken()! });
      setReaders((d.readers as any[]) || []);
    } catch { /* keep empty */ }
    finally { setReadersLoading(false); }
  };

  const updateImage = (i: number, patch: Partial<MediaItem>) => {
    if (!form) return;
    const images = form.images.map((m, idx) => idx === i ? { ...m, ...patch } : m);
    setForm({ ...form, images });
  };
  const addImage = () => { if (form && form.images.length < 3) setForm({ ...form, images: [...form.images, { url: '', caption: '' }] }); };
  const removeImage = (i: number) => { if (!form) return; const images = form.images.filter((_, idx) => idx !== i); setForm({ ...form, images: images.length ? images : [{ url: '', caption: '' }] }); };

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-newspaper text-[#f97316]"></i> ข่าวสาร (บล็อก)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            หน้าอ่านข่าว แพตช์โน้ต และกิจกรรม แยกจากสไลด์หน้าแรก ผู้เล่นกดเข้าไปอ่านเป็นหน้าเต็มได้
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-green-600 border border-green-700 text-white text-sm font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all flex items-center gap-2">
          <i className="fas fa-plus text-xs"></i> เขียนข่าวใหม่
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('live')}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'live' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
          <i className="fas fa-newspaper mr-1.5 text-xs"></i> ข่าวทั้งหมด
        </button>
        <button onClick={openTrash}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'trash' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
          <i className="fas fa-trash-can mr-1.5 text-xs"></i> ถังขยะ
        </button>
      </div>

      {/* ── Live list ────────────────────────────────────────────────── */}
      {tab === 'live' && (loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-newspaper text-gray-300 text-xl"></i>
          </div>
          <p className="text-sm font-bold text-gray-700">ยังไม่มีข่าว</p>
          <p className="text-xs text-gray-500 mt-1">กด &quot;เขียนข่าวใหม่&quot; เพื่อสร้างบทความแรก</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const st = STATE_INFO[n.state];
            const cat = NEWS_CATEGORIES[n.category] ?? NEWS_CATEGORIES.general;
            return (
              <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {n.cover_image ? <img src={n.cover_image} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-newspaper text-gray-300"></i>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {Boolean(n.pinned) && <i className="fas fa-thumbtack text-[#f97316] text-[11px]" title="ปักหมุด"></i>}
                    <span className="font-bold text-sm text-gray-800 truncate">{n.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CATEGORY_ADMIN[n.category] ?? CATEGORY_ADMIN.general}`}>{cat.label}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span> {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400 flex-wrap">
                    <span className="font-mono text-gray-400">/{n.slug}</span>
                    {n.published_at && <span><i className="far fa-calendar mr-1"></i>{fmtDate(n.published_at)}</span>}
                    <span><i className="far fa-eye mr-1"></i>{Number(n.view_count).toLocaleString()} วิว</span>
                    <span><i className="fas fa-user-check mr-1"></i>{Number(n.reader_count ?? 0).toLocaleString()} คนอ่าน</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => openReaders(n)}
                    className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 transition-colors" title="ใครอ่านแล้วบ้าง">
                    <i className="fas fa-users text-[11px]"></i>
                  </button>
                  <button onClick={() => handleDuplicate(n)}
                    className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 transition-colors" title="คัดลอกเป็นฉบับร่าง">
                    <i className="fas fa-copy text-[11px]"></i>
                  </button>
                  <button onClick={() => openEdit(n)}
                    className="w-8 h-8 rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_3px_0_#1d4ed8] active:translate-y-[3px] active:shadow-none transition-all" title="แก้ไข">
                    <i className="fas fa-pen text-[11px]"></i>
                  </button>
                  <button onClick={() => handleDelete(n)}
                    className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_3px_0_#b91c1c] active:translate-y-[3px] active:shadow-none transition-all" title="ลบ">
                    <i className="fas fa-trash text-[11px]"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Trash ────────────────────────────────────────────────────── */}
      {tab === 'trash' && (!trashLoaded ? (
        <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : trash.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-trash-can text-gray-300 text-xl"></i>
          </div>
          <p className="text-sm font-bold text-gray-700">ถังขยะว่าง</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trash.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-gray-800 truncate">{n.title}</span>
                <p className="text-[11px] text-gray-400 mt-0.5">ลบเมื่อ {fmtDate(n.deleted_at ?? null)}</p>
              </div>
              <button onClick={() => handleRestore(n)}
                className="px-3 py-1.5 rounded-lg bg-green-600 border border-green-700 text-white text-xs font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all flex items-center gap-1.5">
                <i className="fas fa-rotate-left text-[10px]"></i> กู้คืน
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* ── Editor modal ─────────────────────────────────────────────── */}
      {form && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setForm(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            onMouseDown={e => e.stopPropagation()}>

            <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-newspaper text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-sm">{form.id ? 'แก้ไขข่าว' : 'เขียนข่าวใหม่'}</h3>
              </div>
              <button onClick={() => setForm(null)} disabled={saving}
                className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-2"><i className="fas fa-exclamation-circle"></i> {error}</p>
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1.5 ml-5 list-disc text-[11px] text-red-600 space-y-0.5">
                      {fieldErrors.map((fe, i) => <li key={i}><span className="font-bold">{FIELD_LABELS[fe.field] || fe.field}</span>: {fe.message}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">หัวข้อข่าว <span className="text-red-500">*</span></label>
                <input value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value, slug: slugTouched ? form.slug : slugPreview(e.target.value) })}
                  maxLength={255} placeholder="เช่น อัปเดตแพตช์ 1.5 พร้อมไอเท็มใหม่"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">URL (slug)</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 font-mono">/news/</span>
                    <input value={form.slug} onChange={e => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} maxLength={200}
                      placeholder="ปล่อยว่างให้สร้างอัตโนมัติ"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">หมวดหมู่</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as NewsCategory })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white">
                    {NEWS_CATEGORY_ORDER.map(c => <option key={c} value={c}>{NEWS_CATEGORIES[c].label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">เกริ่นนำ (ไม่ใส่จะตัดจากเนื้อหาให้)</label>
                <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} maxLength={500} rows={2}
                  placeholder="สรุปสั้น ๆ ที่จะโชว์ในหน้ารวมข่าว"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">รูปหน้าปก (URL)</label>
                <input value={form.coverImage} onChange={e => setForm({ ...form, coverImage: e.target.value })} maxLength={500}
                  placeholder="/uploads/... หรือ https://..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">เนื้อหา (รองรับ Markdown)</label>
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} maxLength={100000} rows={8}
                  placeholder={'## หัวข้อ\n\nเนื้อหาข่าว รองรับ **ตัวหนา**, *ตัวเอียง*, - รายการ, > อ้างอิง และลิงก์'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none font-mono leading-relaxed" />
                <p className="text-[11px] text-gray-400 mt-1">รองรับ ## หัวข้อ, **หนา**, *เอียง*, - รายการ, {'>'} อ้างอิง (HTML จะถูกตัดออกเพื่อความปลอดภัย)</p>
              </div>

              {/* Media: images (in-article carousel) OR one video */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">สื่อในบทความ</span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 ml-auto">
                    <button type="button" onClick={() => setForm({ ...form, mediaMode: 'images' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${form.mediaMode === 'images' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>
                      <i className="fas fa-images mr-1"></i> รูป (สูงสุด 3)
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, mediaMode: 'video' })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${form.mediaMode === 'video' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>
                      <i className="fab fa-youtube mr-1"></i> วิดีโอ
                    </button>
                  </div>
                </div>

                {form.mediaMode === 'images' ? (
                  <div className="space-y-2">
                    {form.images.map((m, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <input value={m.url} onChange={e => updateImage(i, { url: e.target.value })} maxLength={500}
                            placeholder="/uploads/screenshot.png (ต้องเป็นไฟล์ในเว็บ ขึ้นต้นด้วย /)"
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-gray-400" />
                          <input value={m.caption} onChange={e => updateImage(i, { caption: e.target.value })} maxLength={255}
                            placeholder="คำบรรยายรูป (ไม่ใส่ก็ได้)"
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-gray-400" />
                        </div>
                        <button type="button" onClick={() => removeImage(i)}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-500 flex-shrink-0" aria-label="ลบรูป">
                          <i className="fas fa-times text-[11px]"></i>
                        </button>
                      </div>
                    ))}
                    {form.images.length < 3 && (
                      <button type="button" onClick={addImage}
                        className="text-xs font-bold text-gray-600 hover:text-gray-800 flex items-center gap-1.5">
                        <i className="fas fa-plus text-[10px]"></i> เพิ่มรูป
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400">หลายรูปจะเลื่อนดูได้เหมือนแกลเลอรีสินค้า รูปต้องอัปโหลดในเว็บ (URL ขึ้นต้นด้วย /)</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input value={form.video.url} onChange={e => setForm({ ...form, video: { ...form.video, url: e.target.value } })} maxLength={500}
                      placeholder="วางลิงก์ YouTube (https://youtu.be/... หรือ watch?v=...)"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-gray-400" />
                    <input value={form.video.caption} onChange={e => setForm({ ...form, video: { ...form.video, caption: e.target.value } })} maxLength={255}
                      placeholder="คำบรรยายวิดีโอ (ไม่ใส่ก็ได้)"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-gray-400" />
                    <p className="text-[11px] text-gray-400">วางลิงก์ YouTube ได้เลย ระบบจะดึงเฉพาะรหัสวิดีโอมาฝังแบบปลอดภัย</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">เวลาเผยแพร่</label>
                  <DateTimeField
                    value={form.publishedAt}
                    onChange={v => setForm({ ...form, publishedAt: v })}
                    clearable
                    placeholder="เว้นว่าง = ฉบับร่าง"
                    bounds={{ pairMax: form.expiresAt ? new Date(form.expiresAt) : null }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = ฉบับร่าง (ยังไม่แสดง), ตั้งเวลาอนาคต = ตั้งเวลาโพสต์</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">เวลาหมดอายุ</label>
                  <DateTimeField
                    value={form.expiresAt}
                    onChange={v => setForm({ ...form, expiresAt: v })}
                    clearable
                    placeholder="เว้นว่าง = ไม่มีกำหนด"
                    bounds={{
                      disablePast: true,
                      originalValue: originalRef.current.expiresAt,
                      pairMin: form.publishedAt ? new Date(form.publishedAt) : null,
                      policyMax: addYears(form.publishedAt ? new Date(form.publishedAt) : new Date(), 1),
                    }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = ไม่มีกำหนด</p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${form.pinned ? 'bg-green-600' : 'bg-gray-300'}`}
                  onClick={() => setForm({ ...form, pinned: !form.pinned })}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.pinned ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
                <span className="text-sm font-bold text-gray-800">ปักหมุดข่าวนี้ไว้บนสุด</span>
              </label>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2 flex-shrink-0">
              <button onClick={() => setForm(null)} disabled={saving}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-bold">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-xl bg-green-600 border border-green-700 text-white text-sm font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-60 flex items-center gap-2">
                {saving ? <><i className="fas fa-spinner fa-spin text-xs"></i> กำลังบันทึก</> : <><i className="fas fa-check text-xs"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })(), document.body)}

      {/* ── Readers modal ────────────────────────────────────────────── */}
      {readersFor && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) setReadersFor(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-md max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2 flex-shrink-0">
              <i className="fas fa-users text-gray-500 text-sm"></i>
              <h3 className="font-bold text-gray-900 text-sm flex-1 truncate">ใครอ่านแล้วบ้าง: {readersFor.title}</h3>
              <button onClick={() => setReadersFor(null)}
                className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_3px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {readersLoading ? (
                <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-9 rounded-lg bg-gray-100 animate-pulse" />)}</div>
              ) : readers.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">ยังไม่มีสมาชิกที่ล็อกอินอ่านข่าวนี้</p>
              ) : (
                <div className="space-y-1.5">
                  {readers.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
                      <img src={`https://mc-heads.net/avatar/${r.username}/28`} alt="" width={28} height={28}
                        className="w-7 h-7 rounded-md" style={{ imageRendering: 'pixelated' }} />
                      <span className="font-bold text-sm text-gray-800 flex-1 truncate">{r.username}</span>
                      <span className="text-[11px] text-gray-400 tabular-nums">{fmtDate(r.read_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
}
