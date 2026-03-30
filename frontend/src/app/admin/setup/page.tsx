'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getToken, setToken } from '@/lib/api';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function SetupWizardPage() {
  const { user, refresh } = useAuth();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [rconStatus, setRconStatus] = useState<TestStatus>('idle');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Step 1: Admin Account
  const [adminForm, setAdminForm] = useState({ username: '', password: '', confirm: '' });
  // Step 2: Shop Settings
  const [shopForm, setShopForm] = useState({ shop_name: '', shop_subtitle: '', currency_symbol: '฿' });
  // Step 3: AuthMe DB (customer-filled)
  const [authmeForm, setAuthmeForm] = useState({ host: '', port: 3306, user: '', password: '', database: '', table: 'authme' });
  const [authmeTestStatus, setAuthmeTestStatus] = useState<TestStatus>('idle');
  const [authmeTestMsg, setAuthmeTestMsg] = useState('');
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [authmePlayerCount, setAuthmePlayerCount] = useState<number | null>(null);
  // Steps 4–5: Server Config
  const [server, setServer] = useState({
    name: '', host: '', port: 25565,
    rcon_port: 25575, rcon_password: '',
    minecraft_version: '1.20.4', max_players: 100,
  });

  useEffect(() => {
    api('/setup/status', { method: 'GET' })
      .then((data: any) => {
        setHasAdmin(data.hasAdmin);
        if (data.hasAdmin) setStep(3);
      })
      .catch(() => setHasAdmin(false));
  }, []);

  // ── Handlers ───────────────────────────────────────────────

  const createAdmin = async () => {
    if (adminForm.password !== adminForm.confirm) {
      setMessage('รหัสผ่านไม่ตรงกัน');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await api('/setup/init-admin', {
        method: 'POST',
        body: { username: adminForm.username, password: adminForm.password },
      });
      if (res.success) {
        setToken(res.token as string);
        await refresh();
        setStep(2);
      } else {
        setMessage(String(res.error || 'เกิดข้อผิดพลาด'));
      }
    } catch (err: any) {
      setMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const saveShopSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await api('/setup/save-settings', {
        method: 'POST',
        token: getToken() || undefined,
        body: {
          shop_name: shopForm.shop_name,
          shop_subtitle: shopForm.shop_subtitle || undefined,
          currency_symbol: shopForm.currency_symbol || undefined,
        },
      });
      if (res.success) {
        setStep(3);
      } else {
        setMessage(String(res.error || 'เกิดข้อผิดพลาด'));
      }
    } catch (err: any) {
      setMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const testAuthMe = async () => {
    setAuthmeTestStatus('testing');
    setAuthmeTestMsg('');
    setAuthmePlayerCount(null);
    try {
      const res = await api('/setup/test-db', {
        method: 'POST',
        token: getToken() || undefined,
        body: {
          host: authmeForm.host,
          port: authmeForm.port,
          user: authmeForm.user,
          password: authmeForm.password,
          database: authmeForm.database,
          table: authmeForm.table,
        },
      });
      if (res.success) {
        setAuthmeTestStatus('success');
        setAuthmeTestMsg(res.message || 'Connected');
        if (typeof res.playerCount === 'number') setAuthmePlayerCount(res.playerCount);
      } else {
        setAuthmeTestStatus('error');
        setAuthmeTestMsg(res.message || 'ไม่สามารถเชื่อมต่อได้');
      }
    } catch (err: any) {
      setAuthmeTestStatus('error');
      setAuthmeTestMsg(err.message || 'Connection failed');
    }
  };

  const testRcon = async () => {
    setRconStatus('testing');
    setMessage('');
    try {
      const res = await api('/setup/test-rcon', {
        method: 'POST',
        token: getToken() || undefined,
        body: { host: server.host, rcon_port: server.rcon_port, rcon_password: server.rcon_password },
      });
      if (res.success) { setRconStatus('success'); setMessage(res.message || 'Connected'); }
      else { setRconStatus('error'); setMessage(res.message || 'RCON connection failed'); }
    } catch (err: any) {
      setRconStatus('error');
      setMessage(err.message || 'Connection test failed');
    }
  };

  const saveServer = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await api('/setup/save-server', {
        method: 'POST',
        token: getToken() || undefined,
        body: server,
      });
      if (res.success) {
        setStep(6);
      } else {
        setMessage(String(res.error || 'Failed to save'));
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const resetServer = () => {
    setServer({ name: '', host: '', port: 25565, rcon_port: 25575, rcon_password: '', minecraft_version: '1.20.4', max_players: 100 });
    setRconStatus('idle');
    setMessage('');
    setStep(4);
  };

  // ── Loading ─────────────────────────────────────────────────

  if (hasAdmin === null) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-3xl text-[#22c55e]"></i>
      </div>
    );
  }

  if (hasAdmin && (!user || user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm w-full">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-shield-halved text-2xl text-red-600"></i>
          </div>
          <h2 className="text-xl font-bold mb-2 text-gray-900">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-500 mb-6">คุณต้องเป็น Admin เพื่อใช้งาน Setup Wizard</p>
          <a href="/admin" className="px-6 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold rounded-xl transition-colors inline-block">
            <i className="fas fa-sign-in-alt mr-2"></i>เข้าสู่ระบบ
          </a>
        </div>
      </div>
    );
  }

  // ── Step display logic ──────────────────────────────────────

  const isFirstTime = !hasAdmin;
  const steps = isFirstTime
    ? ['สร้างบัญชี Admin', 'ตั้งค่าร้านค้า', 'ตั้งค่า AuthMe', 'ข้อมูลเซิร์ฟเวอร์', 'ตั้งค่า RCON', 'เสร็จสิ้น']
    : ['ตั้งค่า AuthMe', 'ข้อมูลเซิร์ฟเวอร์', 'ตั้งค่า RCON', 'เสร็จสิ้น'];
  const displayStep = isFirstTime ? step : step - 2;

  const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/30 focus:border-[#22c55e] transition-colors';
  const FIELD_INPUT = 'w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white';

  const canTestAuthMe = !!(authmeForm.host && authmeForm.user && authmeForm.password && authmeForm.database);

  return (
    <div className={isFirstTime ? 'min-h-screen bg-[#f4f5f7] flex items-start justify-center pt-10 p-4' : ''}>
      <div className={`w-full mx-auto ${step === 3 ? 'max-w-4xl' : 'max-w-2xl'}`}>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">
            <i className="fas fa-wand-magic-sparkles text-[#22c55e] mr-2"></i>
            Setup Wizard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isFirstTime ? 'ตั้งค่าระบบครั้งแรก — ใช้เวลาเพียงไม่กี่นาที' : 'ตั้งค่า AuthMe + เพิ่มเซิร์ฟเวอร์ Minecraft'}
          </p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center mb-6 gap-1.5 overflow-x-auto pb-2">
          {steps.map((label, i) => {
            const sNum = i + 1;
            const done = displayStep > sNum;
            const active = displayStep >= sNum;
            const current = displayStep === sNum;
            return (
              <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                    active ? 'bg-[#16a34a] text-white shadow-[0_3px_0_#0d6b2e]' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {done ? <i className="fas fa-check text-[10px]"></i> : sNum}
                  </div>
                  <span className={`text-xs font-medium hidden md:block whitespace-nowrap ${current ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-5 h-0.5 flex-shrink-0 transition-colors ${done ? 'bg-[#22c55e]' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Create Admin ───────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">สร้างบัญชีผู้ดูแลระบบ</h2>
              <p className="text-sm text-gray-500 mt-0.5">บัญชีนี้จะมีสิทธิ์เข้าถึง Admin Panel ทั้งหมด</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3">
              <i className="fas fa-triangle-exclamation text-amber-500 mt-0.5 flex-shrink-0"></i>
              <p className="text-sm text-amber-700">
                ชื่อผู้ใช้นี้จะถูกสร้างใน <strong>AuthMe</strong> ด้วย — ใช้ชื่อที่ตรงกับ IGN ของคุณบนเซิร์ฟเวอร์ Minecraft หากต้องการ
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้ (Username)</label>
                <input type="text" value={adminForm.username}
                  onChange={e => setAdminForm(p => ({ ...p, username: e.target.value }))}
                  className={INPUT} placeholder="admin" autoComplete="username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
                <input type="password" value={adminForm.password}
                  onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))}
                  className={INPUT} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่าน</label>
                <input type="password" value={adminForm.confirm}
                  onChange={e => setAdminForm(p => ({ ...p, confirm: e.target.value }))}
                  className={INPUT} placeholder="••••••••" autoComplete="new-password" />
              </div>
            </div>

            {message && (
              <div className="p-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-200">
                <i className="fas fa-circle-exclamation mr-2"></i>{message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={createAdmin}
                disabled={saving || !adminForm.username || !adminForm.password || !adminForm.confirm}
                className="px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] active:shadow-none active:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>กำลังสร้าง...</> : <>ถัดไป <i className="fas fa-arrow-right ml-1.5"></i></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Shop Settings ─────────────────────────── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">ตั้งค่าร้านค้า</h2>
              <p className="text-sm text-gray-500 mt-0.5">ข้อมูลพื้นฐานที่แสดงบนหน้าเว็บไซต์ (แก้ไขได้ภายหลัง)</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อร้านค้า <span className="text-red-500">*</span></label>
                <input type="text" value={shopForm.shop_name}
                  onChange={e => setShopForm(p => ({ ...p, shop_name: e.target.value }))}
                  className={INPUT} placeholder="CraftWorld Shop" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบายสั้น</label>
                <input type="text" value={shopForm.shop_subtitle}
                  onChange={e => setShopForm(p => ({ ...p, shop_subtitle: e.target.value }))}
                  className={INPUT} placeholder="ร้านค้าไอเท็มสำหรับ Minecraft" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สกุลเงิน</label>
                <input type="text" value={shopForm.currency_symbol}
                  onChange={e => setShopForm(p => ({ ...p, currency_symbol: e.target.value }))}
                  className={INPUT} placeholder="฿" />
                <p className="text-xs text-gray-400 mt-1">สัญลักษณ์ที่แสดงบนเว็บไซต์ เช่น ฿</p>
              </div>
            </div>

            {message && (
              <div className="p-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-200">
                <i className="fas fa-circle-exclamation mr-2"></i>{message}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={saveShopSettings}
                disabled={saving || !shopForm.shop_name}
                className="px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] active:shadow-none active:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>กำลังบันทึก...</> : <>ถัดไป <i className="fas fa-arrow-right ml-1.5"></i></>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: AuthMe DB — form LEFT, guide RIGHT ────── */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-4 items-start">

            {/* ── LEFT: Form Panel ── */}
            <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
              {/* Card header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-database text-green-600 text-[10px]"></i>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">ข้อมูล AuthMe MySQL</h3>
                  <p className="text-[11px] text-gray-400">กรอกค่าจาก plugins/AuthMe/config.yml</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="p-4 space-y-3">

                {/* Host + Port */}
                <div className="grid grid-cols-[1fr_88px] gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      Host <span className="text-red-400">*</span>
                      <span className="ml-1.5 font-normal text-gray-400">← mySQLHost</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                        <i className="fas fa-server text-xs"></i>
                      </div>
                      <input
                        type="text"
                        value={authmeForm.host}
                        onChange={e => setAuthmeForm(p => ({ ...p, host: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white"
                        placeholder="127.0.0.1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Port</label>
                    <input
                      type="number"
                      value={authmeForm.port}
                      onChange={e => setAuthmeForm(p => ({ ...p, port: parseInt(e.target.value) || 3306 }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 text-center bg-white"
                    />
                  </div>
                </div>

                {/* Username + Password */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      Username <span className="text-red-400">*</span>
                      <span className="ml-1.5 font-normal text-gray-400">← mySQLUsername</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                        <i className="fas fa-user text-xs"></i>
                      </div>
                      <input
                        type="text"
                        value={authmeForm.user}
                        onChange={e => setAuthmeForm(p => ({ ...p, user: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white"
                        placeholder="root"
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      Password <span className="text-red-400">*</span>
                      <span className="ml-1.5 font-normal text-gray-400">← mySQLPassword</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                        <i className="fas fa-lock text-xs"></i>
                      </div>
                      <input
                        type={showDbPassword ? 'text' : 'password'}
                        value={authmeForm.password}
                        onChange={e => setAuthmeForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full pl-8 pr-9 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white"
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowDbPassword(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                        <i className={`fas ${showDbPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Database + Table */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      Database <span className="text-red-400">*</span>
                      <span className="ml-1.5 font-normal text-gray-400">← mySQLDatabase</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                        <i className="fas fa-database text-xs"></i>
                      </div>
                      <input
                        type="text"
                        value={authmeForm.database}
                        onChange={e => setAuthmeForm(p => ({ ...p, database: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white"
                        placeholder="minecraft_shop"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">
                      Table
                      <span className="ml-1.5 font-normal text-gray-400">← mySQLTablename</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                        <i className="fas fa-table text-xs"></i>
                      </div>
                      <input
                        type="text"
                        value={authmeForm.table}
                        onChange={e => setAuthmeForm(p => ({ ...p, table: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 bg-white"
                        placeholder="authme"
                      />
                    </div>
                  </div>
                </div>

                {/* Test result */}
                {authmeTestMsg && (
                  <div className={`py-2 px-3 rounded-lg text-xs flex items-center gap-2 border ${
                    authmeTestStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    <i className={`fas ${authmeTestStatus === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} flex-shrink-0`}></i>
                    <span className="truncate">{authmeTestMsg}</span>
                    {authmePlayerCount !== null && authmePlayerCount > 0 && (
                      <span className="ml-auto flex-shrink-0 flex items-center gap-1 font-bold">
                        <i className="fas fa-users"></i> {authmePlayerCount} คน
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
                <button
                  onClick={testAuthMe}
                  disabled={!canTestAuthMe || authmeTestStatus === 'testing'}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:translate-y-[2px] ${
                    authmeTestStatus === 'success'
                      ? 'bg-emerald-500 text-white shadow-[0_4px_0_#15803d] active:shadow-[0_1px_0_#15803d]'
                      : authmeTestStatus === 'error'
                      ? 'bg-red-500 text-white shadow-[0_4px_0_#b91c1c] active:shadow-[0_1px_0_#b91c1c]'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db] active:shadow-[0_1px_0_#d1d5db]'
                  }`}
                >
                  {authmeTestStatus === 'testing'
                    ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> กำลังทดสอบ...</>
                    : authmeTestStatus === 'success'
                    ? <><i className="fas fa-circle-check text-[12px]"></i> เชื่อมต่อสำเร็จ</>
                    : authmeTestStatus === 'error'
                    ? <><i className="fas fa-rotate-right text-[12px]"></i> ลองอีกครั้ง</>
                    : <><i className="fas fa-plug text-[12px]"></i> ทดสอบการเชื่อมต่อ</>}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setStep(4)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-500 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-none active:translate-y-[2px]">
                    ข้าม <i className="fas fa-forward-step text-[12px]"></i>
                  </button>
                  <button onClick={() => setStep(4)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d6b2e] active:translate-y-[2px]">
                    ถัดไป <i className="fas fa-arrow-right text-[12px]"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Instruction Panel ── */}
            <div className="bg-[#1e2735] rounded-2xl p-4 shadow-[0_4px_0_#131820] text-white">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#22c55e]/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-book-open text-[#22c55e] text-[10px]"></i>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">คู่มือตั้งค่า AuthMe</h3>
                  <p className="text-[11px] text-white/50">หาข้อมูลจาก config.yml</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Steps */}
                <div className="space-y-2.5">
                  {[
                    { n: '1', title: 'เปิดไฟล์ config', sub: <code className="text-[10px] text-[#22c55e] bg-white/10 px-1.5 py-0.5 rounded">plugins/AuthMe/config.yml</code> },
                    { n: '2', title: 'ค้นหา DataSource:', sub: <span className="text-[10px] text-white/40">ดู key แต่ละช่องในตารางด้านล่าง</span> },
                    { n: '3', title: 'กรอกค่าในฟอร์มซ้าย', sub: <span className="text-[10px] text-white/40">แล้วกด "ทดสอบการเชื่อมต่อ"</span> },
                  ].map(({ n, title, sub }) => (
                    <div key={n} className="flex gap-2.5 items-start">
                      <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0 text-[9px] font-black text-white mt-0.5">{n}</div>
                      <div>
                        <p className="text-[12px] font-semibold text-white leading-tight">{title}</p>
                        <div className="mt-0.5">{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* YAML snippet */}
                <div className="bg-black/40 rounded-xl p-3 font-mono text-[10px] leading-[1.65]">
                  <span className="text-purple-400">DataSource:</span><br />
                  {'  '}<span className="text-blue-300">backend:</span> <span className="text-amber-300">MYSQL</span><br />
                  {'  '}<span className="text-blue-300">mySQLHost:</span> <span className="text-white/50">your-db-host</span><br />
                  {'  '}<span className="text-blue-300">mySQLPort:</span> <span className="text-green-400">3306</span><br />
                  {'  '}<span className="text-blue-300">mySQLUsername:</span> <span className="text-white/50">username</span><br />
                  {'  '}<span className="text-blue-300">mySQLPassword:</span> <span className="text-white/50">password</span><br />
                  {'  '}<span className="text-blue-300">mySQLDatabase:</span> <span className="text-white/50">database</span><br />
                  {'  '}<span className="text-blue-300">mySQLTablename:</span> <span className="text-green-400">authme</span>
                </div>

                {/* Field mapping */}
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-white/30 uppercase tracking-wider mb-2">ช่องฟอร์ม ↔ key ใน config</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {[
                      { field: 'Host', key: 'mySQLHost' },
                      { field: 'Port', key: 'mySQLPort' },
                      { field: 'Username', key: 'mySQLUsername' },
                      { field: 'Password', key: 'mySQLPassword' },
                      { field: 'Database', key: 'mySQLDatabase' },
                      { field: 'Table', key: 'mySQLTablename' },
                    ].map(({ field, key }) => (
                      <div key={field} className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-white/60">{field}</span>
                        <code className="text-[9px] text-[#22c55e] bg-black/30 px-1 py-0.5 rounded">{key}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning */}
                <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                  <i className="fas fa-triangle-exclamation text-amber-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                  <p className="text-[10px] text-amber-200/80 leading-relaxed">
                    MySQL ต้องเปิด <strong className="text-amber-300">port 3306</strong> ให้ภายนอก (VPS / server อื่น) เข้าถึงได้
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Server Info ────────────────────────────── */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">ข้อมูลเซิร์ฟเวอร์ Minecraft</h2>
              <p className="text-sm text-gray-500 mt-0.5">กรอกข้อมูลเซิร์ฟเวอร์ Minecraft ของคุณ</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเซิร์ฟเวอร์ <span className="text-red-500">*</span></label>
                <input type="text" value={server.name}
                  onChange={e => setServer(p => ({ ...p, name: e.target.value }))}
                  className={INPUT} placeholder="My Survival Server" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Host / IP <span className="text-red-500">*</span></label>
                <input type="text" value={server.host}
                  onChange={e => setServer(p => ({ ...p, host: e.target.value }))}
                  className={INPUT} placeholder="host.docker.internal" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Game Port</label>
                <input type="number" value={server.port}
                  onChange={e => setServer(p => ({ ...p, port: parseInt(e.target.value) || 25565 }))}
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minecraft Version</label>
                <input type="text" value={server.minecraft_version}
                  onChange={e => setServer(p => ({ ...p, minecraft_version: e.target.value }))}
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
                <input type="number" value={server.max_players}
                  onChange={e => setServer(p => ({ ...p, max_players: parseInt(e.target.value) || 100 }))}
                  className={INPUT} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setStep(5)}
                disabled={!server.name || !server.host}
                className="px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] active:shadow-none active:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                ถัดไป <i className="fas fa-arrow-right ml-1.5"></i>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: RCON Config ────────────────────────────── */}
        {step === 5 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">ตั้งค่า RCON</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                เปิดใช้งาน <code className="text-[#22c55e] bg-gray-100 px-1.5 py-0.5 rounded text-xs">enable-rcon=true</code> ใน server.properties ก่อน
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RCON Port</label>
                <input type="number" value={server.rcon_port}
                  onChange={e => setServer(p => ({ ...p, rcon_port: parseInt(e.target.value) || 25575 }))}
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RCON Password <span className="text-red-500">*</span></label>
                <input type="password" value={server.rcon_password}
                  onChange={e => setServer(p => ({ ...p, rcon_password: e.target.value }))}
                  className={INPUT} placeholder="Your RCON password" />
              </div>
            </div>

            <div>
              <button onClick={testRcon}
                disabled={rconStatus === 'testing' || !server.rcon_password}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  rconStatus === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                  rconStatus === 'error' ? 'bg-red-100 text-red-700 border border-red-300' :
                  'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
                }`}>
                {rconStatus === 'testing' ? <><i className="fas fa-spinner fa-spin mr-2"></i>กำลังทดสอบ...</> :
                 rconStatus === 'success' ? <><i className="fas fa-check mr-2"></i>เชื่อมต่อสำเร็จ</> :
                 rconStatus === 'error' ? <><i className="fas fa-rotate-right mr-2"></i>ลองอีกครั้ง</> :
                 <><i className="fas fa-plug mr-2"></i>ทดสอบการเชื่อมต่อ RCON</>}
              </button>
            </div>

            {message && (
              <div className={`p-3 rounded-xl text-sm ${
                rconStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                <i className={`fas ${rconStatus === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-2`}></i>
                {message}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => { setStep(4); setMessage(''); }}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors">
                <i className="fas fa-arrow-left mr-1.5"></i>ย้อนกลับ
              </button>
              <button onClick={saveServer}
                disabled={saving || !server.rcon_password}
                className="px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] active:shadow-none active:translate-y-[3px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                {saving ? <><i className="fas fa-spinner fa-spin mr-2"></i>กำลังบันทึก...</> : <><i className="fas fa-floppy-disk mr-1.5"></i>บันทึกและเสร็จสิ้น</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 6: Done ───────────────────────────────────── */}
        {step === 6 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto shadow-[0_4px_0_#a7f3d0]">
              <i className="fas fa-check text-3xl text-emerald-600"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">ตั้งค่าเสร็จสิ้น!</h2>
              <p className="text-gray-500 mt-1">
                เซิร์ฟเวอร์ <span className="font-bold text-gray-900">{server.name}</span> พร้อมให้บริการแล้ว
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1.5 border border-gray-200">
              <p className="text-gray-600"><span className="text-gray-400 w-24 inline-block">Host:</span> {server.host}:{server.port}</p>
              <p className="text-gray-600"><span className="text-gray-400 w-24 inline-block">RCON:</span> Port {server.rcon_port}</p>
              <p className="text-gray-600"><span className="text-gray-400 w-24 inline-block">Version:</span> {server.minecraft_version}</p>
              <p className="text-gray-600"><span className="text-gray-400 w-24 inline-block">Password:</span> <i className="fas fa-lock text-gray-400 mr-1"></i>เข้ารหัสแล้ว</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <a href="/admin"
                className="px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] active:shadow-none active:translate-y-[3px] transition-all inline-block">
                <i className="fas fa-chart-pie mr-2"></i>ไปหน้าแดชบอร์ด
              </a>
              <button onClick={resetServer}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-colors">
                <i className="fas fa-plus mr-2"></i>เพิ่มเซิร์ฟเวอร์อื่น
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
