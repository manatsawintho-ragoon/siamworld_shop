'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NewsItem {
  id: number;
  title: string;
  excerpt: string | null;
  badge: string | null;
  accent: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  active: number | boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface NewsForm {
  id?: number;
  title: string;
  excerpt: string;
  badge: string;
  accent: string;
  imageUrl: string;
  linkUrl: string;
  startsAt: string; // datetime-local value
  endsAt: string;
  active: boolean;
}

const emptyForm: NewsForm = {
  title: '', excerpt: '', badge: '', accent: 'primary',
  imageUrl: '', linkUrl: '', startsAt: '', endsAt: '', active: true,
};

// Must stay in sync with newsAccentEnum (backend) and ACCENTS (HeroCarousel).
const ACCENT_OPTIONS: { value: string; label: string; swatch: string }[] = [
  { value: 'primary', label: 'สีหลักของร้าน', swatch: 'bg-gray-700' },
  { value: 'violet',  label: 'ม่วง',          swatch: 'bg-violet-500' },
  { value: 'amber',   label: 'ส้ม / เหลือง',  swatch: 'bg-amber-500' },
  { value: 'emerald', label: 'เขียว',         swatch: 'bg-emerald-500' },
  { value: 'rose',    label: 'ชมพู / แดง',    swatch: 'bg-rose-500' },
  { value: 'sky',     label: 'ฟ้า',           swatch: 'bg-sky-500' },
];

const FIELD_LABELS: Record<string, string> = {
  title: 'หัวข้อข่าว', excerpt: 'คำอธิบายสั้น', badge: 'ป้ายกำกับ',
  accent: 'สีสไลด์', image_url: 'รูปพื้นหลัง', link_url: 'ลิงก์ปลายทาง',
  starts_at: 'เวลาเริ่มแสดง', ends_at: 'เวลาหยุดแสดง',
};

// ─── Datetime <-> datetime-local helpers ────────────────────────────────────
// <input type="datetime-local"> has no timezone: the browser reads and writes
// its value as LOCAL wall clock. Both helpers must therefore agree on local, or
// the round trip silently shifts the window by the UTC offset (7h here) on
// every edit-and-resave. Same fix as the campaigns page - do not "simplify"
// toLocalInput back to toISOString(), which is UTC.
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  } catch { return ''; }
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const fmtWindow = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

/** Mirrors isNewsPublishedAt() in backend news.service.ts. */
function getStatusInfo(n: NewsItem): { label: string; className: string; dot: string } {
  const now = Date.now();
  if (!n.active) return { label: 'ปิดอยู่', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  if (n.starts_at && now < new Date(n.starts_at).getTime()) return { label: 'รอเริ่ม', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
  if (n.ends_at && now > new Date(n.ends_at).getTime()) return { label: 'หมดเวลาแล้ว', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  return { label: 'กำลังแสดง', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500 animate-pulse' };
}

export default function AdminNews() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0); // re-render so the status pill flips without a refresh

  const [form, setForm] = useState<NewsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([]);

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

  const openCreate = () => { setForm({ ...emptyForm }); setError(''); setFieldErrors([]); };

  const openEdit = (n: NewsItem) => {
    setForm({
      id: n.id,
      title: n.title,
      excerpt: n.excerpt || '',
      badge: n.badge || '',
      accent: n.accent || 'primary',
      imageUrl: n.image_url || '',
      linkUrl: n.link_url || '',
      startsAt: toLocalInput(n.starts_at),
      endsAt: toLocalInput(n.ends_at),
      active: Boolean(n.active),
    });
    setError('');
    setFieldErrors([]);
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.title.trim()) { setError('กรอกหัวข้อข่าวก่อนบันทึก'); return; }

    setSaving(true);
    setError('');
    setFieldErrors([]);
    try {
      const body = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        badge: form.badge.trim() || null,
        accent: form.accent,
        image_url: form.imageUrl.trim() || null,
        link_url: form.linkUrl.trim() || null,
        starts_at: fromLocalInput(form.startsAt),
        ends_at: fromLocalInput(form.endsAt),
        active: form.active,
      };
      if (form.id) {
        await api(`/admin/news/${form.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/news', { method: 'POST', token: getToken()!, body: { ...body, sort_order: items.length } });
      }
      setForm(null);
      adminAlert({ title: form.id ? 'แก้ไขข่าวแล้ว' : 'เพิ่มข่าวแล้ว', type: 'success' });
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

  const toggleActive = async (n: NewsItem) => {
    try {
      await api(`/admin/news/${n.id}`, { method: 'PUT', token: getToken()!, body: { active: !n.active } });
      load();
    } catch (err: any) {
      await adminAlert({ title: 'เปลี่ยนสถานะไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  /** Swap with the neighbour, then persist the whole list's positions. */
  const move = async (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next); // optimistic - reload below reconciles
    try {
      await api('/admin/news/reorder', {
        method: 'PUT', token: getToken()!,
        body: { order: next.map((n, i) => ({ id: n.id, sort_order: i })) },
      });
    } catch (err: any) {
      await adminAlert({ title: 'จัดลำดับไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      load();
    }
  };

  const handleDelete = async (n: NewsItem) => {
    if (!await adminConfirm({
      title: 'ลบข่าว',
      message: `ต้องการลบ "${n.title}" หรือไม่ (สไลด์นี้จะหายจากหน้าแรกทันที)`,
      type: 'danger', confirmLabel: 'ลบ',
    })) return;
    try {
      await api(`/admin/news/${n.id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ลบข่าวแล้ว', type: 'success' });
      load();
    } catch (err: any) {
      await adminAlert({ title: 'ลบไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const accentSwatch = (v: string) => ACCENT_OPTIONS.find(a => a.value === v)?.swatch || 'bg-gray-700';

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-newspaper text-[#f97316]"></i> ข่าวสาร / สไลด์หน้าแรก
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ข่าวจะแสดงเป็นสไลด์บนหน้าแรก ไม่ต้องทำรูปเอง (ใส่รูปพื้นหลังได้ถ้าต้องการ)
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-green-600 border border-green-700 text-white text-sm font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all flex items-center gap-2">
          <i className="fas fa-plus text-xs"></i> เพิ่มข่าว
        </button>
      </div>

      {/* ── Ordering hint ────────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <i className="fas fa-info-circle text-blue-500 text-sm mt-0.5"></i>
        <p className="text-xs text-blue-800 leading-relaxed">
          ลำดับสไลด์บนหน้าแรก: สไลด์แคมเปญเติมเงิน (ถ้ากำลังแจกแต้ม) มาก่อน ตามด้วยข่าวตามลำดับด้านล่าง
          แล้วจึงเป็นรูปสไลด์ที่อัปโหลดไว้ในหน้า &quot;ตั้งค่าหน้าเว็บไซต์&quot;
        </p>
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-newspaper text-gray-300 text-xl"></i>
          </div>
          <p className="text-sm font-bold text-gray-700">ยังไม่มีข่าว</p>
          <p className="text-xs text-gray-500 mt-1">กด &quot;เพิ่มข่าว&quot; เพื่อสร้างสไลด์แรก</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => {
            const status = getStatusInfo(n);
            const from = fmtWindow(n.starts_at);
            const to = fmtWindow(n.ends_at);
            return (
              <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">

                {/* Reorder */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 disabled:opacity-30 flex items-center justify-center"
                    aria-label="เลื่อนขึ้น">
                    <i className="fas fa-chevron-up text-[10px]"></i>
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                    className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 disabled:opacity-30 flex items-center justify-center"
                    aria-label="เลื่อนลง">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </button>
                </div>

                {/* Accent / thumbnail */}
                <div className={`w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden ${n.image_url ? '' : accentSwatch(n.accent)}`}>
                  {n.image_url && <img src={n.image_url} alt="" className="w-full h-full object-cover" />}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{n.badge}</span>}
                    <span className="font-bold text-sm text-gray-800 truncate">{n.title}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span> {status.label}
                    </span>
                  </div>
                  {n.excerpt && <p className="text-xs text-gray-500 truncate mt-0.5">{n.excerpt}</p>}
                  {(from || to) && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {from ? `เริ่ม ${from}` : 'เริ่มทันที'} : {to ? `ถึง ${to}` : 'ไม่มีกำหนดจบ'}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActive(n)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${n.active ? 'bg-green-600' : 'bg-gray-300'}`}
                    aria-label={n.active ? 'ปิดข่าวนี้' : 'เปิดข่าวนี้'}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${n.active ? 'left-[22px]' : 'left-0.5'}`}></span>
                  </button>
                  <button onClick={() => openEdit(n)}
                    className="w-8 h-8 rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_3px_0_#1d4ed8] active:translate-y-[3px] active:shadow-none transition-all"
                    aria-label="แก้ไข">
                    <i className="fas fa-pen text-[11px]"></i>
                  </button>
                  <button onClick={() => handleDelete(n)}
                    className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_3px_0_#b91c1c] active:translate-y-[3px] active:shadow-none transition-all"
                    aria-label="ลบ">
                    <i className="fas fa-trash text-[11px]"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Editor modal ─────────────────────────────────────────────── */}
      {form && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setForm(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            onMouseDown={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-newspaper text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-sm">{form.id ? 'แก้ไขข่าว' : 'เพิ่มข่าวใหม่'}</h3>
              </div>
              <button onClick={() => setForm(null)} disabled={saving}
                className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i> {error}
                  </p>
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1.5 ml-5 list-disc text-[11px] text-red-600 space-y-0.5">
                      {fieldErrors.map((fe, i) => (
                        <li key={i}><span className="font-bold">{FIELD_LABELS[fe.field] || fe.field}</span>: {fe.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">หัวข้อข่าว <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={255}
                  placeholder="เช่น อัปเดตเซิร์ฟเวอร์ใหม่ พร้อมไอเท็มพิเศษ"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">คำอธิบายสั้น</label>
                <textarea value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} maxLength={500} rows={2}
                  placeholder="ข้อความบรรทัดรองใต้หัวข้อ (ไม่ใส่ก็ได้)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ป้ายกำกับ</label>
                  <input value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} maxLength={40}
                    placeholder="เช่น ใหม่ / อัปเดต"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">สีสไลด์</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ACCENT_OPTIONS.map(a => (
                      <button key={a.value} type="button" onClick={() => setForm({ ...form, accent: a.value })}
                        title={a.label}
                        className={`w-8 h-8 rounded-lg ${a.swatch} transition-all ${form.accent === a.value ? 'ring-2 ring-offset-2 ring-gray-800' : 'opacity-60 hover:opacity-100'}`}
                        aria-label={a.label} />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">ใช้เมื่อไม่ได้ใส่รูปพื้นหลัง</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">รูปพื้นหลัง (URL)</label>
                  <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} maxLength={500}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ลิงก์เมื่อกดสไลด์</label>
                  <input value={form.linkUrl} onChange={e => setForm({ ...form, linkUrl: e.target.value })} maxLength={500}
                    placeholder="/shop หรือ https://..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">เริ่มแสดง</label>
                  <input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = แสดงทันที</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">หยุดแสดง</label>
                  <input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = ไม่มีกำหนดจบ</p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${form.active ? 'bg-green-600' : 'bg-gray-300'}`}
                  onClick={() => setForm({ ...form, active: !form.active })}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.active ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
                <span className="text-sm font-bold text-gray-800">เปิดใช้งานข่าวนี้</span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2 flex-shrink-0">
              <button onClick={() => setForm(null)} disabled={saving}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-bold">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-xl bg-green-600 border border-green-700 text-white text-sm font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-60 flex items-center gap-2">
                {saving ? <><i className="fas fa-spinner fa-spin text-xs"></i> กำลังบันทึก</> : <><i className="fas fa-check text-xs"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })(), document.body)}
    </div>
  );
}
