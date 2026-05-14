'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [animate, setAnimate] = useState(false);

  const { user } = useAuth();

  // Close modal if user logs in (e.g. from Social Login callback)
  useEffect(() => {
    if (user && isOpen) {
      onClose();
    }
  }, [user, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setTimeout(() => setAnimate(true), 10);
      setTab(initialTab);
      setError('');
      document.body.style.overflow = 'hidden';
    } else {
      setAnimate(false);
      const timer = setTimeout(() => {
        setMounted(false);
        document.body.style.overflow = 'unset';
      }, 300);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, initialTab]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onClose();
      router.push('/dashboard');
    } catch (err: any) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        email, password, displayName, phone: phone || undefined,
      });
      // Cookie set by server via Set-Cookie header — no localStorage needed
      onClose();
      window.location.href = '/order';
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
    } finally { setLoading(false); }
  };

  if (!mounted || !isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[99999] overflow-y-auto py-6 px-4 sm:py-10 flex items-center justify-center ${animate ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className={`fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${animate ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Modal Box */}
      <div 
        className={`relative w-full ${tab === 'register' ? 'max-w-2xl' : 'max-w-md'} bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 overflow-hidden transition-all duration-500 transform ${animate ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
      >
        <div className="p-8 sm:p-10">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-slate-800 border border-amber-100 dark:border-slate-700 flex items-center justify-center text-amber-500 mb-4 shadow-sm">
              <i className="fas fa-gem text-2xl" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-slate-50 uppercase tracking-tight">
              {tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </h2>
            <p className="text-gray-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Siamsite Store Manager</p>
          </div>

          {/* Animated Tabs */}
          <div className="relative flex p-1 bg-gray-50 dark:bg-slate-800 rounded-2xl mb-8 border-2 border-gray-200 dark:border-slate-700">
            {/* Sliding Background */}
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-2px)] bg-amber-500 rounded-[0.85rem] shadow-[0_3px_0_rgb(180,83,9)] border border-amber-600 transition-all duration-300 ease-out ${tab === 'login' ? 'left-1' : 'left-[calc(50%+1px)]'}`}
            />
            <button 
              onClick={() => setTab('login')} 
              className={`relative z-10 flex-1 py-3 font-black text-xs transition-all tracking-widest ${tab === 'login' ? 'text-white drop-shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
            >
              เข้าสู่ระบบ
            </button>
            <button 
              onClick={() => setTab('register')} 
              className={`relative z-10 flex-1 py-3 font-black text-xs transition-all tracking-widest ${tab === 'register' ? 'text-white drop-shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-6">
            {tab === 'register' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div>
                    <label className="label-minimal">ชื่อที่แสดงในระบบ</label>
                    <input className="input-minimal" placeholder="ชื่อ-นามสกุล หรือชื่อร้าน" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label-minimal">เบอร์โทรศัพท์</label>
                    <input type="tel" className="input-minimal" placeholder="08X-XXX-XXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label-minimal">อีเมลใช้งาน</label>
                    <input type="email" className="input-minimal" placeholder="อีเมลของคุณ" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="label-minimal">รหัสผ่าน</label>
                    <input type="password" className="input-minimal" placeholder="กำหนดรหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label-minimal">ยืนยันรหัสผ่านอีกครั้ง</label>
                    <input type="password" className="input-minimal" placeholder="ยืนยันรหัสผ่าน" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed uppercase tracking-wide">
                      <i className="fas fa-shield-alt mr-1.5" /> ระบบรักษาความปลอดภัย: รหัสผ่านควรมีความยาวอย่างน้อย 8 ตัวอักษร
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="label-minimal">อีเมลผู้ใช้งาน</label>
                  <input type="email" className="input-minimal" placeholder="อีเมลของคุณ" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="label-minimal">รหัสผ่าน</label>
                  <input type="password" className="input-minimal" placeholder="ป้อนรหัสผ่านของคุณ" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl border border-red-100 flex items-center gap-3 animate-shake">
                <i className="fas fa-exclamation-circle text-sm" /> {error}
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full h-[60px] bg-amber-500 hover:bg-amber-600 text-white rounded-[1.25rem] font-black text-[15px] transition-all shadow-[0_5px_0_rgb(180,83,9)] hover:shadow-[0_3px_0_rgb(180,83,9)] hover:translate-y-[2px] active:shadow-none active:translate-y-[5px] uppercase tracking-[0.15em] flex items-center justify-center gap-3"
              >
                {loading ? (
                  <i className="fas fa-circle-notch fa-spin" />
                ) : (
                  <>
                    <i className={`fas ${tab === 'login' ? 'fa-right-to-bracket' : 'fa-user-plus'}`} />
                    {tab === 'login' ? 'เข้าสู่ระบบเลย' : 'สร้างร้านค้า'}
                  </>
                )}
              </button>
            </div>
          </form>

          {tab === 'login' && (
            <>
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-slate-800"></div></div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-white dark:bg-slate-900 px-4 text-gray-400">หรือเข้าด้วย Social</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const backendUrl = 'https://api-panel.siamsite.shop';
                    window.location.href = `${backendUrl}/api/auth/google`;
                  }}
                  className="flex items-center justify-center gap-3 h-[54px] border-2 border-gray-200 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all font-bold text-xs text-gray-700 dark:text-slate-300 active:scale-95 bg-white dark:bg-transparent shadow-sm"
                >
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                  GOOGLE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const backendUrl = 'https://api-panel.siamsite.shop';
                    window.location.href = `${backendUrl}/api/auth/facebook`;
                  }}
                  className="flex items-center justify-center gap-3 h-[54px] border-2 border-gray-200 dark:border-slate-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all font-bold text-xs text-gray-700 dark:text-slate-300 active:scale-95 bg-white dark:bg-transparent shadow-sm"
                >
                  <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="w-5 h-5" />
                  FACEBOOK
                </button>
              </div>
            </>
          )}

          <div className="mt-8 text-center">
            <button 
              onClick={() => setTab(tab === 'login' ? 'register' : 'login')} 
              className="text-xs font-bold text-gray-500 hover:text-amber-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
            >
              <span>{tab === 'login' ? "ยังไม่มีบัญชีผู้ใช้งาน?" : "มีบัญชีอยู่แล้ว?"}</span>
              <span className="text-amber-600 underline underline-offset-4">{tab === 'login' ? "สมัครสมาชิกที่นี่" : "เข้าสู่ระบบตรงนี้"}</span>
            </button>
          </div>
        </div>
        
        {/* Red Square Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all shadow-[0_4px_12px_rgba(239,68,68,0.3)] active:scale-90"
        >
          <i className="fas fa-times text-sm" />
        </button>
      </div>

      <style jsx>{`
        .input-minimal {
          width: 100%;
          background: transparent;
          border: 1.5px solid #e5e7eb;
          padding: 0.875rem 1.25rem;
          border-radius: 1.25rem;
          font-weight: 700;
          font-size: 0.9375rem;
          outline: none;
          transition: all 0.2s;
          color: #111827;
        }
        :global(.dark) .input-minimal {
          border-color: #334155;
          color: #f8fafc;
        }
        .input-minimal:focus {
          border-color: #f59e0b;
        }
        .input-minimal::placeholder {
          color: #d1d5db;
          font-weight: 500;
        }
        :global(.dark) .input-minimal::placeholder {
          color: #475569;
        }
        .label-minimal {
          display: block;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
          margin-left: 0.5rem;
        }
        :global(.dark) .label-minimal {
          color: #94a3b8;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
