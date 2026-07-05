'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { api, setToken } from '@/lib/api';
import {
  Loader2, LogIn, UserPlus, Shield, User, UserCircle, Wallet, Ticket,
  PackageOpen, LogOut, Trophy, Crown, Medal, Coins, CalendarDays,
} from 'lucide-react';

interface RankEntry  { username: string; total_topup: number; }
interface DailyEntry { username: string; total_topup: number; last_topup: string; }

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.45 3a13.5 13.5 0 0 0-.62 1.28 18.27 18.27 0 0 0-5.66 0A13.5 13.5 0 0 0 8.55 3a19.74 19.74 0 0 0-4.87 1.37C.56 9.05-.3 13.6.13 18.1a19.9 19.9 0 0 0 6.06 3.07c.49-.67.92-1.38 1.29-2.13-.71-.27-1.39-.6-2.03-.99.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.1 0c.16.14.33.27.5.4-.64.39-1.33.72-2.04.99.37.75.8 1.46 1.3 2.13a19.86 19.86 0 0 0 6.06-3.07c.5-5.2-.85-9.72-3.65-13.73ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42s.95-2.42 2.15-2.42c1.22 0 2.19 1.09 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

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
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
      showAlert({ type: 'warning', title: 'ชื่อผู้ใช้ไม่ถูกต้อง', message: 'ใช้ได้เฉพาะ a-z, A-Z, 0-9, _ และ . (สำหรับผู้เล่น Bedrock/Geyser) เท่านั้น' }); return;
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

  const inputCls = 'w-full bg-surface-hover border border-border focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none text-foreground placeholder:text-foreground-subtle text-sm rounded-xl px-3.5 py-3 transition-colors';

  return (
    <div className="px-4 pb-4">
      {/* Tabs */}
      <div className="flex bg-surface-hover rounded-xl p-1 mb-4">
        {(['login', 'register'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); reset(); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === m ? 'bg-primary text-primary-foreground shadow-[0_2px_0_rgb(var(--color-primary-hover))]' : 'text-foreground-subtle hover:text-foreground-muted'
            }`}>
            {m === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        ))}
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-2.5">
          <input type="text" placeholder="ชื่อผู้ใช้ในเกม (Minecraft)" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" placeholder="รหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} disabled={busy} />
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground text-sm font-black rounded-xl transition-all shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <><LogIn className="w-4 h-4" strokeWidth={2.5} />เข้าสู่ระบบ</>}
          </button>
          <div className="text-center pt-1">
            <Link href="/forgot-password" className="text-[11px] font-bold text-foreground-subtle hover:text-primary transition-colors">
              ลืมรหัสผ่าน?
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-2.5">
          <input type="text" placeholder="ชื่อผู้ใช้ (ภาษาอังกฤษ, a-z, 0-9, _)" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} disabled={busy} />
          <input type="email" placeholder="อีเมล (สำหรับ Reset Password)" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} disabled={busy} />
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground text-sm font-black rounded-xl transition-all shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <><UserPlus className="w-4 h-4" strokeWidth={2.5} />สมัครสมาชิก</>}
          </button>
          <p className="text-foreground-subtle text-[10px] text-center leading-relaxed">การสมัครจะสร้าง Authme account ในเซิร์ฟเวอร์ Minecraft ด้วย</p>
        </form>
      )}
    </div>
  );
}

/* ── Main Layout ───────────────────────────────────────────── */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading, isAdmin, sessionMessage, clearSessionMessage } = useAuth();
  const { settings } = useSettings();
  const { alert: showAlert } = useAdminAlert();

  // Show session message as an alert whenever it appears (kicked or expired)
  useEffect(() => {
    if (sessionMessage) {
      showAlert({ type: 'warning', title: 'เซสชันสิ้นสุด', message: sessionMessage });
      clearSessionMessage();
    }
  }, [sessionMessage, showAlert, clearSessionMessage]);

  const handleLogout = () => {
    logout();
    showAlert({ type: 'success', title: 'ออกจากระบบแล้ว', message: 'คุณได้ออกจากระบบเรียบร้อยแล้ว' });
  };
  const [ranking,    setRanking]    = useState<RankEntry[]>([]);
  const [dailyTopup, setDailyTopup] = useState<DailyEntry[]>([]);
  const discordUrl  = settings.discord_invite || '';
  const facebookUrl = settings.facebook_url   || '';
  // Visibility toggles (default visible). Skip the network calls entirely when
  // the widget is hidden so we don't waste requests on data we won't render.
  const showTopupRank  = (settings.show_topup_rank_widget  ?? '1') === '1';
  const showTopupDaily = (settings.show_topup_daily_widget ?? '1') === '1';

  useEffect(() => {
    if (showTopupRank)  api('/public/topup-ranking').then(d => setRanking((d.ranking  as RankEntry[])  || [])).catch(() => {});
    if (showTopupDaily) api('/public/daily-topup').then(d  => setDailyTopup((d.daily  as DailyEntry[]) || [])).catch(() => {});
  }, [showTopupRank, showTopupDaily]);

  const CARD = 'theme-sidebar-card';
  const DIV  = 'border-b border-border-muted';

  return (
    <div className="flex flex-col min-h-screen frontend-page" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <Navbar />

      <div className="flex-1 max-w-[1536px] mx-auto w-full px-4 sm:px-6 pt-6 pb-24 md:pb-6 flex flex-col lg:flex-row gap-6">

        {/* ── Sidebar ── */}
        <aside className="w-full lg:w-[280px] flex-shrink-0 order-last lg:order-first">
          <div className="lg:sticky lg:top-4 space-y-5">

            {/* ── Member Card ── */}
            <div className={CARD}>

              {/* Header */}
              <div className={`relative px-6 py-5 ${DIV} bg-gradient-to-b from-surface-hover/40 to-surface`}>
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(to right, rgb(var(--color-primary-light)), rgb(var(--color-primary)), rgb(var(--color-primary-light)))' }} />

                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" strokeWidth={2.5} />
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-2xl border-2 border-primary/20 bg-surface p-0.5 overflow-hidden shadow-sm">
                        <img
                          src={`https://mc-heads.net/avatar/${user.username}/64`}
                          alt={user.username}
                          className="w-full h-full rounded-xl"
                          style={{ imageRendering: 'pixelated' }}
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/64'; }}
                        />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full border-2 border-surface shadow-sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-black text-lg truncate leading-tight tracking-tight">{user.username}</p>
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black bg-orange-500 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                          <Shield className="w-2 h-2" strokeWidth={2.5} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                          <User className="w-2 h-2" strokeWidth={2.5} /> Member
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-7 h-7 text-primary" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-foreground font-black text-sm leading-tight">ระบบสมาชิก</p>
                      <p className="text-foreground-subtle text-[11px] mt-0.5 font-medium">เข้าสู่ระบบเพื่อใช้งาน</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Logged-in content */}
              {!loading && user && (
                <>
                  {/* Wallet — Highlight Card */}
                  <div className="px-5 py-4 border-b border-border-muted">
                    <div className="relative theme-wallet-card rounded-2xl p-5 text-white shadow-[0_10px_20px_-5px_rgba(0,0,0,0.25)] border border-white/10 overflow-hidden">
                      <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white/75 text-[10px] font-black uppercase tracking-[0.2em] drop-shadow-sm">ยอดเงินคงเหลือ</p>
                        <Wallet className="w-4 h-4 text-white/50" strokeWidth={2} />
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-white font-black text-3xl tabular-nums drop-shadow-md">
                          {user.wallet_balance?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-white/80 text-lg font-bold">฿</span>
                      </div>
                    </div>
                  </div>

                  {/* Redeem Code CTA */}
                  <div className="px-5 py-3 border-b border-border-muted">
                    <Link href="/redeem"
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold shadow-[0_4px_0_rgb(217,119,6)] hover:brightness-110 transition-all active:shadow-none active:translate-y-[4px]">
                      <Ticket className="w-3.5 h-3.5" strokeWidth={2.25} /> แลกโค้ดรางวัล
                    </Link>
                  </div>

                  {/* Quick actions — Profile + Inventory */}
                  <div className="px-5 py-4 border-b border-border-muted grid grid-cols-2 gap-3">
                    <Link href="/profile"
                      className="flex flex-col items-center gap-2 py-4 rounded-xl bg-surface border border-border text-foreground-muted hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-none">
                      <UserCircle className="w-5 h-5" strokeWidth={2} />
                      <span className="text-[11px] font-bold tracking-wide">โปรไฟล์</span>
                    </Link>
                    <Link href="/inventory"
                      className="flex flex-col items-center gap-2 py-4 rounded-xl bg-surface border border-border text-foreground-muted hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-none">
                      <PackageOpen className="w-5 h-5" strokeWidth={2} />
                      <span className="text-[11px] font-bold tracking-wide">คลังของ</span>
                    </Link>
                  </div>

                  {/* Admin */}
                  {isAdmin && (
                    <div className="px-5 py-3 border-b border-border-muted">
                      <Link href="/admin"
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-all active:translate-y-[2px]">
                        <Shield className="w-3.5 h-3.5 text-orange-400" strokeWidth={2.25} /> Admin Dashboard
                      </Link>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="px-4 py-3">
                    <button onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface border border-border text-error hover:bg-error/10 text-sm font-bold shadow-sm transition-all active:shadow-none active:translate-y-[1px]">
                      <LogOut className="w-3.5 h-3.5" strokeWidth={2.25} /> ออกจากระบบ
                    </button>
                  </div>
                </>
              )}

              {/* Login form */}
              {!loading && !user && <GreenLogin />}
            </div>

            {/* ── Top Donate ── */}
            {showTopupRank && ranking.length > 0 && (
              <div className={CARD}>
                {/* Header */}
                <div className={`relative px-5 py-4 ${DIV} flex items-center gap-3`}>
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(to right, rgb(var(--color-primary-light)), rgb(var(--color-primary)), rgb(var(--color-primary-light)))' }} />
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-4 h-4 text-amber-500" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-foreground font-black text-sm leading-none">TOPUP RANK</p>
                    <p className="text-foreground-subtle text-[10px] mt-0.5">ผู้สนับสนุนสูงสุด</p>
                  </div>
                </div>

                {/* List */}
                <div className="px-3 py-3 space-y-1">
                  {ranking.slice(0, 10).map((r, i) => (
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                      i === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-surface-hover'
                    }`}>
                      {/* Rank */}
                      <div className="w-6 flex items-center justify-center flex-shrink-0">
                        {i === 0 ? <Crown className="w-4 h-4 text-amber-500" strokeWidth={2.25} /> :
                         i === 1 ? <Medal className="w-4 h-4 text-slate-400" strokeWidth={2.25} /> :
                         i === 2 ? <Medal className="w-4 h-4 text-amber-600" strokeWidth={2.25} /> :
                         <span className="text-foreground-subtle text-xs font-black">{i + 1}</span>}
                      </div>
                      {/* Avatar */}
                      <img
                        src={`https://mc-heads.net/avatar/${r.username}/28`}
                        alt={r.username}
                        className="w-7 h-7 rounded-lg flex-shrink-0 border border-primary/20"
                        style={{ imageRendering: 'pixelated' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/28'; }}
                      />
                      {/* Name */}
                      <span className={`text-xs font-bold truncate flex-1 ${i === 0 ? 'text-amber-600' : 'text-foreground'}`}>{r.username}</span>
                      {/* Amount */}
                      <div className="flex items-center gap-1 flex-shrink-0 rounded-lg px-2 py-0.5" style={{ backgroundColor: 'rgb(var(--color-primary) / 0.1)', border: '1px solid rgb(var(--color-border))' }}>
                        <Coins className="w-2.5 h-2.5 text-amber-500" strokeWidth={2.25} />
                        <span className="text-[11px] font-black tabular-nums" style={{ color: 'rgb(var(--color-primary))' }}>{r.total_topup.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Daily TOPUP ── */}
            {showTopupDaily && <div className={CARD}>
              {/* Header */}
              <div className={`relative px-5 py-4 ${DIV} flex items-center gap-3`}>
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(to right, rgb(var(--color-primary-light)), rgb(var(--color-primary)), rgb(var(--color-primary-light)))' }} />
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgb(var(--color-primary) / 0.1)', border: '1px solid rgb(var(--color-border))' }}>
                  <CalendarDays className="w-4 h-4" strokeWidth={2.25} style={{ color: 'rgb(var(--color-primary))' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-black text-sm leading-none">DAILY TOPUP</p>
                  <p className="text-foreground-subtle text-[10px] mt-0.5">เติมเงินล่าสุดวันนี้</p>
                </div>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'rgb(var(--color-primary-light))' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'rgb(var(--color-primary))' }} />
                </span>
              </div>

              {/* List */}
              <div className="px-3 py-3 space-y-1">
                {dailyTopup.length === 0 ? (
                  <p className="text-foreground-subtle text-xs text-center py-4">ยังไม่มีการเติมเงินวันนี้</p>
                ) : dailyTopup.map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors">
                    {/* Rank number */}
                    <div className="w-5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black" style={{ color: 'rgb(var(--color-primary-light))' }}>{i + 1}</span>
                    </div>
                    {/* Avatar */}
                    <img
                      src={`https://mc-heads.net/avatar/${r.username}/28`}
                      alt={r.username}
                      className="w-7 h-7 rounded-lg flex-shrink-0"
                      style={{ imageRendering: 'pixelated', border: '1px solid rgb(var(--color-border-muted))' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/28'; }}
                    />
                    {/* Name */}
                    <span className="text-xs font-bold truncate flex-1 text-foreground">{r.username}</span>
                    {/* Amount */}
                    <div className="flex items-center gap-1 flex-shrink-0 rounded-lg px-2 py-0.5" style={{ backgroundColor: 'rgb(var(--color-primary) / 0.1)', border: '1px solid rgb(var(--color-border))' }}>
                      <Coins className="w-2.5 h-2.5" strokeWidth={2.25} style={{ color: 'rgb(var(--color-primary))' }} />
                      <span className="text-[11px] font-black tabular-nums" style={{ color: 'rgb(var(--color-primary-hover))' }}>{Number(r.total_topup).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>}

          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 order-first lg:order-last">
          <PageTransition>
            {children}
          </PageTransition>
        </main>

      </div>

      <Footer />

      {/* ── Floating Social Icons ───────────────────────────────── */}
      {(discordUrl || facebookUrl) && (
        <div className="fixed bottom-24 md:bottom-6 right-3 md:right-5 z-40 flex flex-col gap-2 md:gap-3">
          {discordUrl && (
            <a href={discordUrl} target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#5865F2] flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all"
              title="Discord">
              <DiscordIcon className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </a>
          )}
          {facebookUrl && (
            <a href={facebookUrl} target="_blank" rel="noopener noreferrer"
              className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#1877F2] flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all"
              title="Facebook">
              <FacebookIcon className="w-6 h-6 md:w-7 md:h-7 text-white" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
