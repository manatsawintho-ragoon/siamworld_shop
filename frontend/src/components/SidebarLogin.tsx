'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function SidebarLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuth();
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!username || !password) {
      setLocalError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    try {
      await login(username, password);
    } catch (err: any) {
      setLocalError(err?.message || 'เข้าสู่ระบบล้มเหลว');
    }
  };

  return (
    <div className="text-center animate-fade-in relative z-10 w-full mb-3">
      {/* Visual icon for Member login */}
      <div className="w-16 h-16 mx-auto bg-black/40 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-105 border border-white/5 shadow-inner">
        <i className="fas fa-lock text-3xl text-primary drop-shadow-md" aria-hidden="true"></i>
      </div>
      <h3 className="font-black text-white text-lg tracking-widest uppercase mb-1 drop-shadow-sm">Member Login</h3>
      <p className="text-xs text-foreground-subtle mb-4">เข้าสู่ระบบเพื่อจัดการบัญชีและไอเทมชอป</p>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative group">
          <i className="fas fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors" aria-hidden="true"></i>
          <input
            type="text"
            placeholder="ชื่อผู้ใช้งาน (Username)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input !pl-10 text-xs py-3 font-semibold tracking-wide bg-black/40 border-white/10"
            autoComplete="username"
            disabled={loading}
          />
        </div>
        <div className="relative group">
          <i className="fas fa-key absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-subtle text-xs group-focus-within:text-primary transition-colors" aria-hidden="true"></i>
          <input
            type="password"
            placeholder="รหัสผ่าน (Password)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input !pl-10 text-xs py-3 font-semibold tracking-wide bg-black/40 border-white/10"
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        {localError && (
          <div className="bg-error/10 border border-error/30 text-error-foreground text-[11px] px-3 py-2 rounded-md text-left flex items-start gap-1.5 animate-fade-in">
            <i className="fas fa-exclamation-circle flex-shrink-0 mt-0.5" aria-hidden="true"></i>
            <span>{localError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-3 text-xs tracking-wider uppercase shadow-lg group-hover:opacity-100 opacity-90 transition-opacity"
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          ) : (
            <><i className="fas fa-sign-in-alt mb-[1px] mr-1" aria-hidden="true"></i> เข้าสู่ระบบ</>
          )}
        </button>
      </form>
    </div>
  );
}
