'use client';
import { useState, FormEvent, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import TurnstileWidget from './TurnstileWidget';
import { LogIn, UserPlus, X, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

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

  // ── Cloudflare Turnstile (CAPTCHA) state ────────────────────────────────
  const [captchaConfig, setCaptchaConfig] = useState<{ enabled: boolean; siteKey: string }>({ enabled: false, siteKey: '' });
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const { user } = useAuth();

  // Close modal if user logs in
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
      setCaptchaToken('');
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

  useEffect(() => {
    if (!isOpen) return;
    api.get('/api/auth/config')
      .then(r => setCaptchaConfig(r.data?.captcha || { enabled: false, siteKey: '' }))
      .catch(() => setCaptchaConfig({ enabled: false, siteKey: '' }));
  }, [isOpen]);

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(''), []);

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaResetKey(k => k + 1);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (captchaConfig.enabled && !captchaToken) {
      setError('กรุณายืนยันว่าคุณไม่ใช่บอท');
      return;
    }
    setLoading(true);
    try {
      await login(email, password, captchaToken || undefined);
      onClose();
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(msg || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      resetCaptcha();
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (captchaConfig.enabled && !captchaToken) {
      setError('กรุณายืนยันว่าคุณไม่ใช่บอท');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        email, password, displayName, phone: phone || undefined,
        captchaToken: captchaToken || undefined,
      });
      onClose();
      window.location.href = '/order';
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      resetCaptcha();
    } finally { setLoading(false); }
  };

  if (!mounted || !isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[99999] overflow-y-auto py-6 px-4 sm:py-10 flex items-center justify-center ${animate ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className={`fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${animate ? 'opacity-100' : 'opacity-0'}`} 
      />

      {/* Modal Box */}
      <div 
        className={`relative w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-2xl overflow-hidden transition-all duration-500 transform ${animate ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
      >
        <div className="p-6 sm:p-8">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/images/logosiamsite-h256.png"
              alt="SIAMSITE logo"
              width={160}
              height={100}
              priority
              className="h-20 w-auto object-contain mb-3 drop-shadow-sm"
            />
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-[0.15em] mt-1">Siamsite Store Manager</p>
          </div>

          {/* Animated Tabs */}
          <div className="relative flex p-1 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl mb-6 shadow-inner border border-slate-200/50 dark:border-slate-700/50">
            {/* Sliding Background */}
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-amber-500 rounded-lg shadow-sm transition-all duration-300 ease-out ${tab === 'login' ? 'left-1' : 'left-[calc(50%+2px)]'}`}
            />
            <button 
              onClick={() => setTab('login')} 
              className={`relative z-10 flex-1 py-2.5 font-bold text-xs transition-all ${tab === 'login' ? 'text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              เข้าสู่ระบบ
            </button>
            <button 
              onClick={() => setTab('register')} 
              className={`relative z-10 flex-1 py-2.5 font-bold text-xs transition-all ${tab === 'register' ? 'text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {tab === 'register' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-minimal">ชื่อที่แสดง</label>
                    <input className="input-minimal" placeholder="ชื่อ-นามสกุล" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label-minimal">เบอร์โทรศัพท์</label>
                    <input type="tel" className="input-minimal" placeholder="08X-XXX-XXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label-minimal">อีเมลใช้งาน</label>
                  <input type="email" className="input-minimal" placeholder="อีเมลของคุณ" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-minimal">รหัสผ่าน</label>
                    <input type="password" className="input-minimal" placeholder="อย่างน้อย 8 ตัว" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label-minimal">ยืนยันรหัส</label>
                    <input type="password" className="input-minimal" placeholder="ยืนยันรหัสผ่าน" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
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

            {captchaConfig.enabled && captchaConfig.siteKey && (
              <div className="flex justify-center pt-2">
                <TurnstileWidget
                  siteKey={captchaConfig.siteKey}
                  onToken={handleCaptchaToken}
                  onExpire={handleCaptchaExpire}
                  resetKey={captchaResetKey}
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50/80 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-800/30 flex items-center gap-2 animate-shake">
                <AlertCircle size={16} className="flex-shrink-0" /> {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading} 
                className="w-full h-[48px] bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-[14px] transition-all shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-[1px] active:shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {tab === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                    {tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกเปิดร้านค้า'}
                  </>
                )}
              </button>
            </div>
          </form>

          {tab === 'login' && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest"><span className="bg-white dark:bg-slate-900 px-3 text-slate-400">หรือเข้าด้วย Social</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const backendUrl = 'https://api-panel.siamsite.shop';
                    window.location.href = `${backendUrl}/api/auth/google`;
                  }}
                  className="flex items-center justify-center gap-2.5 h-[44px] border border-slate-200 dark:border-slate-700/80 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold text-[11px] text-slate-600 dark:text-slate-300 shadow-sm hover:shadow-md cursor-pointer"
                >
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4" />
                  GOOGLE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const backendUrl = 'https://api-panel.siamsite.shop';
                    window.location.href = `${backendUrl}/api/auth/facebook`;
                  }}
                  className="flex items-center justify-center gap-2.5 h-[44px] border border-slate-200 dark:border-slate-700/80 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold text-[11px] text-slate-600 dark:text-slate-300 shadow-sm hover:shadow-md cursor-pointer"
                >
                  <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" className="w-4 h-4" />
                  FACEBOOK
                </button>
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <button 
              onClick={() => setTab(tab === 'login' ? 'register' : 'login')} 
              className="text-[11px] font-bold text-slate-500 hover:text-amber-500 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <span>{tab === 'login' ? "ยังไม่มีบัญชีใช่ไหม?" : "มีบัญชีอยู่แล้ว?"}</span>
              <span className="text-amber-500">{tab === 'login' ? "สมัครสมาชิกที่นี่" : "เข้าสู่ระบบเลย"}</span>
            </button>
          </div>
        </div>
        
        {/* Sleek Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <style jsx>{`
        .input-minimal {
          width: 100%;
          background: rgba(255, 255, 255, 0.5);
          border: 1px solid #e2e8f0;
          padding: 0.65rem 1rem;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
          color: #1e293b;
        }
        :global(.dark) .input-minimal {
          background: rgba(15, 23, 42, 0.5);
          border-color: #334155;
          color: #f8fafc;
        }
        .input-minimal:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
          background: #ffffff;
        }
        :global(.dark) .input-minimal:focus {
          background: #0f172a;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
        }
        .input-minimal::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }
        :global(.dark) .input-minimal::placeholder {
          color: #64748b;
        }
        .label-minimal {
          display: block;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 0.35rem;
          margin-left: 0.25rem;
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