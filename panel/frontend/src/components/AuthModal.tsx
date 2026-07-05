'use client';
import { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import TurnstileWidget from './TurnstileWidget';
import { LEGAL_DOCS, LEGAL_VERSION } from '@/lib/legal';
import { Icon, type IconName } from '@/components/ui/icon';
import { LogIn, UserPlus, X, CircleAlert, LoaderCircle, Eye, EyeOff } from 'lucide-react';

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [animate, setAnimate] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

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
      const t = setTimeout(() => {
        setAnimate(true);
        firstFieldRef.current?.focus();
      }, 30);
      setTab(initialTab);
      setError('');
      setCaptchaToken('');
      setAcceptedTerms(false);
      setShowPassword(false);
      document.body.style.overflow = 'hidden';
      return () => clearTimeout(t);
    } else {
      setAnimate(false);
      const timer = setTimeout(() => {
        setMounted(false);
        document.body.style.overflow = 'unset';
      }, 250);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, initialTab]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
    if (!acceptedTerms) { setError('กรุณายอมรับข้อกำหนดและนโยบายก่อนสมัครสมาชิก'); return; }
    if (captchaConfig.enabled && !captchaToken) {
      setError('กรุณายืนยันว่าคุณไม่ใช่บอท');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        email, password, displayName, phone: phone || undefined,
        captchaToken: captchaToken || undefined,
        acceptedTerms: true, termsVersion: LEGAL_VERSION,
      });
      onClose();
      window.location.href = '/order';
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      resetCaptcha();
    } finally { setLoading(false); }
  };

  if (!mounted || !isOpen) return null;

  const isRegister = tab === 'register';

  return (
    <div
      className={`fixed inset-0 z-[99999] overflow-y-auto py-6 px-4 sm:py-10 flex items-center justify-center ${animate ? 'pointer-events-auto' : 'pointer-events-none'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Scrim — strong enough to isolate the dialog */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-[3px] transition-opacity duration-250 ${animate ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_70px_-15px_rgba(15,23,42,0.35)] overflow-hidden transition-all duration-300 ease-out transform ${animate ? 'scale-100 translate-y-0 opacity-100' : 'scale-[0.97] translate-y-3 opacity-0'}`}
      >
        {/* Top accent hairline */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />

        <div className="px-6 pt-7 pb-6 sm:px-8">
          {/* Brand */}
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/images/logosiamsite-h256.png"
              alt="SIAMSITE"
              width={160}
              height={100}
              priority
              className="h-14 w-auto object-contain mb-4"
            />
            <h2 id="auth-modal-title" className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isRegister ? 'สร้างบัญชีผู้ขาย' : 'เข้าสู่ระบบ'}
            </h2>
            <p className="text-slate-400 dark:text-slate-500 font-semibold text-[10px] uppercase tracking-[0.18em] mt-1.5">
              Siamsite Store Manager
            </p>
          </div>

          {/* Segmented tabs */}
          <div className="relative flex p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl mb-6 border border-slate-200/70 dark:border-slate-700/60">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm ring-1 ring-slate-900/5 transition-all duration-300 ease-out ${tab === 'login' ? 'left-1' : 'left-[calc(50%+3px)]'}`}
            />
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`relative z-10 flex-1 py-2 font-bold text-[13px] rounded-lg transition-colors cursor-pointer ${tab === 'login' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              aria-pressed={tab === 'login'}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`relative z-10 flex-1 py-2 font-bold text-[13px] rounded-lg transition-colors cursor-pointer ${isRegister ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              aria-pressed={isRegister}
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4" noValidate>
            {isRegister ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-name" className="label-minimal">ชื่อที่แสดง</label>
                    <input ref={firstFieldRef} id="reg-name" className="input-minimal" placeholder="ชื่อ-นามสกุล" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="label-minimal">เบอร์โทรศัพท์</label>
                    <input id="reg-phone" type="tel" inputMode="tel" className="input-minimal" placeholder="08X-XXX-XXXX" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-email" className="label-minimal">อีเมลใช้งาน</label>
                  <input id="reg-email" type="email" inputMode="email" className="input-minimal" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-pass" className="label-minimal">รหัสผ่าน</label>
                    <div className="relative">
                      <input id="reg-pass" type={showPassword ? 'text' : 'password'} className="input-minimal pr-9" placeholder="อย่างน้อย 8 ตัว" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowPassword(s => !s)} className="pass-toggle" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reg-confirm" className="label-minimal">ยืนยันรหัส</label>
                    <input id="reg-confirm" type={showPassword ? 'text' : 'password'} className="input-minimal" placeholder="ยืนยันรหัสผ่าน" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  </div>
                </div>

                {/* Legal consent — required before account creation */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 p-3 transition-colors hover:border-amber-300 dark:hover:border-amber-500/40">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 font-semibold text-left">
                    ฉันได้อ่านและยอมรับ
                    {LEGAL_DOCS.map((d, i) => (
                      <span key={d.slug}>
                        {i === 0 ? ' ' : i === LEGAL_DOCS.length - 1 ? ' และ' : ', '}
                        <Link href={d.href} target="_blank" className="text-amber-600 dark:text-amber-400 hover:text-amber-700 underline underline-offset-2">
                          {d.title}
                        </Link>
                      </span>
                    ))}
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="label-minimal">อีเมลผู้ใช้งาน</label>
                  <input ref={firstFieldRef} id="login-email" type="email" inputMode="email" className="input-minimal" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="login-pass" className="label-minimal">รหัสผ่าน</label>
                  <div className="relative">
                    <input id="login-pass" type={showPassword ? 'text' : 'password'} className="input-minimal pr-9" placeholder="ป้อนรหัสผ่านของคุณ" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="pass-toggle" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {captchaConfig.enabled && captchaConfig.siteKey && (
              <div className="flex justify-center pt-1">
                <TurnstileWidget
                  siteKey={captchaConfig.siteKey}
                  onToken={handleCaptchaToken}
                  onExpire={handleCaptchaExpire}
                  resetKey={captchaResetKey}
                />
              </div>
            )}

            {error && (
              <div role="alert" aria-live="assertive" className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/50 flex items-center gap-2 animate-shake">
                <CircleAlert size={16} className="flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !acceptedTerms)}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-sm shadow-amber-500/25 hover:shadow-md hover:shadow-amber-500/30 active:translate-y-px flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
            >
              {loading ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <>
                  {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {isRegister ? 'สมัครสมาชิกเปิดร้านค้า' : 'เข้าสู่ระบบ'}
                </>
              )}
            </button>
          </form>

          {!isRegister && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                  <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500">หรือดำเนินการต่อด้วย</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/api/auth/google'; }}
                  className="social-btn"
                >
                  <Icon name="google-color" className="text-base" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = '/api/auth/facebook'; }}
                  className="social-btn"
                >
                  <Icon name="facebook" className="text-base text-[#1877F2]" />
                  Facebook
                </button>
              </div>
            </>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setTab(isRegister ? 'login' : 'register')}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
            >
              {isRegister ? 'มีบัญชีอยู่แล้ว? ' : 'ยังไม่มีบัญชีใช่ไหม? '}
              <span className="text-amber-600 dark:text-amber-400 font-bold">{isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกที่นี่'}</span>
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <X size={16} />
        </button>
      </div>

      <style jsx>{`
        .input-minimal {
          width: 100%;
          background: #fff;
          border: 1px solid #e2e8f0;
          padding: 0.6rem 0.85rem;
          border-radius: 0.7rem;
          font-weight: 600;
          font-size: 0.875rem;
          line-height: 1.25rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          color: #0f172a;
        }
        :global(.dark) .input-minimal {
          background: rgba(15, 23, 42, 0.6);
          border-color: #334155;
          color: #f8fafc;
        }
        .input-minimal:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }
        .input-minimal::placeholder { color: #94a3b8; font-weight: 500; }
        :global(.dark) .input-minimal::placeholder { color: #64748b; }
        .label-minimal {
          display: block;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #64748b;
          margin-bottom: 0.3rem;
          margin-left: 0.15rem;
        }
        :global(.dark) .label-minimal { color: #94a3b8; }
        .pass-toggle {
          position: absolute;
          top: 50%;
          right: 0.5rem;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 0.5rem;
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .pass-toggle:hover { color: #f59e0b; background: rgba(245, 158, 11, 0.08); }
        .social-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          height: 44px;
          border: 1px solid #e2e8f0;
          border-radius: 0.7rem;
          font-weight: 700;
          font-size: 12.5px;
          color: #334155;
          background: #fff;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          cursor: pointer;
        }
        .social-btn:hover { border-color: #cbd5e1; background: #f8fafc; box-shadow: 0 1px 3px rgba(15,23,42,0.06); }
        :global(.dark) .social-btn { background: rgba(15,23,42,0.4); border-color: #334155; color: #cbd5e1; }
        :global(.dark) .social-btn:hover { background: #1e293b; border-color: #475569; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        @media (prefers-reduced-motion: reduce) {
          .animate-shake { animation: none; }
        }
      `}</style>
    </div>
  );
}
