'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, setToken } from '@/lib/api';

export default function SidebarLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const { login, loading, refresh } = useAuth();
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setUsername(''); setPassword(''); setConfirmPassword(''); setEmail(''); setLocalError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username || !password) { setLocalError('กรุณากรอกข้อมูลให้ครบ'); return; }
    try {
      await login(username, password);
    } catch (err: any) {
      setLocalError(err?.message || 'เข้าสู่ระบบล้มเหลว');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username || !password || !confirmPassword || !email) { setLocalError('กรุณากรอกข้อมูลให้ครบ'); return; }
    if (password !== confirmPassword) { setLocalError('รหัสผ่านไม่ตรงกัน'); return; }
    if (username.length < 3) { setLocalError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setLocalError('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, A-Z, 0-9, _ เท่านั้น'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLocalError('รูปแบบอีเมลล์ไม่ถูกต้อง'); return; }
    setSubmitting(true);
    try {
      const data = await api('/auth/register', { method: 'POST', body: { username, password, email } });
      setToken(data.token as string);
      await refresh();
    } catch (err: any) {
      setLocalError(err?.message || 'สมัครสมาชิกล้มเหลว');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loading || submitting;

  return (
    <div className="text-center animate-fade-in relative z-10 w-full mb-3">
      {/* Tab switcher */}
      <div className="flex rounded-lg overflow-hidden border border-green-200 mb-4">
        <button
          onClick={() => { setMode('login'); resetForm(); }}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'login' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:text-primary'}`}
        >
          <i className="fas fa-sign-in-alt mr-1"></i> เข้าสู่ระบบ
        </button>
        <button
          onClick={() => { setMode('register'); resetForm(); }}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'register' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:text-primary'}`}
        >
          <i className="fas fa-user-plus mr-1"></i> สมัครสมาชิก
        </button>
      </div>

      <div className="w-14 h-14 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-3 border border-green-200 shadow-inner">
        <i className={`text-2xl text-primary drop-shadow-md fas ${mode === 'login' ? 'fa-lock' : 'fa-user-plus'}`}></i>
      </div>

      <h3 className="font-black text-gray-900 text-base tracking-widest uppercase mb-1 drop-shadow-sm">
        {mode === 'login' ? 'Member Login' : 'Register'}
      </h3>
      <p className="text-[11px] text-foreground-subtle mb-4">
        {mode === 'login' ? 'เข้าสู่ระบบเพื่อจัดการบัญชีและไอเท็มชอป' : 'สมัครสมาชิกใหม่ด้วย Authme'}
      </p>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="relative group">
            <i className="fas fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors"></i>
            <input type="text" placeholder="ชื่อผู้ใช้งาน" value={username} onChange={e => setUsername(e.target.value)}
              className="input !pl-10 text-xs py-3 font-semibold " autoComplete="username" disabled={isLoading} />
          </div>
          <div className="relative group">
            <i className="fas fa-key absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors"></i>
            <input type="password" placeholder="รหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)}
              className="input !pl-10 text-xs py-3 font-semibold " autoComplete="current-password" disabled={isLoading} />
          </div>
          {localError && (
            <div className="bg-error/10 border border-error/30 text-error-foreground text-[11px] px-3 py-2 rounded-md text-left flex items-start gap-1.5 animate-fade-in">
              <i className="fas fa-exclamation-circle flex-shrink-0 mt-0.5"></i>
              <span>{localError}</span>
            </div>
          )}
          <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3 text-xs tracking-wider uppercase shadow-lg">
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-sign-in-alt mr-1"></i> เข้าสู่ระบบ</>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="relative group">
            <i className="fas fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors"></i>
            <input type="text" placeholder="ชื่อผู้ใช้ (ภาษาอังกฤษ)" value={username} onChange={e => setUsername(e.target.value)}
              className="input !pl-10 text-xs py-3 font-semibold " autoComplete="username" disabled={isLoading} />
          </div>
          <div className="relative group">
            <i className="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors"></i>
            <input type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" value={password} onChange={e => setPassword(e.target.value)}
              className="input !pl-10 text-xs py-3 font-semibold " autoComplete="new-password" disabled={isLoading} />
          </div>
          <div className="relative group">
            <i className="fas fa-check-circle absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors"></i>
            <input type="password" placeholder="ยืนยันรหัสผ่าน" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="input !pl-10 text-xs py-3 font-semibold " autoComplete="new-password" disabled={isLoading} />
          </div>
          <div className="relative group">
            <i className="fas fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors"></i>
            <input type="email" placeholder="อีเมลล์ (สำหรับ Reset Password)" value={email} onChange={e => setEmail(e.target.value)}
              className="input !pl-10 text-xs py-3 font-semibold " autoComplete="email" disabled={isLoading} />
          </div>
          {localError && (
            <div className="bg-error/10 border border-error/30 text-error-foreground text-[11px] px-3 py-2 rounded-md text-left flex items-start gap-1.5 animate-fade-in">
              <i className="fas fa-exclamation-circle flex-shrink-0 mt-0.5"></i>
              <span>{localError}</span>
            </div>
          )}
          <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3 text-xs tracking-wider uppercase shadow-lg">
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-user-plus mr-1"></i> สมัครสมาชิก</>}
          </button>
          <p className="text-[10px] text-foreground-subtle">
            การสมัครจะสร้าง Authme account ในเซิร์ฟเวอร์ Minecraft ด้วย
          </p>
        </form>
      )}
    </div>
  );
}
