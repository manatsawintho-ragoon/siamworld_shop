'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';

interface Setting { key: string; value: string; }
interface Slide { id: number; title: string; image_url: string; link_url?: string; sort_order: number; active: boolean; }
interface Download { id: number; filename: string; description: string; file_size: string; download_url: string; category: string; active: number; sort_order: number; }

const emptySlide = { title: '', image_url: '', link_url: '', sort_order: 0, active: true };
const EMPTY_DL: Omit<Download, 'id'> = { filename: '', description: '', file_size: '', download_url: '', category: '', active: 1, sort_order: 0 };

/* ── Reusable components ── */
const SectionCard = ({ icon, title, description, children, actions }: { icon: string; title: string; description: string; children: React.ReactNode; actions?: React.ReactNode }) => (
  <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] overflow-hidden">
    <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
          <i className={`${icon.includes('fab') ? icon : `fas ${icon}`} text-green-600 text-xs`}></i>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
          <p className="text-[11px] text-gray-400">{description}</p>
        </div>
      </div>
      {actions}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const FieldInput = ({ label, value, onChange, placeholder, hint, icon, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; icon?: string; type?: string }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
          <i className={`${icon.includes('fab') ? icon : `fas ${icon}`} text-sm`}></i>
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full ${icon ? 'pl-9' : 'px-3.5'} pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300`}
        placeholder={placeholder || ''}
      />
    </div>
    {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

const ActionButtons = ({ saving, saved, onSave, onClear }: { saving: boolean; saved: boolean; onSave: () => void; onClear?: () => void }) => (
  <div className="flex items-center gap-2">
    {onClear && (
      <button onClick={onClear} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
        <i className="fas fa-eraser text-[12px]"></i> เคลียร์
      </button>
    )}
    <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
      {saving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> :
       saved ? <><i className="fas fa-check text-[12px]"></i> สำเร็จ!</> :
       <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
    </button>
  </div>
);

export default function AdminSettings() {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
  const [sectionSaved, setSectionSaved] = useState<Record<string, boolean>>({});

  const [slides, setSlides] = useState<Slide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<Partial<Slide> | null>(null);
  const [slideSaving, setSlideSaving] = useState(false);
  const [slideError, setSlideError] = useState('');
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [downloads, setDownloads] = useState<Download[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(true);
  const [editingDl, setEditingDl] = useState<Partial<Download> | null>(null);
  const [dlSaving, setDlSaving] = useState(false);
  const [dlError, setDlError] = useState('');
  const slideBackdropDown = useRef(false);
  const dlBackdropDown = useRef(false);

  useEffect(() => {
    api('/admin/settings', { token: getToken()! })
      .then(d => {
        const arr = (d.settings as Setting[]) || [];
        const map: Record<string, string> = {};
        arr.forEach(s => { map[s.key] = s.value; });
        setSettings(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadSlides = useCallback(() => {
    setSlidesLoading(true);
    api('/admin/slides', { token: getToken()! })
      .then(d => setSlides((d.slides as Slide[]) || []))
      .finally(() => setSlidesLoading(false));
  }, []);
  useEffect(() => { loadSlides(); }, [loadSlides]);

  const loadDownloads = useCallback(() => {
    setDownloadsLoading(true);
    api('/admin/downloads', { token: getToken()! })
      .then(d => setDownloads((d.downloads as Download[]) || []))
      .finally(() => setDownloadsLoading(false));
  }, []);
  useEffect(() => { loadDownloads(); }, [loadDownloads]);

  const set = (key: string, val: string) => setSettings(prev => ({ ...prev, [key]: val }));

  /* Per-section save */
  const handleSaveKeys = async (section: string, keys: string[]) => {
    setSectionSaving(prev => ({ ...prev, [section]: true }));
    setSectionSaved(prev => ({ ...prev, [section]: false }));
    try {
      const settingsArray = keys.map(key => ({ key, value: settings[key] ?? '' }));
      await api('/admin/settings', { method: 'PUT', token: getToken()!, body: { settings: settingsArray } });
      await refreshSettings();
      setSectionSaved(prev => ({ ...prev, [section]: true }));
      setTimeout(() => setSectionSaved(prev => ({ ...prev, [section]: false })), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
    setSectionSaving(prev => ({ ...prev, [section]: false }));
  };

  /* Clear URL fields */
  const handleClearUrl = async (keys: string[], section: string) => {
    const updated = { ...settings };
    keys.forEach(k => { updated[k] = ''; });
    setSettings(updated);
    try {
      const settingsArray = keys.map(key => ({ key, value: '' }));
      await api('/admin/settings', { method: 'PUT', token: getToken()!, body: { settings: settingsArray } });
      await refreshSettings();
    } catch {
      alert('เคลียร์ไม่สำเร็จ');
    }
  };

  /* Slide drag & drop */
  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOverItem.current = index; };
  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const reordered = [...slides];
    const [dragged] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, dragged);
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }));
    setSlides(withOrder);
    dragItem.current = null;
    dragOverItem.current = null;
    try {
      await api('/admin/slides/reorder', { method: 'PUT', token: getToken()!, body: { order: withOrder.map(s => ({ id: s.id, sort_order: s.sort_order })) } });
    } catch { loadSlides(); }
  };

  /* Toggle slide active */
  const handleToggleSlide = async (slide: Slide) => {
    const newActive = !slide.active;
    setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, active: newActive } : s));
    try {
      await api(`/admin/slides/${slide.id}`, { method: 'PUT', token: getToken()!, body: { active: newActive } });
    } catch { loadSlides(); }
  };

  const handleSaveSlide = async () => {
    if (!editingSlide) return;
    setSlideSaving(true);
    setSlideError('');
    try {
      const body = { title: editingSlide.title || null, image_url: editingSlide.image_url, link_url: editingSlide.link_url || null, sort_order: editingSlide.sort_order, active: Boolean(editingSlide.active) };
      if (editingSlide.id) {
        await api(`/admin/slides/${editingSlide.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/slides', { method: 'POST', token: getToken()!, body });
      }
      setEditingSlide(null);
      loadSlides();
    } catch (err: unknown) {
      setSlideError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setSlideSaving(false); }
  };

  const handleDeleteSlide = async (id: number) => {
    if (!confirm('ต้องการลบสไลด์นี้?')) return;
    try { await api(`/admin/slides/${id}`, { method: 'DELETE', token: getToken()! }); loadSlides(); } catch { }
  };

  const handleSaveDl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDl) return;
    if (!editingDl.filename?.trim() || !editingDl.download_url?.trim()) { setDlError('กรุณากรอกชื่อไฟล์และ URL'); return; }
    setDlSaving(true);
    setDlError('');
    try {
      const body = { filename: editingDl.filename, description: editingDl.description, file_size: editingDl.file_size, download_url: editingDl.download_url, category: editingDl.category, active: editingDl.active, sort_order: editingDl.sort_order };
      if (editingDl.id) {
        await api(`/admin/downloads/${editingDl.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/downloads', { method: 'POST', token: getToken()!, body });
      }
      setEditingDl(null);
      loadDownloads();
    } catch (err: unknown) {
      setDlError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setDlSaving(false); }
  };

  const handleDeleteDl = async (id: number) => {
    if (!confirm('ต้องการลบรายการดาวน์โหลดนี้?')) return;
    try { await api(`/admin/downloads/${id}`, { method: 'DELETE', token: getToken()! }); loadDownloads(); } catch { }
  };

  const handleToggleDl = async (dl: Download) => {
    const newActive = dl.active ? 0 : 1;
    setDownloads(prev => prev.map(d => d.id === dl.id ? { ...d, active: newActive } : d));
    try {
      await api(`/admin/downloads/${dl.id}`, { method: 'PUT', token: getToken()!, body: { filename: dl.filename, download_url: dl.download_url, description: dl.description, file_size: dl.file_size, category: dl.category, sort_order: dl.sort_order, active: newActive } });
    } catch { loadDownloads(); }
  };

  if (loading) {
    return <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-green-500"></i></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <i className="fas fa-paint-roller text-green-500"></i> ตั้งค่าหน้าเว็บไซต์
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">จัดการข้อมูลพื้นฐาน รูปภาพ และโซเชียลมีเดีย ฯลฯ</p>
      </div>

      {/* 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* ข้อมูลพื้นฐาน */}
          <SectionCard icon="fa-info-circle" title="ข้อมูลพื้นฐาน" description="ตั้งค่าชื่อเว็บไซต์ หัวข้อ และคำอธิบาย"
            actions={<ActionButtons saving={!!sectionSaving.basic} saved={!!sectionSaved.basic} onSave={() => handleSaveKeys('basic', ['shop_name', 'shop_subtitle', 'shop_description'])} />}
          >
            <div className="space-y-4">
              <FieldInput label="หัวข้อเว็บไซต์" value={settings.shop_name || ''} onChange={v => set('shop_name', v)} placeholder="เช่น SiamWorld" icon="fa-globe" hint="จะแสดงบน Title Bar ของเบราว์เซอร์" />
              <FieldInput label="คำบรรยายเว็บไซต์" value={settings.shop_subtitle || ''} onChange={v => set('shop_subtitle', v)} placeholder="เช่น Minecraft Survival Server" icon="fa-heading" hint="หัวข้อที่แสดงบน Banner หน้าแรก" />
              <FieldInput label="คำอธิบายเว็บไซต์ (SEO)" value={settings.shop_description || ''} onChange={v => set('shop_description', v)} placeholder="เช่น เซิร์ฟ Minecraft ที่ดีที่สุด..." icon="fa-align-left" hint="ใช้สำหรับ SEO (Meta Description) ในการค้นหาของ Google" />
            </div>
          </SectionCard>

          {/* ประกาศเซิฟเวอร์ */}
          <SectionCard icon="fa-bullhorn" title="ประกาศเซิฟเวอร์" description="ข้อความประกาศที่แสดงเป็นวิ่งบนหน้าแรก"
            actions={<ActionButtons saving={!!sectionSaving.announce} saved={!!sectionSaved.announce} onSave={() => handleSaveKeys('announce', ['welcome_message'])} />}
          >
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">ข้อความประกาศ</label>
              <textarea
                value={settings.welcome_message || ''}
                onChange={e => set('welcome_message', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 resize-none"
                rows={3}
                placeholder="เช่น เซิร์ฟเวอร์อัพเดทใหม่ กิจกรรมพิเศษ..."
              />
            </div>
          </SectionCard>

          {/* สไลด์ Carousel */}
          <SectionCard
            icon="fa-images"
            title="สไลด์ Carousel"
            description="ลากเพื่อจัดลำดับ (แนะนำขนาด 1920×500 px)"
            actions={
              <button onClick={() => setEditingSlide({ ...emptySlide })} className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e]">
                <i className="fas fa-plus text-[12px]"></i> เพิ่ม
              </button>
            }
          >
            {slidesLoading ? (
              <div className="flex items-center justify-center py-8"><i className="fas fa-spinner fa-spin text-lg text-green-500"></i></div>
            ) : slides.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-images text-2xl text-gray-300 mb-2"></i>
                <p className="text-gray-400 text-xs">ยังไม่มีสไลด์</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {slides.map((s, idx) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group cursor-grab active:cursor-grabbing active:opacity-70"
                  >
                    {/* Drag handle */}
                    <i className="fas fa-grip-vertical text-gray-300 group-hover:text-gray-400 text-sm flex-shrink-0 transition-colors"></i>
                    {/* Thumbnail */}
                    <div className="w-20 h-12 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                      <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{s.title || '(ไม่มีชื่อ)'}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{s.image_url}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleSlide(s)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-white hover:brightness-110 transition-all active:translate-y-[2px] ${s.active ? 'bg-green-500 border-green-600 shadow-[0_3px_0_#15803d] active:shadow-[0_1px_0_#15803d]' : 'bg-gray-400 border-gray-500 shadow-[0_3px_0_#6b7280] active:shadow-[0_1px_0_#6b7280]'}`}
                        title={s.active ? 'เปิดอยู่ — คลิกเพื่อปิด' : 'ปิดอยู่ — คลิกเพื่อเปิด'}
                      >
                        <i className={`fas ${s.active ? 'fa-eye' : 'fa-eye-slash'} text-[11px]`}></i>
                      </button>
                      <button onClick={() => setEditingSlide({ ...s })} className="w-8 h-8 rounded-lg bg-amber-500 border border-amber-600 flex items-center justify-center text-white shadow-[0_3px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b45309] active:translate-y-[2px]" title="แก้ไข"><i className="fas fa-pen text-[11px]"></i></button>
                      <button onClick={() => handleDeleteSlide(s.id)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b91c1c] active:translate-y-[2px]" title="ลบ"><i className="fas fa-trash text-[11px]"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* จัดการดาวน์โหลด */}
          <SectionCard
            icon="fa-download"
            title="จัดการดาวน์โหลด"
            description="ไฟล์ดาวน์โหลดสำหรับผู้เล่น เช่น Client, Texture Pack"
            actions={
              <button onClick={() => setEditingDl({ ...EMPTY_DL })} className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e]">
                <i className="fas fa-plus text-[12px]"></i> เพิ่ม
              </button>
            }
          >
            {downloadsLoading ? (
              <div className="flex items-center justify-center py-8"><i className="fas fa-spinner fa-spin text-lg text-green-500"></i></div>
            ) : downloads.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-download text-2xl text-gray-300 mb-2"></i>
                <p className="text-gray-400 text-xs">ยังไม่มีรายการดาวน์โหลด</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {downloads.map(dl => (
                  <div key={dl.id} className="flex items-center gap-4 py-3 px-1 group hover:bg-gray-50/50 transition-colors -mx-1 rounded-lg">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <i className="fas fa-file-zipper text-green-600 text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-800 truncate">{dl.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {dl.file_size && <span className="text-[11px] text-gray-400 font-medium">{dl.file_size}</span>}
                        {dl.file_size && dl.category && <span className="text-gray-200">·</span>}
                        {dl.category && <span className="text-[11px] text-green-600/80 font-semibold">{dl.category}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleDl(dl)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center text-white hover:brightness-110 transition-all active:translate-y-[2px] ${dl.active ? 'bg-green-500 border-green-600 shadow-[0_3px_0_#15803d] active:shadow-[0_1px_0_#15803d]' : 'bg-gray-400 border-gray-500 shadow-[0_3px_0_#6b7280] active:shadow-[0_1px_0_#6b7280]'}`}
                        title={dl.active ? 'เปิดอยู่ — คลิกเพื่อปิด' : 'ปิดอยู่ — คลิกเพื่อเปิด'}
                      >
                        <i className={`fas ${dl.active ? 'fa-eye' : 'fa-eye-slash'} text-[11px]`}></i>
                      </button>
                      <button onClick={() => setEditingDl({ ...dl })} className="w-8 h-8 rounded-lg bg-amber-500 border border-amber-600 flex items-center justify-center text-white shadow-[0_3px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b45309] active:translate-y-[2px]" title="แก้ไข"><i className="fas fa-pen text-[11px]"></i></button>
                      <button onClick={() => handleDeleteDl(dl.id)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b91c1c] active:translate-y-[2px]" title="ลบ"><i className="fas fa-trash text-[11px]"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Favicon */}
          <SectionCard icon="fa-star" title="Favicon" description="ไอคอนเล็กๆ ที่แสดงบน Tab ของเบราว์เซอร์"
            actions={<ActionButtons saving={!!sectionSaving.favicon} saved={!!sectionSaved.favicon} onSave={() => handleSaveKeys('favicon', ['favicon_url'])} onClear={() => handleClearUrl(['favicon_url'], 'favicon')} />}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {settings.favicon_url ? (
                    <img src={settings.favicon_url} alt="Favicon" className="w-9 h-9 object-contain" onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex'; }} />
                  ) : null}
                  <div className={`flex-col items-center justify-center ${settings.favicon_url ? 'hidden' : 'flex'}`}>
                    <i className="fas fa-image text-gray-300 text-base"></i>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-500">{settings.favicon_url ? 'ตัวอย่าง Favicon ปัจจุบัน' : 'ยังไม่ได้ตั้ง Favicon'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">แนะนำขนาด 32×32 หรือ 64×64 px</p>
                </div>
              </div>
              <FieldInput label="URL รูป Favicon" value={settings.favicon_url || ''} onChange={v => set('favicon_url', v)} placeholder="https://example.com/favicon.webp" icon="fa-image" hint="วาง URL รูปภาพ .ico .png .webp" />
            </div>
          </SectionCard>

          {/* Banner Header */}
          <SectionCard icon="fa-panorama" title="Banner Header" description="รูป Banner ที่แสดงบน Header ของเว็บไซต์ จะแสดงเป็น Overlay 70%"
            actions={<ActionButtons saving={!!sectionSaving.wallpaper} saved={!!sectionSaved.wallpaper} onSave={() => handleSaveKeys('wallpaper', ['website_bg_url'])} onClear={() => handleClearUrl(['website_bg_url'], 'wallpaper')} />}
          >
            <div className="space-y-3">
              {settings.website_bg_url && (
                <div className="rounded-xl overflow-hidden h-28 bg-gray-100 relative border border-gray-200">
                  <img src={settings.website_bg_url} alt="Banner" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  <div className="absolute inset-0 bg-black/70"></div>
                  <span className="absolute bottom-1.5 right-2.5 text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">ตัวอย่าง (70% overlay)</span>
                </div>
              )}
              <FieldInput label="URL รูป Banner" value={settings.website_bg_url || ''} onChange={v => set('website_bg_url', v)} placeholder="https://example.com/banner.jpg" icon="fa-image" hint="แนะนำขนาด 1920×500 px หรือใหญ่กว่า" />
            </div>
          </SectionCard>

          {/* Social Media */}
          <SectionCard icon="fa-share-alt" title="โซเชียลมีเดีย" description="ลิงก์โซเชียลมีเดียที่แสดงบนเว็บไซต์"
            actions={<ActionButtons saving={!!sectionSaving.social} saved={!!sectionSaved.social} onSave={() => handleSaveKeys('social', ['facebook_url', 'discord_invite'])} />}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Facebook URL</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1877F2]">
                    <i className="fab fa-facebook text-sm"></i>
                  </div>
                  <input value={settings.facebook_url || ''} onChange={e => set('facebook_url', e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/20 placeholder:text-gray-300"
                    placeholder="https://facebook.com/yourpage" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">ลิงก์ไปยังเพจ Facebook ของคุณ</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ลิงก์เชิญ Discord</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5865F2]">
                    <i className="fab fa-discord text-sm"></i>
                  </div>
                  <input value={settings.discord_invite || ''} onChange={e => set('discord_invite', e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 placeholder:text-gray-300"
                    placeholder="https://discord.gg/yourinvite" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">ลิงก์เชิญเข้า Discord Server ของคุณ</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Slide Edit Modal */}
      {editingSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          onMouseDown={e => { slideBackdropDown.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (slideBackdropDown.current && e.target === e.currentTarget && !slideSaving) setEditingSlide(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="relative px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-images text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">{editingSlide.id ? 'แก้ไขสไลด์' : 'เพิ่มสไลด์ใหม่'}</h3>
                <p className="text-[11px] text-gray-400">{editingSlide.id ? 'แก้ไขข้อมูลสไลด์ที่เลือก' : 'เพิ่มสไลด์แสดงผลใหม่'}</p>
              </div>
              <button onClick={() => setEditingSlide(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            {/* Body */}
            <div className="p-5 space-y-4">
              {slideError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5"><i className="fas fa-exclamation-circle"></i> {slideError}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อสไลด์</label>
                <input value={editingSlide.title || ''} onChange={e => setEditingSlide({ ...editingSlide, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300"
                  placeholder="เช่น โปรโมชั่นพิเศษ" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">URL รูปภาพ <span className="text-red-400">*</span></label>
                <input value={editingSlide.image_url || ''} onChange={e => setEditingSlide({ ...editingSlide, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300"
                  placeholder="https://example.com/banner.jpg" />
              </div>
              {editingSlide.image_url && (
                <div className="rounded-lg overflow-hidden h-24 bg-gray-100 border border-gray-200">
                  <img src={editingSlide.image_url} alt="ตัวอย่าง" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ลิงก์ URL</label>
                <input value={editingSlide.link_url || ''} onChange={e => setEditingSlide({ ...editingSlide, link_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300"
                  placeholder="https://... (ไม่บังคับ)" />
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button onClick={() => setEditingSlide(null)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSaveSlide} disabled={slideSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {slideSaving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึกสไลด์</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Edit Modal */}
      {editingDl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          onMouseDown={e => { dlBackdropDown.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (dlBackdropDown.current && e.target === e.currentTarget && !dlSaving) setEditingDl(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="relative px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-download text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">{editingDl.id ? 'แก้ไขรายการดาวน์โหลด' : 'เพิ่มรายการดาวน์โหลด'}</h3>
                <p className="text-[11px] text-gray-400">{editingDl.id ? 'แก้ไขข้อมูลรายการที่เลือก' : 'เพิ่มไฟล์ดาวน์โหลดใหม่'}</p>
              </div>
              <button type="button" onClick={() => setEditingDl(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            {/* Body */}
            <form id="dl-form" onSubmit={handleSaveDl} className="p-5 space-y-4">
              {dlError && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5"><i className="fas fa-exclamation-circle"></i> {dlError}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อไฟล์ <span className="text-red-400">*</span></label>
                <input type="text" value={editingDl.filename || ''} onChange={e => setEditingDl({ ...editingDl, filename: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300"
                  placeholder="เช่น Minecraft 1.20.1 Client" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">รายละเอียด</label>
                <textarea value={editingDl.description || ''} onChange={e => setEditingDl({ ...editingDl, description: e.target.value })} rows={2}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 resize-none placeholder:text-gray-300" placeholder="คำอธิบายสั้นๆ" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ขนาดไฟล์</label>
                  <input type="text" value={editingDl.file_size || ''} onChange={e => setEditingDl({ ...editingDl, file_size: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="250 MB" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">หมวดหมู่</label>
                  <input type="text" value={editingDl.category || ''} onChange={e => setEditingDl({ ...editingDl, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="Client, Mod" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">URL ดาวน์โหลด <span className="text-red-400">*</span></label>
                <input type="url" value={editingDl.download_url || ''} onChange={e => setEditingDl({ ...editingDl, download_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="https://..." required />
              </div>
              <label className="flex items-center gap-3 cursor-pointer py-0.5">
                <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${editingDl.active ? 'bg-[#1e2735]' : 'bg-gray-200'}`}
                  onClick={() => setEditingDl({ ...editingDl, active: editingDl.active ? 0 : 1 })}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${editingDl.active ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
                <span className="text-xs font-bold text-gray-500">เปิดใช้งาน</span>
              </label>
            </form>
            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditingDl(null)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button type="submit" form="dl-form" disabled={dlSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {dlSaving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึกรายการ</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
