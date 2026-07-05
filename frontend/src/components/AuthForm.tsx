'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAdminAlert } from '@/components/AdminAlert';
import { api, setToken } from '@/lib/api';
import { Loader2, LogIn, UserPlus } from 'lucide-react';

/**
 * Login / Register form. Used both in the desktop account sidebar and inside
 * the mobile bottom-sheet auth modal. `onSuccess` fires after a successful
 * login or registration (the modal uses it to close itself).
 */
export default function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
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
      onSuccess?.();
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
      onSuccess?.();
    } catch (err: any) {
      showAlert({ type: 'error', title: 'สมัครสมาชิกล้มเหลว', message: err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full bg-surface-hover border border-border focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none text-foreground placeholder:text-foreground-subtle text-base sm:text-sm rounded-xl px-3.5 py-3 transition-colors';

  return (
    <div>
      {/* Tabs */}
      <div className="flex bg-surface-hover rounded-xl p-1 mb-4">
        {(['login', 'register'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); reset(); }} type="button"
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              mode === m ? 'bg-primary text-primary-foreground shadow-[0_2px_0_rgb(var(--color-primary-hover))]' : 'text-foreground-subtle hover:text-foreground-muted'
            }`}>
            {m === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        ))}
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-2.5">
          <input type="text" autoComplete="username" placeholder="ชื่อผู้ใช้ในเกม (Minecraft)" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" autoComplete="current-password" placeholder="รหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} disabled={busy} />
          <button type="submit" disabled={busy}
            className="w-full py-3.5 bg-primary hover:brightness-110 text-primary-foreground text-sm font-black rounded-xl transition-all shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
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
          <input type="text" autoComplete="username" placeholder="ชื่อผู้ใช้ (ภาษาอังกฤษ, a-z, 0-9, _)" value={username} onChange={e => setUsername(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" autoComplete="new-password" placeholder="รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} disabled={busy} />
          <input type="password" autoComplete="new-password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} disabled={busy} />
          <input type="email" autoComplete="email" placeholder="อีเมล (สำหรับ Reset Password)" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} disabled={busy} />
          <button type="submit" disabled={busy}
            className="w-full py-3.5 bg-primary hover:brightness-110 text-primary-foreground text-sm font-black rounded-xl transition-all shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <><UserPlus className="w-4 h-4" strokeWidth={2.5} />สมัครสมาชิก</>}
          </button>
          <p className="text-foreground-subtle text-[10px] text-center leading-relaxed">การสมัครจะสร้าง Authme account ในเซิร์ฟเวอร์ Minecraft ด้วย</p>
        </form>
      )}
    </div>
  );
}
