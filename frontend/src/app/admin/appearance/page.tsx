'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';
import { useTheme, THEMES, DEFAULT_THEME_ID, ThemeConfig, injectTheme } from '@/context/ThemeContext';
import { useAdminAlert } from '@/components/AdminAlert';

/* ── Theme Card ── */
function ThemeCard({ theme, isActive, isHovered, isSaved, onHover, onSelect }: {
  theme: ThemeConfig; isActive: boolean; isHovered: boolean; isSaved: boolean;
  onHover: () => void; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`group relative flex flex-col rounded-xl overflow-hidden transition-all duration-150 text-left cursor-pointer border-2 ${
        isActive
          ? 'border-[#22c55e] shadow-[0_0_0_3px_rgba(34,197,94,0.18),0_4px_0_#15803d] scale-[1.02]'
          : isHovered
          ? 'border-gray-400 shadow-[0_4px_0_#9ca3af,0_4px_12px_rgba(0,0,0,0.12)] scale-[1.01]'
          : 'border-transparent shadow-[0_3px_0_#d1d5db,0_2px_8px_rgba(0,0,0,0.07)] hover:border-gray-300 hover:shadow-[0_3px_0_#9ca3af,0_4px_12px_rgba(0,0,0,0.1)] hover:scale-[1.01]'
      }`}
      aria-pressed={isActive}
    >
      {/* Banner */}
      <div className="h-16 w-full relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.preview.from}, ${theme.preview.to})` }}>
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 pb-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-1.5 rounded-full opacity-60"
              style={{ width: i===2?'22px':'14px', backgroundColor: i===2?theme.preview.accent:'rgba(255,255,255,0.5)' }} />
          ))}
        </div>
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full border border-white/40 shadow"
          style={{ backgroundColor: theme.preview.accent }} />
        {theme.isDark && (
          <div className="absolute top-1.5 left-1.5 bg-black/50 backdrop-blur-sm text-white text-[7px] font-black px-1 py-0.5 rounded tracking-wide">
            DARK
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 px-2.5 py-2 flex flex-col gap-1.5" style={{ backgroundColor: theme.preview.bg }}>
        {/* Mini card */}
        <div className="rounded-md p-1.5 border flex items-center gap-1.5"
          style={{ borderColor: theme.preview.accent+'40', backgroundColor: theme.isDark?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.85)' }}>
          <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: theme.preview.accent+'25' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.preview.accent }} />
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="h-1 rounded-full w-3/4" style={{ backgroundColor: theme.isDark?'rgba(255,255,255,0.25)':'#374151' }} />
            <div className="h-0.5 rounded-full w-1/2" style={{ backgroundColor: theme.isDark?'rgba(255,255,255,0.12)':'#9ca3af' }} />
          </div>
        </div>
        {/* Mini button */}
        <div className="w-full h-5 rounded-md flex items-center justify-center"
          style={{ backgroundColor: theme.preview.accent }}>
          <div className="h-1 w-8 rounded-full bg-white/60" />
        </div>
        {/* Name */}
        <div className="pt-0.5">
          <p className="font-black text-[11px] leading-tight truncate"
            style={{ color: theme.isDark?'#f1f5f9':'#111827' }}>{theme.name}</p>
          <p className="text-[9px] leading-tight mt-0.5 truncate"
            style={{ color: theme.isDark?'#94a3b8':'#6b7280' }}>{theme.nameTh}</p>
        </div>
      </div>

      {/* Active checkmark */}
      {isActive && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#22c55e] border-2 border-white shadow flex items-center justify-center z-10">
          <i className="fas fa-check text-white" style={{ fontSize: '7px' }} />
        </div>
      )}
      {/* Saved badge (when saved but not currently previewing) */}
      {isSaved && !isActive && (
        <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full z-10 tracking-wide">
          ใช้งาน
        </div>
      )}
    </button>
  );
}

/* ── Swatch ── */
function Swatch({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-7 h-7 rounded-lg shadow-[0_2px_0_rgba(0,0,0,0.12)]" style={{ backgroundColor: color }} />
      <span className="text-[8px] text-gray-400 font-mono leading-none">{color.toUpperCase()}</span>
    </div>
  );
}

/* ── Main Page ── */
export default function AppearancePage() {
  const { settings, refreshSettings } = useSettings();
  const { currentThemeId } = useTheme();
  const { alert: showAlert } = useAdminAlert();

  const [savedThemeId,   setSavedThemeId]   = useState('');
  const [previewThemeId, setPreviewThemeId] = useState('');
  const [hoverThemeId,   setHoverThemeId]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    const id = settings.theme_name || DEFAULT_THEME_ID;
    setSavedThemeId(id);
    setPreviewThemeId(id);
  }, [settings.theme_name]);

  const previewTheme  = THEMES.find(t => t.id === previewThemeId) ?? THEMES[0];
  const savedTheme    = THEMES.find(t => t.id === savedThemeId)   ?? THEMES[0];
  const displayTheme  = (hoverThemeId ? THEMES.find(t => t.id === hoverThemeId) : null) ?? previewTheme;

  // Hover: only update admin mockup, no CSS injection to real page
  const handleHover    = (id: string) => setHoverThemeId(id);
  const handleHoverEnd = () => setHoverThemeId(null);

  // Click: mark as selected + inject CSS preview to real page
  const handleSelect = (id: string) => {
    const theme = THEMES.find(t => t.id === id);
    if (theme) { setPreviewThemeId(id); setHoverThemeId(null); injectTheme(theme); }
  };
  const handleReset = () => handleSelect(DEFAULT_THEME_ID);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setSaved(false);
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: { settings: [{ key: 'theme_name', value: previewThemeId }] },
      });
      setSavedThemeId(previewThemeId);
      await refreshSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      showAlert({ type: 'success', title: 'บันทึกธีมสำเร็จ', message: `เปลี่ยนเป็น "${previewTheme.name}" เรียบร้อยแล้ว` });
    } catch (err: any) {
      showAlert({ type: 'error', title: 'บันทึกล้มเหลว', message: err?.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsaved   = previewThemeId !== savedThemeId;
  const isDefault    = previewThemeId === DEFAULT_THEME_ID;

  return (
    <div className="space-y-5">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-[0_3px_0_#5b21b6] flex-shrink-0">
            <i className="fas fa-palette text-white text-sm" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900 leading-none">Appearance / Theme</h1>
            <p className="text-gray-500 text-xs mt-0.5">ปรับแต่งธีมและสีหน้าเว็บไซต์ของคุณ</p>
          </div>
        </div>
        {/* Saved pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs self-start sm:self-center">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: savedTheme.preview.accent }} />
          <span className="text-gray-500">ใช้งาน:</span>
          <span className="text-gray-900 font-bold">{savedTheme.name}</span>
        </div>
      </div>

      {/* ── 2-Column Layout: sticky preview LEFT + scrollable grid RIGHT ── */}
      {/* top-[104px] = 72px admin header + 32px main padding */}
      <div className="flex flex-col xl:flex-row gap-5 items-start">

        {/* ══ LEFT: Sticky Preview Panel ══ */}
        <div className="w-full xl:w-[340px] flex-shrink-0 xl:sticky xl:top-[104px] space-y-3">

          {/* Preview mockup card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_0_#c5cad3,0_2px_20px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* Card header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                  <i className="fas fa-eye text-violet-500 text-[10px]" />
                </div>
                <span className="text-sm font-bold text-gray-900">Preview</span>
              </div>
              <div className="flex items-center gap-1.5">
                {hoverThemeId && hoverThemeId !== previewThemeId && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">HOVER</span>
                )}
                <div className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: displayTheme.preview.accent }} />
                <span className="text-xs font-black text-gray-900">{displayTheme.name}</span>
                {displayTheme.isDark && (
                  <span className="bg-gray-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">DARK</span>
                )}
              </div>
            </div>

            {/* Mockup */}
            <div className="p-4 space-y-2.5" style={{ backgroundColor: displayTheme.preview.bg }}>

              {/* Banner */}
              <div className="h-12 rounded-lg overflow-hidden relative"
                style={{ background: `linear-gradient(to bottom, ${displayTheme.preview.from}, ${displayTheme.preview.to})` }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-black text-white text-sm tracking-tight drop-shadow">SIAMSITE STORE</p>
                  <p className="text-[8px] font-medium tracking-widest uppercase mt-0.5"
                    style={{ color: displayTheme.preview.accent }}>ระบบร้านค้ามายคราฟ</p>
                </div>
              </div>

              {/* Nav bar — surface bg, themed text */}
              <div className="h-8 rounded-lg flex items-center justify-center gap-4 px-3 border"
                style={{
                  backgroundColor: displayTheme.isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                  borderColor: displayTheme.preview.accent + '30',
                }}>
                {['Home','Shop','Gacha','Topup'].map((item, i) => (
                  <span key={item} className="text-[10px] font-bold"
                    style={{
                      color: i===0 ? displayTheme.preview.accent : (displayTheme.isDark?'rgba(255,255,255,0.5)':'#6b7280'),
                      borderBottom: i===0?`2px solid ${displayTheme.preview.accent}`:'none',
                      paddingBottom: i===0?'1px':'0',
                    }}>{item}</span>
                ))}
              </div>

              {/* Cards row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Wallet */}
                <div className="rounded-lg p-2.5 text-white"
                  style={{ background: `linear-gradient(135deg, ${displayTheme.preview.to}, ${displayTheme.preview.from})` }}>
                  <p className="text-[7px] font-black uppercase tracking-widest opacity-70">ยอดเงิน</p>
                  <p className="text-base font-black mt-0.5">1,500 <span className="text-[10px] opacity-70">฿</span></p>
                </div>
                {/* Buttons */}
                <div className="rounded-lg p-2 border flex flex-col gap-1.5"
                  style={{ backgroundColor: displayTheme.isDark?displayTheme.preview.bg:'#fff', borderColor: displayTheme.preview.accent+'40' }}>
                  <div className="w-full h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ backgroundColor: displayTheme.preview.accent }}>ซื้อสินค้า</div>
                  <div className="w-full h-5 rounded-md flex items-center justify-center text-[9px] font-bold border"
                    style={{ color: displayTheme.preview.accent, borderColor: displayTheme.preview.accent+'40', backgroundColor: displayTheme.preview.accent+'10' }}>ดูสินค้า</div>
                </div>
              </div>

              {/* Palette */}
              <div className="rounded-lg p-2.5 border"
                style={{ backgroundColor: displayTheme.isDark?displayTheme.preview.bg:'#fff', borderColor: displayTheme.preview.accent+'25' }}>
                <p className="text-[8px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: displayTheme.isDark?'#94a3b8':'#9ca3af' }}>Color Palette</p>
                <div className="flex items-center gap-2">
                  <Swatch color={displayTheme.preview.from} />
                  <Swatch color={displayTheme.preview.accent} />
                  <Swatch color={displayTheme.preview.to} />
                  <Swatch color={displayTheme.preview.bg} />
                  <div className="flex-1 text-right">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: displayTheme.isDark?'rgba(255,255,255,0.08)':'#f3f4f6',
                        color: displayTheme.isDark?'#94a3b8':'#6b7280',
                      }}>
                      {displayTheme.isDark?'Dark':'Light'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_0_#c5cad3] p-4 space-y-2.5">
            {/* Unsaved indicator */}
            {hasUnsaved && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <i className="fas fa-circle-exclamation text-amber-500 text-xs flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-amber-800 font-bold text-xs leading-tight">ยังไม่ได้บันทึก</p>
                  <p className="text-amber-600 text-[10px] mt-0.5 leading-tight truncate">
                    เลือก: {previewTheme.name}
                  </p>
                </div>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsaved}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-all ${
                saved
                  ? 'bg-[#22c55e] shadow-[0_3px_0_#15803d]'
                  : hasUnsaved
                  ? 'bg-[#1e2735] shadow-[0_4px_0_#0d1117] hover:shadow-[0_2px_0_#0d1117] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'
                  : 'bg-gray-200 text-gray-400 shadow-[0_3px_0_#e5e7eb] cursor-not-allowed'
              }`}
            >
              {saving ? <><i className="fas fa-spinner fa-spin text-xs" /> บันทึก...</>
               : saved ? <><i className="fas fa-check text-xs" /> บันทึกแล้ว!</>
               : <><i className="fas fa-floppy-disk text-xs" /> บันทึกธีมนี้</>}
            </button>

            {/* Reset */}
            {!isDefault && (
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold shadow-[0_3px_0_#d1d5db] hover:shadow-[0_1px_0_#d1d5db] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all"
              >
                <i className="fas fa-rotate-left text-gray-400 text-xs" />
                คืนค่าธีมเริ่มต้น
              </button>
            )}
          </div>

          {/* Info boxes */}
          <div className="space-y-2">
            {[
              { icon: 'fa-bolt', bg: 'bg-blue-50', color: 'text-blue-500', title: 'อัพเดททันที', desc: 'ผู้ใช้เห็นผลทันทีหลังบันทึก ไม่ต้อง refresh' },
              { icon: 'fa-display', bg: 'bg-purple-50', color: 'text-purple-500', title: 'หน้าบ้านเท่านั้น', desc: 'ไม่กระทบ Admin Panel' },
              { icon: 'fa-leaf', bg: 'bg-green-50', color: 'text-green-500', title: 'ธีมเริ่มต้น', desc: 'Minecraft Green' },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <i className={`fas ${item.icon} ${item.color} text-xs`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 leading-none">{item.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT: Theme Grid ══ */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_0_#c5cad3,0_2px_20px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <i className="fas fa-swatchbook text-indigo-500 text-xs" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">เลือกธีม</h3>
                  <p className="text-[10px] text-gray-500">{THEMES.length} ธีม · วางเมาส์ = preview ในช่องซ้าย · คลิก = เลือก</p>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-medium hidden sm:block">
                {THEMES.filter(t => !t.isDark).length} ไลต์ · {THEMES.filter(t => t.isDark).length} ดาร์ก
              </span>
            </div>

            <div className="p-4 space-y-5">

              {/* Light Themes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-sun text-amber-500 text-[8px]" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Light Themes</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[9px] text-gray-400">{THEMES.filter(t=>!t.isDark).length} ธีม</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5" onMouseLeave={handleHoverEnd}>
                  {THEMES.filter(t => !t.isDark).map(theme => (
                    <ThemeCard
                      key={theme.id} theme={theme}
                      isActive={previewThemeId === theme.id}
                      isHovered={hoverThemeId === theme.id}
                      isSaved={savedThemeId === theme.id && savedThemeId !== previewThemeId}
                      onHover={() => handleHover(theme.id)}
                      onSelect={() => handleSelect(theme.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Dark Themes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-moon text-gray-300 text-[8px]" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Dark Themes</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    ปรับสีทั้งหน้าเว็บ
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5" onMouseLeave={handleHoverEnd}>
                  {THEMES.filter(t => t.isDark).map(theme => (
                    <ThemeCard
                      key={theme.id} theme={theme}
                      isActive={previewThemeId === theme.id}
                      isHovered={hoverThemeId === theme.id}
                      isSaved={savedThemeId === theme.id && savedThemeId !== previewThemeId}
                      onHover={() => handleHover(theme.id)}
                      onSelect={() => handleSelect(theme.id)}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
