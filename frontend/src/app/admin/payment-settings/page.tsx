'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

interface EasySlipStatus { configured: boolean; keyPreview: string | null; }

const BONUS_PRESETS = [
  { label: 'ปกติ', value: '1' },
  { label: 'x2', value: '2' },
  { label: 'x3', value: '3' },
  { label: 'x4', value: '4' },
  { label: 'x5', value: '5' },
];
const PREVIEW_AMOUNTS = [50, 100, 200, 500, 1000];

export default function PaymentSettingsPage() {
  const { alert: adminAlert } = useAdminAlert();

  const [loading,      setLoading]      = useState(true);
  const [ppEnabled,    setPpEnabled]    = useState(false);
  const [ppType,       setPpType]       = useState<'mobile' | 'taxid'>('mobile');
  const [ppId,         setPpId]         = useState('');
  const [ppFirstname,  setPpFirstname]  = useState('');
  const [ppLastname,   setPpLastname]   = useState('');
  const [saving,       setSaving]       = useState(false);
  const [esStatus,     setEsStatus]     = useState<EasySlipStatus | null>(null);
  const [testing,      setTesting]      = useState(false);

  // Bonus multiplier state
  const [bonusEnabled,  setBonusEnabled]  = useState(false);
  const [bonusMult,     setBonusMult]     = useState('1');
  const [savingBonus,   setSavingBonus]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [settingsRes, statusRes] = await Promise.all([
        api('/admin/settings',        { token: getToken()! }) as any,
        api('/admin/easyslip/status', { token: getToken()! }) as any,
      ]);
      const s: Record<string, string> = {};
      (settingsRes.settings as { key: string; value: string }[])
        ?.forEach(({ key, value }) => { s[key] = value; });
      setPpEnabled(s.promptpay_enabled === 'true');
      setPpType((s.promptpay_type as 'mobile' | 'taxid') || 'mobile');
      setPpId(s.promptpay_id || '');
      setPpFirstname(s.promptpay_firstname || '');
      setPpLastname(s.promptpay_lastname  || '');
      setBonusEnabled(s.topup_bonus_enabled === 'true');
      setBonusMult(s.topup_bonus_multiplier || '1');
      setEsStatus(statusRes as EasySlipStatus);
    } catch {
      adminAlert({ type: 'error', title: 'โหลดการตั้งค่าไม่สำเร็จ' });
    } finally { setLoading(false); }
  }, [adminAlert]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (ppEnabled && !ppId.trim()) {
      adminAlert({ type: 'error', title: 'กรุณากรอกเลขพร้อมเพย์ก่อนเปิดใช้งาน' });
      return;
    }
    setSaving(true);
    try {
      await api('/admin/settings', {
        method: 'PUT', token: getToken()!,
        body: { settings: [
          { key: 'promptpay_enabled',   value: String(ppEnabled) },
          { key: 'promptpay_type',      value: ppType },
          { key: 'promptpay_id',        value: ppId.trim() },
          { key: 'promptpay_firstname', value: ppFirstname.trim() },
          { key: 'promptpay_lastname',  value: ppLastname.trim() },
          { key: 'promptpay_name',      value: `${ppFirstname.trim()} ${ppLastname.trim()}`.trim() },
        ]},
      });
      adminAlert({ type: 'success', title: 'บันทึกข้อมูลแล้ว' });
    } catch { adminAlert({ type: 'error', title: 'บันทึกไม่สำเร็จ' }); }
    finally  { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api('/admin/easyslip/test', { token: getToken()! });
      adminAlert({ type: 'success', title: 'เชื่อมต่อสำเร็จ', message: 'ระบบตรวจสอบสลิปพร้อมใช้งาน' });
    } catch (err: any) {
      adminAlert({ type: 'error', title: 'เชื่อมต่อไม่สำเร็จ', message: err?.message || 'ไม่สามารถเชื่อมต่อได้' });
    } finally { setTesting(false); }
  };

  const handleSaveBonus = async () => {
    const mult = parseFloat(bonusMult);
    if (isNaN(mult) || mult < 1) {
      adminAlert({ type: 'error', title: 'ค่าโบนัสต้องไม่น้อยกว่า 1' });
      return;
    }
    setSavingBonus(true);
    try {
      await api('/admin/settings', {
        method: 'PUT', token: getToken()!,
        body: { settings: [
          { key: 'topup_bonus_enabled',    value: String(bonusEnabled) },
          { key: 'topup_bonus_multiplier', value: String(mult) },
        ]},
      });
      adminAlert({ type: 'success', title: 'บันทึกข้อมูลแล้ว' });
    } catch { adminAlert({ type: 'error', title: 'บันทึกไม่สำเร็จ' }); }
    finally  { setSavingBonus(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-3xl text-[#f97316]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-credit-card text-[#f97316]" /> ระบบรับชำระเงิน
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ตั้งค่าบัญชีผู้รับเงินและการตรวจสอบสลิป</p>
        </div>
        {/* compact status alert */}
        {!ppEnabled && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 flex-shrink-0">
            <i className="fas fa-triangle-exclamation text-amber-500 text-xs" />
            <span className="text-xs font-bold text-amber-700">ระบบปิดรับชำระเงิน</span>
          </div>
        )}
      </div>

      {/* ── Two-column ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT — Bank Account */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex flex-col">

          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-university text-green-600 text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">ข้อมูลบัญชีรับเงิน</h3>
              <p className="text-[11px] text-gray-400">บัญชีสำหรับรับเงินจากผู้เล่น</p>
            </div>
          </div>

          {/* tab bar */}
          <div className="flex border-b border-gray-100 text-xs font-semibold select-none">
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-gray-300 cursor-not-allowed">
              <i className="fas fa-landmark text-[11px]" /> ระบบเลขบัญชี
              <span className="bg-gray-100 text-gray-400 text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">เร็วๆ นี้</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[#16a34a] font-bold border-b-2 border-[#16a34a]">
              <i className="fas fa-qrcode text-[11px]" /> ระบบพร้อมเพย์
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col gap-3.5">

            {/* Type dropdown */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                ประเภทพร้อมเพย์ <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <i className="fas fa-mobile-alt text-sm" />
                </div>
                <select value={ppType} onChange={e => setPpType(e.target.value as 'mobile' | 'taxid')}
                  className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 bg-white text-gray-700">
                  <option value="mobile">เบอร์โทรศัพท์ (Mobile)</option>
                  <option value="taxid">เลขบัตรประชาชน (Tax ID)</option>
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              </div>
            </div>

            {/* PromptPay number */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                เลขพร้อมเพย์ <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <i className="fas fa-hashtag text-sm" />
                </div>
                <input type="text" value={ppId} onChange={e => setPpId(e.target.value)}
                  placeholder={ppType === 'mobile' ? '0812345678' : '1234567890123'}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 font-mono tracking-wider" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {ppType === 'mobile' ? 'เบอร์โทร 10 หลัก ตรงกับที่ลงทะเบียน PromptPay' : 'เลขบัตรประชาชน 13 หลัก'}
              </p>
            </div>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'ชื่อจริง', val: ppFirstname, set: setPpFirstname, ph: 'ชื่อ' },
                { label: 'นามสกุล', val: ppLastname,  set: setPpLastname,  ph: 'นามสกุล' },
              ] as const).map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">
                    {f.label} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                      <i className="fas fa-user text-sm" />
                    </div>
                    <input type="text" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" />
                  </div>
                </div>
              ))}
            </div>

            {/* Preview pill */}
            {(ppFirstname || ppLastname || ppId) && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-green-50 border border-green-100">
                <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-qrcode text-green-600 text-[10px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {[ppFirstname, ppLastname].filter(Boolean).join(' ') || 'ชื่อ-นามสกุล'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">
                    {ppId ? ppId.slice(0, 2) + 'x-xxx-' + ppId.slice(-4) : 'เลขพร้อมเพย์'}
                  </p>
                </div>
                <span className="text-[10px] text-green-600 font-bold flex-shrink-0">Preview</span>
              </div>
            )}

            <div className="flex-1" />

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              {saving
                ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังบันทึก...</>
                : <><i className="fas fa-save text-[12px]" /> บันทึกข้อมูล</>}
            </button>
          </div>
        </div>

        {/* RIGHT — Slip Verification */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex flex-col">

          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-plug text-blue-500 text-xs" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">การตรวจสอบสลิป</h3>
                <p className="text-[11px] text-gray-400">ระบบตรวจสอบอัตโนมัติ</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">
                <i className="fas fa-lock text-[8px]" /> SSL
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-green-500 text-white">
                <i className="fas fa-shield-alt text-[8px]" /> Secure
              </span>
            </div>
          </div>

          <div className="p-5 flex-1 flex flex-col gap-3.5">

            {/* ── สถานะการรับชำระเงิน ─────────────────────────────────── */}
            <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border-2 shadow-[0_4px_0_rgba(0,0,0,0.08),0_2px_12px_rgba(0,0,0,0.07)] transition-all duration-300 ${
              ppEnabled
                ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50'
                : 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50'
            }`}>
              {/* glow strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors duration-300 ${ppEnabled ? 'bg-green-500' : 'bg-red-400'}`} />
              <div className="flex items-center gap-3 pl-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${ppEnabled ? 'bg-green-500' : 'bg-red-400'}`}>
                  <i className={`fas ${ppEnabled ? 'fa-store' : 'fa-store-slash'} text-white text-sm`} />
                </div>
                <div>
                  <p className={`text-sm font-black ${ppEnabled ? 'text-green-800' : 'text-red-800'}`}>
                    {ppEnabled ? 'เปิดรับชำระเงิน' : 'ปิดรับชำระเงิน'}
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 ${ppEnabled ? 'text-green-600' : 'text-red-500'}`}>
                    {ppEnabled ? 'ผู้เล่นสามารถเติมเงินได้ปกติ' : 'ผู้เล่นไม่สามารถเติมเงินได้'}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={ppEnabled} onChange={e => setPpEnabled(e.target.checked)} />
                  <div className={`w-14 h-7 rounded-full transition-colors duration-200 ${ppEnabled ? 'bg-green-500' : 'bg-red-300'}`} />
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${ppEnabled ? 'translate-x-7' : ''}`} />
                </div>
              </label>
            </div>

            {/* ── Feature checklist ────────────────────────────────────── */}
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">ฟีเจอร์ & สถานะ</p>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: 'PromptPay QR Code',          ok: !!(ppId),               desc: ppId ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่าเลขพร้อมเพย์' },
                  { label: 'ตรวจสลิปอัตโนมัติ',          ok: !!esStatus?.configured, desc: esStatus?.configured ? 'พร้อมใช้งาน' : 'ยังไม่ได้ตั้งค่า Key' },
                  { label: 'ป้องกันสลิปซ้ำ 2 ชั้น',      ok: true,                    desc: 'เปิดใช้งาน' },
                  { label: 'เข้ารหัส SSL ทุกการส่งข้อมูล', ok: true,                  desc: 'ปลอดภัย' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2.5 px-3 py-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${f.ok ? 'bg-green-100' : 'bg-red-50'}`}>
                      <i className={`fas ${f.ok ? 'fa-check text-green-600' : 'fa-xmark text-red-400'} text-[8px]`} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-700 flex-1">{f.label}</span>
                    <span className={`text-[10px] font-medium flex-shrink-0 ${f.ok ? 'text-gray-400' : 'text-red-400'}`}>{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Access Key ───────────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                <i className="fas fa-key mr-1.5 text-gray-400" />Access Key
              </label>
              {esStatus?.configured ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-gray-50">
                    <i className="fas fa-lock text-gray-300 text-xs flex-shrink-0" />
                    <code className="flex-1 text-xs text-gray-400 tracking-[0.2em] truncate">
                      {esStatus.keyPreview ?? '••••••••-••••-••••-••••-••••••••••••'}
                    </code>
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                      <i className="fas fa-check text-[9px]" /> ตั้งค่าแล้ว
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1 px-0.5">
                    <i className="fas fa-shield-halved text-gray-300" />
                    Key ถูกป้องกันโดยระบบ — ไม่สามารถดูหรือแก้ไขผ่านหน้านี้ได้
                  </p>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-lg border border-red-200 bg-red-50 flex items-center gap-2">
                  <i className="fas fa-circle-xmark text-red-400 text-sm flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-700">ยังไม่ได้ตั้งค่า</p>
                    <p className="text-[10px] text-red-500">กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่า</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1" />

            <button onClick={handleTest} disabled={testing || !esStatus?.configured}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1e2735] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
              {testing
                ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังตรวจสอบ...</>
                : <><i className="fas fa-plug text-[12px]" /> ตรวจสอบการเชื่อมต่อ</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Bonus Multiplier Card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-bolt text-orange-500 text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">โปรโมชั่นเติมเงิน</h3>
              <p className="text-[11px] text-gray-400">ตั้งค่าโบนัสคูณยอดสำหรับการเติมเงิน</p>
            </div>
          </div>
          {/* Live status badge */}
          {bonusEnabled && parseFloat(bonusMult) > 1 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-black">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              โปรฯ ใช้งานอยู่ x{parseFloat(bonusMult)}
            </span>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT — Toggle + Multiplier config */}
          <div className="space-y-4">

            {/* Enable toggle */}
            <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border-2 shadow-[0_4px_0_rgba(0,0,0,0.08),0_2px_12px_rgba(0,0,0,0.07)] transition-all duration-300 ${
              bonusEnabled
                ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors duration-300 ${bonusEnabled ? 'bg-orange-400' : 'bg-gray-300'}`} />
              <div className="flex items-center gap-3 pl-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${bonusEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}>
                  <i className={`fas fa-bolt text-white text-sm`} />
                </div>
                <div>
                  <p className={`text-sm font-black ${bonusEnabled ? 'text-orange-800' : 'text-gray-600'}`}>
                    {bonusEnabled ? 'โปรโมชั่นเปิดอยู่' : 'โปรโมชั่นปิดอยู่'}
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 ${bonusEnabled ? 'text-orange-600' : 'text-gray-400'}`}>
                    {bonusEnabled ? `ผู้เล่นได้รับโบนัส x${parseFloat(bonusMult) || 1}` : 'ยอดที่ได้รับปกติ x1'}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={bonusEnabled} onChange={e => setBonusEnabled(e.target.checked)} />
                  <div className={`w-14 h-7 rounded-full transition-colors duration-200 ${bonusEnabled ? 'bg-orange-400' : 'bg-gray-300'}`} />
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${bonusEnabled ? 'translate-x-7' : ''}`} />
                </div>
              </label>
            </div>

            {/* Multiplier presets */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">เลือกตัวคูณโบนัส</label>
              <div className="flex gap-2 flex-wrap">
                {BONUS_PRESETS.map(p => (
                  <button key={p.value} onClick={() => setBonusMult(p.value)}
                    className={`px-4 py-2 rounded-lg text-[13px] font-black border-2 transition-all ${
                      bonusMult === p.value
                        ? 'bg-orange-500 border-orange-500 text-white shadow-[0_3px_0_#c2410c]'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom multiplier input */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                กำหนดเองแบบละเอียด
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <i className="fas fa-times text-sm" />
                </div>
                <input
                  type="number" min="1" step="0.5"
                  value={bonusMult}
                  onChange={e => setBonusMult(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-mono font-black focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="เช่น 1.5, 2, 3..."
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">ใส่ 1 = ไม่มีโบนัส, 2 = ได้รับ x2, 2.5 = ได้รับ x2.5</p>
            </div>

            <button onClick={handleSaveBonus} disabled={savingBonus}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1e2735] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              {savingBonus
                ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังบันทึก...</>
                : <><i className="fas fa-save text-[12px]" /> บันทึกการตั้งค่าโปรโมชั่น</>}
            </button>
          </div>

          {/* RIGHT — Preview table */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">ตัวอย่างยอดที่ผู้เล่นจะได้รับ</p>
              {(() => {
                const mult = parseFloat(bonusMult) || 1;
                return (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-3 px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">โอนเงิน</span>
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-wide text-center">โบนัส</span>
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-wide text-right">ได้รับจริง</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {PREVIEW_AMOUNTS.map(a => {
                        const received = parseFloat((a * mult).toFixed(2));
                        const bonus = parseFloat((received - a).toFixed(2));
                        return (
                          <div key={a} className="grid grid-cols-3 px-3 py-2.5 hover:bg-gray-50/60 transition-colors">
                            <span className="text-[13px] font-black text-gray-700">฿{a.toLocaleString()}</span>
                            <span className={`text-[12px] font-bold text-center ${bonus > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
                              {bonus > 0 ? `+฿${bonus.toLocaleString()}` : '—'}
                            </span>
                            <span className={`text-[13px] font-black text-right ${received > a ? 'text-green-600' : 'text-gray-500'}`}>
                              ฿{received.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className={`px-3 py-2 border-t ${bonusEnabled && mult > 1 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                      <p className={`text-[10px] font-bold text-center ${bonusEnabled && mult > 1 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {bonusEnabled && mult > 1
                          ? `โปรโมชั่นใช้งานอยู่ — ผู้เล่นได้รับ x${mult} ทันที`
                          : 'ยังไม่เปิดโปรโมชั่น — ยอดปกติ x1'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <i className="fas fa-triangle-exclamation text-amber-500 text-xs mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                โบนัสจะถูกคำนวณโดยอัตโนมัติเมื่อผู้เล่นยืนยันสลิป
                ยอดที่ credit เข้า Wallet คือ <span className="text-orange-600">ยอดจากสลิป × ตัวคูณ</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
