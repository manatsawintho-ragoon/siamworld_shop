'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api, setToken } from '@/lib/api';

interface RankEntry  { username: string; total_topup: number; }
interface DailyEntry { username: string; total_topup: number; last_topup: string; }

/* ── Login / Register form ─────────────────────────────────── */
function GreenLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [email, setEmail]       = useState('');
  const [busy, setBusy]         = useState(false);
  const { login, refresh }      = useAuth();
  const { alert: showAlert }    = useAdminAlert();

  const reset = () => { setUsername(''); setPassword(''); setConfirm(''); setEmail(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showAlert({ type: 'warning', title: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    setBusy(true);
    try {
      await login(username, password);
      showAlert({ type: 'success', title: 'เข้าสู่ระบบสำเร็จ', message: `ยินดีต้อนรับกลับมา, ${username}!` });
    } catch (err: any) {
      showAlert({ type: 'error', title: 'เข้าสู่ระบบล้มเหลว', message: err?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !confirm || !email) {
      showAlert({ type: 'warning', title: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    if (password !== confirm) {
      showAlert({ type: 'error', title: 'รหัสผ่านไม่ตรงกัน' }); return;
    }
    if (username.length < 3) {
      showAlert({ type: 'warning', title: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' }); return;
    }
    if (password.length < 8) {
      showAlert({ type: 'warning', title: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }); return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showAlert({ type: 'warning', title: 'ชื่อผู้ใช้ไม่ถูกต้อง', message: 'ใช้ได้เฉพาะ a-z, A-Z, 0-9, _ เท่านั้น' }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert({ type: 'warning', title: 'รูปแบบอีเมลไม่ถูกต้อง' }); return;
    }
    setBusy(true);
    try {
      const d = await api('/auth/register', { method: 'POST', body: { username, password, email } });
      setToken(d.token as string); await refresh();
      showAlert({ type: 'success', title: 'สมัครสมาชิกสำเร็จ', message: `ยินดีต้อนรับ, ${username}!` });
    } catch (err: any) {
      showAlert({ type: 'error', title: 'สมัครสมาชิกล้มเหลว', message: err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:outline-none text-gray-800 placeholder:text-gray-300 text-sm rounded-xl px-3.5 py-3 transition-colors';

  return (
    <div className="px-4 pb-4">
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        {(['login', 'register'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); reset(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === m ? 'bg-green-600 text-white shadow-[0_2px_0_#14532d]' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {m === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        ))}
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-2.5">
          <input type="text" placeholder="ชื่อผู้ใช้ในเกม (Minecraft)" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" placeholder="รหัสผ่าน Authme" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} disabled={busy} />
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-black rounded-xl transition-all shadow-[0_4px_0_#14532d] hover:shadow-[0_2px_0_#14532d] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]">
            {busy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-sign-in-alt mr-2" />เข้าสู่ระบบ</>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-2.5">
          <input type="text" placeholder="ชื่อผู้ใช้ (ภาษาอังกฤษ, a-z, 0-9, _)" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} disabled={busy} />
          <input type="email" placeholder="อีเมล (สำหรับ Reset Password)" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} disabled={busy} />
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-black rounded-xl transition-all shadow-[0_4px_0_#14532d] hover:shadow-[0_2px_0_#14532d] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]">
            {busy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-user-plus mr-2" />สมัครสมาชิก</>}
          </button>
          <p className="text-gray-400 text-[10px] text-center leading-relaxed">การสมัครจะสร้าง Authme account ในเซิร์ฟเวอร์ Minecraft ด้วย</p>
        </form>
      )}
    </div>
  );
}

/* ── Main Layout ───────────────────────────────────────────── */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { alert: showAlert } = useAdminAlert();

  const handleLogout = () => {
    logout();
    showAlert({ type: 'success', title: 'ออกจากระบบแล้ว', message: 'คุณได้ออกจากระบบเรียบร้อยแล้ว' });
  };
  const [ranking,    setRanking]    = useState<RankEntry[]>([]);
  const [dailyTopup, setDailyTopup] = useState<DailyEntry[]>([]);
  const discordUrl  = settings.discord_invite || '';
  const facebookUrl = settings.facebook_url   || '';

  useEffect(() => {
    api('/public/topup-ranking').then(d => setRanking((d.ranking  as RankEntry[])  || [])).catch(() => {});
    api('/public/daily-topup').then(d  => setDailyTopup((d.daily  as DailyEntry[]) || [])).catch(() => {});
  }, []);

  const CARD = 'bg-white rounded-2xl border-2 border-green-200 shadow-[0_4px_0_#86efac,0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden';
  const DIV  = 'border-b border-green-100';

  return (
    <div className="flex flex-col min-h-screen bg-[#f1f4f8]">
      <Navbar />

      <div className="flex-1 max-w-[1300px] mx-auto w-full px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-5">

        {/* ── Sidebar ── */}
        <aside className="w-full lg:w-[270px] flex-shrink-0 order-1">
          <div className="sticky top-4 space-y-4">

            {/* ── Member Card ── */}
            <div className={CARD}>

              {/* Header */}
              <div className={`relative px-5 pt-5 pb-4 ${DIV}`}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400" />

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <i className="fas fa-spinner fa-spin text-green-400 text-2xl" />
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl border-2 border-green-200 overflow-hidden shadow-md">
                        <img
                          src={`https://mc-heads.net/avatar/${user.username}/64`}
                          alt={user.username}
                          className="w-full h-full"
                          style={{ imageRendering: 'pixelated' }}
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/64'; }}
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900 font-black text-base truncate leading-tight">{user.username}</p>
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <i className="fas fa-shield-alt text-[8px]" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                          <i className="fas fa-leaf text-[8px]" /> Member
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-users text-green-500 text-lg" />
                    </div>
                    <div>
                      <p className="text-gray-900 font-black text-sm leading-tight">ระบบสมาชิก</p>
                      <p className="text-gray-400 text-xs mt-0.5">เข้าสู่ระบบหรือสมัครใหม่</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Logged-in content */}
              {!loading && user && (
                <>
                  {/* Wallet — Highlight Card */}
                  <div className="px-4 py-3 border-b border-green-100">
                    <div className="relative bg-[#168d41] rounded-xl p-4 text-white shadow-[0_4px_0_#0f6530,0_2px_16px_rgba(22,141,65,0.40)] border border-[#1faa4f]/30 overflow-hidden">
                      <div className="absolute -right-5 -top-5 w-28 h-28 bg-black/10 rounded-full blur-2xl pointer-events-none" />
                      <p className="text-white text-[10px] font-black uppercase tracking-[0.18em] mb-2 drop-shadow">ยอดเงินคงเหลือ</p>
                      <div className="leading-none">
                        <span className="text-white font-black text-3xl tabular-nums drop-shadow-md" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>
                          {user.wallet_balance?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-white/80 text-base font-bold ml-1.5">฿</span>
                      </div>
                    </div>
                  </div>

                  {/* Redeem Code CTA */}
                  <div className="px-4 py-3 border-b border-green-100">
                    <Link href="/redeem"
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold shadow-[0_4px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_2px_0_#b45309] active:translate-y-[2px]">
                      <i className="fas fa-ticket-alt text-[13px]" /> แลกโค้ด
                    </Link>
                  </div>

                  {/* Quick actions — Profile + Inventory */}
                  <div className="px-4 py-3 border-b border-green-100 grid grid-cols-2 gap-2">
                    {[
                      { href: '/profile',   icon: 'fa-user', label: 'โปรไฟล์' },
                      { href: '/inventory', icon: 'fa-box',  label: 'คลัง' },
                    ].map(a => (
                      <Link key={a.href} href={a.href}
                        className="flex flex-col items-center gap-2 py-3.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-all shadow-[0_2px_0_#e5e7eb]">
                        <i className={`fas ${a.icon} text-base`} />
                        <span className="text-xs font-bold leading-none">{a.label}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Admin */}
                  {isAdmin && (
                    <div className="px-4 py-3 border-b border-green-100">
                      <Link href="/admin"
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#f97316] text-white text-sm font-bold shadow-[0_3px_0_#c2410c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#c2410c] active:translate-y-[2px]">
                        <i className="fas fa-shield-alt text-xs" /> Admin Panel
                      </Link>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="px-4 py-3">
                    <button onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-red-500 text-sm font-bold shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-[0_1px_0_#d1d5db] active:translate-y-[1px]">
                      <i className="fas fa-sign-out-alt text-xs" /> ออกจากระบบ
                    </button>
                  </div>
                </>
              )}

              {/* Login form */}
              {!loading && !user && <GreenLogin />}
            </div>

            {/* ── Top Donate ── */}
            {ranking.length > 0 && (
              <div className={CARD}>
                {/* Header */}
                <div className={`relative px-5 py-4 ${DIV} flex items-center gap-3`}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400" />
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-trophy text-amber-500 text-sm" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-black text-sm leading-none">TOPUP RANK</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">ผู้สนับสนุนสูงสุด</p>
                  </div>
                </div>

                {/* List */}
                <div className="px-3 py-3 space-y-1">
                  {ranking.slice(0, 10).map((r, i) => (
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                      i === 0 ? 'bg-amber-50 border border-amber-200' :
                      i === 1 ? 'hover:bg-gray-50' :
                      i === 2 ? 'hover:bg-gray-50' :
                      'hover:bg-gray-50'
                    }`}>
                      {/* Rank */}
                      <div className="w-6 flex items-center justify-center flex-shrink-0">
                        {i === 0 ? <i className="fas fa-crown text-amber-500 text-sm" /> :
                         i === 1 ? <i className="fas fa-medal text-slate-400 text-sm" /> :
                         i === 2 ? <i className="fas fa-medal text-amber-600 text-sm" /> :
                         <span className="text-gray-300 text-xs font-black">{i + 1}</span>}
                      </div>
                      {/* Avatar */}
                      <img
                        src={`https://mc-heads.net/avatar/${r.username}/28`}
                        alt={r.username}
                        className="w-7 h-7 rounded-lg flex-shrink-0 border border-green-100"
                        style={{ imageRendering: 'pixelated' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/28'; }}
                      />
                      {/* Name */}
                      <span className={`text-xs font-bold truncate flex-1 ${i === 0 ? 'text-amber-700' : 'text-gray-700'}`}>{r.username}</span>
                      {/* Amount */}
                      <div className="flex items-center gap-1 flex-shrink-0 bg-green-50 border border-green-200 rounded-lg px-2 py-0.5">
                        <i className="fas fa-coins text-amber-500 text-[9px]" />
                        <span className="text-green-700 text-[11px] font-black tabular-nums">{r.total_topup.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Daily TOPUP ── */}
            <div className={CARD}>
              {/* Header */}
              <div className={`relative px-5 py-4 ${DIV} flex items-center gap-3`}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400" />
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-calendar-day text-blue-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-black text-sm leading-none">DAILY TOPUP</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">เติมเงินล่าสุดวันนี้</p>
                </div>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
              </div>

              {/* List */}
              <div className="px-3 py-3 space-y-1">
                {dailyTopup.length === 0 ? (
                  <p className="text-gray-300 text-xs text-center py-4">ยังไม่มีการเติมเงินวันนี้</p>
                ) : dailyTopup.map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    {/* Rank number */}
                    <div className="w-5 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-300 text-xs font-black">{i + 1}</span>
                    </div>
                    {/* Avatar */}
                    <img
                      src={`https://mc-heads.net/avatar/${r.username}/28`}
                      alt={r.username}
                      className="w-7 h-7 rounded-lg flex-shrink-0 border border-blue-100"
                      style={{ imageRendering: 'pixelated' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/28'; }}
                    />
                    {/* Name */}
                    <span className="text-xs font-bold truncate flex-1 text-gray-700">{r.username}</span>
                    {/* Amount */}
                    <div className="flex items-center gap-1 flex-shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5">
                      <i className="fas fa-coins text-blue-400 text-[9px]" />
                      <span className="text-blue-700 text-[11px] font-black tabular-nums">{Number(r.total_topup).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 order-2">
          {children}
        </main>

      </div>

      <Footer />

      {/* ── Floating Social Icons ───────────────────────────────── */}
      {(discordUrl || facebookUrl) && (
        <div className="fixed bottom-6 right-5 z-50 flex flex-col gap-3">
          {discordUrl && (
            <a href={discordUrl} target="_blank" rel="noopener noreferrer"
              className="w-16 h-16 rounded-full bg-[#5865F2] flex items-center justify-center shadow-[0_5px_0_#3c45a5] hover:shadow-[0_2px_0_#3c45a5] hover:translate-y-[3px] active:shadow-none active:translate-y-[5px] transition-all"
              title="Discord">
              <i className="fab fa-discord text-white text-2xl" />
            </a>
          )}
          {facebookUrl && (
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer"
              className="w-16 h-16 rounded-full bg-[#1877F2] flex items-center justify-center shadow-[0_5px_0_#1056b3] hover:shadow-[0_2px_0_#1056b3] hover:translate-y-[3px] active:shadow-none active:translate-y-[5px] transition-all"
              title="Facebook">
              <i className="fab fa-facebook text-white text-2xl" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
