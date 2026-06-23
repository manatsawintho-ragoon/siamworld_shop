'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

const BONUS_PRESETS = [
  { label: 'ปกติ', value: '1' },
  { label: 'x2', value: '2' },
  { label: 'x3', value: '3' },
  { label: 'x4', value: '4' },
  { label: 'x5', value: '5' },
];
const PREVIEW_AMOUNTS = [50, 100, 200, 500, 1000];

const isValidPhone = (raw: string) => /^0[689]\d{8}$/.test(raw.replace(/\D/g, ''));

export default function TrueMoneySettingsPage() {
  const { alert: adminAlert } = useAdminAlert();

  const [loading,    setLoading]    = useState(true);
  const [tmnEnabled, setTmnEnabled] = useState(false);
  const [tmnPhone,   setTmnPhone]   = useState('');
  const [savingTmn,  setSavingTmn]  = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  // TrueMoney-only bonus multiplier
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusMult,    setBonusMult]    = useState('1');
  const [savingBonus,  setSavingBonus]  = useState(false);

  const load = useCallback(async () => {
    try {
      const settingsRes = await api('/admin/settings', { token: getToken()! }) as any;
      const s: Record<string, string> = {};
      (settingsRes.settings as { key: string; value: string }[])
        ?.forEach(({ key, value }) => { s[key] = value; });
      setTmnEnabled(s.truemoney_enabled === 'true');
      setTmnPhone(s.truemoney_phone || '');
      setBonusEnabled((s.topup_bonus_truemoney_enabled ?? s.topup_bonus_enabled) === 'true');
      setBonusMult(s.topup_bonus_truemoney_multiplier ?? s.topup_bonus_multiplier ?? '1');
    } catch {
      adminAlert({ type: 'error', title: 'โหลดการตั้งค่าไม่สำเร็จ' });
    } finally { setLoading(false); }
  }, [adminAlert]);

  useEffect(() => { load(); }, [load]);

  const phoneValid = isValidPhone(tmnPhone);
  // The exact reason the bug happened: toggle ON but no valid phone -> save was rejected.
  const blockedByPhone = tmnEnabled && !phoneValid;

  const handleSaveTmn = async () => {
    const phone = tmnPhone.replace(/\D/g, '');
    if (tmnEnabled && !isValidPhone(phone)) {
      adminAlert({
        type: 'error',
        title: 'ต้องกรอกเบอร์ TrueMoney ก่อนเปิดใช้งาน',
        message: 'กรอกเบอร์ 10 หลัก (เช่น 0812345678) ของกระเป๋าร้านก่อน แล้วจึงเปิดใช้งานได้',
      });
      phoneRef.current?.focus();
      return;
    }
    setSavingTmn(true);
    try {
      await api('/admin/settings', {
        method: 'PUT', token: getToken()!,
        body: { settings: [
          { key: 'truemoney_enabled', value: String(tmnEnabled) },
          { key: 'truemoney_phone',   value: phone },
        ]},
      });
      adminAlert({
        type: 'success',
        title: 'บันทึกข้อมูลแล้ว',
        message: tmnEnabled ? 'เปิดรับซองของขวัญเรียบร้อย ผู้เล่นเติมผ่าน Angpao ได้แล้ว' : undefined,
      });
    } catch { adminAlert({ type: 'error', title: 'บันทึกไม่สำเร็จ' }); }
    finally  { setSavingTmn(false); }
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
          { key: 'topup_bonus_truemoney_enabled',    value: String(bonusEnabled) },
          { key: 'topup_bonus_truemoney_multiplier', value: String(mult) },
        ]},
      });
      adminAlert({ type: 'success', title: 'บันทึกข้อมูลแล้ว' });
    } catch { adminAlert({ type: 'error', title: 'บันทึกไม่สำเร็จ' }); }
    finally  { setSavingBonus(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-3xl text-[#ed1c24]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-gift text-[#ed1c24]" /> TrueMoney Wallet (ซองของขวัญ)
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">รับเติมเงินผ่านซองของขวัญ Angpao และตั้งโปรโมชั่นเฉพาะ TrueMoney</p>
        </div>
        {tmnEnabled && phoneValid && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ed1c24] text-white text-[11px] font-black flex-shrink-0">
            <i className="fas fa-circle-check text-[10px]" /> เปิดใช้งานอยู่
          </span>
        )}
        {blockedByPhone && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold flex-shrink-0">
            <i className="fas fa-triangle-exclamation text-amber-500 text-[10px]" /> ยังเปิดไม่ได้ ต้องกรอกเบอร์ก่อน
          </span>
        )}
      </div>

      {/* ── TrueMoney Wallet Card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-wallet text-[#ed1c24] text-xs" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">ตั้งค่ารับซองของขวัญ</h3>
            <p className="text-[11px] text-gray-400">ซองของขวัญจะถูกแลกเข้ากระเป๋าร้านโดยอัตโนมัติ</p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Enable toggle */}
            <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border-2 shadow-[0_4px_0_rgba(0,0,0,0.08),0_2px_12px_rgba(0,0,0,0.07)] transition-all ${tmnEnabled ? 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tmnEnabled ? 'bg-[#ed1c24]' : 'bg-gray-300'}`} />
              <div className="flex items-center gap-3 pl-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${tmnEnabled ? 'bg-[#ed1c24]' : 'bg-gray-300'}`}>
                  <i className="fas fa-wallet text-white text-sm" />
                </div>
                <div>
                  <p className={`text-sm font-black ${tmnEnabled ? 'text-red-800' : 'text-gray-600'}`}>
                    {tmnEnabled ? 'เปิดรับซองของขวัญ' : 'ปิดรับซองของขวัญ'}
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 ${tmnEnabled ? 'text-red-600' : 'text-gray-400'}`}>
                    {tmnEnabled ? 'ผู้เล่นเติมผ่านซองของขวัญได้' : 'ผู้เล่นยังเติมผ่านซองไม่ได้'}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={tmnEnabled}
                    onChange={e => {
                      const next = e.target.checked;
                      setTmnEnabled(next);
                      if (next && !phoneValid) setTimeout(() => phoneRef.current?.focus(), 50);
                    }} />
                  <div className={`w-14 h-7 rounded-full transition-colors ${tmnEnabled ? 'bg-[#ed1c24]' : 'bg-gray-300'}`} />
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${tmnEnabled ? 'translate-x-7' : ''}`} />
                </div>
              </label>
            </div>

            {/* Blocked-by-phone warning (this is exactly what caused the saved-but-not-on bug) */}
            {blockedByPhone && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <i className="fas fa-circle-exclamation text-amber-500 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                  เปิดใช้งานไม่ได้จนกว่าจะกรอก <span className="text-amber-900">เบอร์ TrueMoney Wallet ของร้าน</span> ให้ถูกต้อง
                  (เบอร์นี้คือกระเป๋าที่จะรับเงินจากซอง) กรอกเบอร์ด้านล่างแล้วกด &quot;บันทึก TrueMoney&quot;
                </p>
              </div>
            )}

            {/* Phone input */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                เบอร์ TrueMoney Wallet ของร้าน <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <i className="fas fa-mobile-alt text-sm" />
                </div>
                <input ref={phoneRef} type="text" value={tmnPhone} onChange={e => setTmnPhone(e.target.value)}
                  placeholder="0812345678"
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 placeholder:text-gray-300 font-mono tracking-wider ${
                    blockedByPhone
                      ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-400/20 bg-amber-50/40'
                      : 'border-gray-200 focus:border-[#637469] focus:ring-[#637469]/20'
                  }`} />
              </div>
              {tmnPhone && !phoneValid ? (
                <p className="text-[10px] text-red-500 font-bold mt-1">
                  <i className="fas fa-xmark mr-1" /> เบอร์ไม่ถูกต้อง ต้องเป็นเบอร์มือถือ 10 หลัก (ขึ้นต้น 06/08/09)
                </p>
              ) : (
                <p className="text-[10px] text-gray-400 mt-1">ซองของขวัญจะถูกแลกเข้ากระเป๋านี้โดยอัตโนมัติ</p>
              )}
            </div>

            <button onClick={handleSaveTmn} disabled={savingTmn}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#ed1c24] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#991b1b] hover:brightness-110 transition-all active:shadow-[0_1px_0_#991b1b] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              {savingTmn ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังบันทึก...</> : <><i className="fas fa-save text-[12px]" /> บันทึก TrueMoney</>}
            </button>
          </div>

          {/* RIGHT — note */}
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <i className="fas fa-shield-halved text-[#ed1c24] text-xs mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-bold text-red-800 leading-relaxed">
                ระบบจะแลกซองของขวัญเข้ากระเป๋าร้านโดยตรง ยอดที่ TrueMoney แจ้งคือยอดจริงที่ credit เข้า Wallet ผู้เล่น
                (ป้องกันซองซ้ำด้วยรหัสซองที่ไม่ซ้ำกัน)
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">ฟีเจอร์ &amp; สถานะ</p>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: 'เบอร์กระเป๋าร้าน', ok: phoneValid, desc: phoneValid ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่าเบอร์' },
                  { label: 'รับซองของขวัญ Angpao', ok: tmnEnabled && phoneValid, desc: tmnEnabled && phoneValid ? 'เปิดใช้งาน' : 'ปิดอยู่' },
                  { label: 'ป้องกันซองซ้ำ', ok: true, desc: 'เปิดใช้งาน' },
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
          </div>
        </div>
      </div>

      {/* ── TrueMoney Bonus Multiplier Card ──────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-bolt text-orange-500 text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">โปรโมชั่นเติมเงิน (เฉพาะ TrueMoney)</h3>
              <p className="text-[11px] text-gray-400">ตั้งค่าโบนัสคูณยอดสำหรับการเติมผ่านซองของขวัญ</p>
            </div>
          </div>
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

            <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border-2 shadow-[0_4px_0_rgba(0,0,0,0.08),0_2px_12px_rgba(0,0,0,0.07)] transition-all duration-300 ${
              bonusEnabled
                ? 'border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-colors duration-300 ${bonusEnabled ? 'bg-orange-400' : 'bg-gray-300'}`} />
              <div className="flex items-center gap-3 pl-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${bonusEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}>
                  <i className="fas fa-bolt text-white text-sm" />
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
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">ยอดซอง</span>
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
                              {bonus > 0 ? `+฿${bonus.toLocaleString()}` : '-'}
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
                          ? `โปรโมชั่นเปิดอยู่ ผู้เล่นได้รับ x${mult} ทันที`
                          : 'ยังไม่เปิดโปรโมชั่น (ยอดปกติ x1)'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <i className="fas fa-triangle-exclamation text-amber-500 text-xs mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                โบนัสนี้ใช้กับการเติมผ่านซองของขวัญ TrueMoney เท่านั้น
                ยอดที่ credit เข้า Wallet คือ <span className="text-orange-600">ยอดในซอง × ตัวคูณ</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
