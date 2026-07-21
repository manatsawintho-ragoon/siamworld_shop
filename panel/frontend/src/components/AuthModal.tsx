'use client';
import { useState, FormEvent, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import TurnstileWidget from './TurnstileWidget';
import { LEGAL_DOCS, LEGAL_VERSION } from '@/lib/legal';
import { Icon } from '@/components/ui/icon';
import { X, CircleAlert, LoaderCircle } from 'lucide-react';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
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
      setTab(initialTab);
      setError('');
      setCaptchaToken('');
      setAcceptedTerms(false);
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => firstFieldRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    setMounted(false);
    document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
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
      className="fixed inset-0 z-[99999] overflow-y-auto py-6 px-4 sm:py-10 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/55" />

      {/* Capped to the viewport with the form as the only scrolling part, so the
          taller register tab can never run off the screen and the tabs and close
          button stay reachable while scrolling it. */}
      <div className="relative w-full max-w-[400px] max-h-[calc(100dvh-3rem)] flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        <div className="px-5 pt-5 sm:px-6 shrink-0">
          {/* Brand on one row with the heading rather than stacked above it:
              same information, roughly 40px less of it. */}
          <div className="flex items-center gap-3 mb-4 pr-8">
            <Image
              src="/images/logosiamsite-h256.png"
              alt="SIAMSITE"
              width={160}
              height={100}
              priority
              className="h-8 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <h2 id="auth-modal-title" className="text-[17px] font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">
                {isRegister ? 'สร้างบัญชีผู้ขาย' : 'เข้าสู่ระบบ'}
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                {isRegister ? 'เปิดร้านค้ามายคราฟของคุณเอง' : 'Siamsite Store Manager'}
              </p>
            </div>
          </div>

          {/* Tabs are a plain underline row. The old sliding pill needed an
              absolutely positioned element and a transition to explain itself;
              a border does the same job with nothing moving. */}
          <div className="flex border-b border-slate-200 dark:border-slate-800" role="tablist">
            {([
              { key: 'login' as const, label: 'เข้าสู่ระบบ' },
              { key: 'register' as const, label: 'สมัครสมาชิก' },
            ]).map(t => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 pb-2 text-sm font-medium cursor-pointer border-b-2 -mb-px ${
                  tab === t.key
                    ? 'border-amber-500 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4 pb-5 sm:px-6 overflow-y-auto">
          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-3" noValidate>
            {isRegister ? (
              <>
                {/* Paired into two columns: these four are short values, and one
                    field per row made the register tab taller than the viewport. */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-name" className="auth-label">ชื่อที่แสดง</label>
                    <input ref={firstFieldRef} id="reg-name" className="auth-input" placeholder="ชื่อ-นามสกุล" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="auth-label">เบอร์โทร <span className="auth-optional">(ไม่บังคับ)</span></label>
                    <input id="reg-phone" type="tel" inputMode="tel" className="auth-input" placeholder="08X-XXX-XXXX" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-email" className="auth-label">อีเมลใช้งาน</label>
                  <input id="reg-email" type="email" inputMode="email" className="auth-input" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-pass" className="auth-label">รหัสผ่าน</label>
                    <input id="reg-pass" type="password" className="auth-input" placeholder="8 ตัวขึ้นไป" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="reg-confirm" className="auth-label">ยืนยันรหัสผ่าน</label>
                    <input id="reg-confirm" type="password" className="auth-input" placeholder="พิมพ์อีกครั้ง" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                  </div>
                </div>

                {/* Legal consent, required before account creation. All five
                    documents stay named and linked: this is the record behind
                    terms_accepted_at, so it is not the place to summarise. */}
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11.5px] leading-snug text-slate-600 dark:text-slate-300 text-left">
                    ฉันได้อ่านและยอมรับ
                    {LEGAL_DOCS.map((d, i) => (
                      <span key={d.slug}>
                        {i === 0 ? ' ' : i === LEGAL_DOCS.length - 1 ? ' และ' : ', '}
                        <Link href={d.href} target="_blank" className="text-amber-600 dark:text-amber-400 underline underline-offset-2">
                          {d.title}
                        </Link>
                      </span>
                    ))}
                  </span>
                </label>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="login-email" className="auth-label">อีเมลผู้ใช้งาน</label>
                  <input ref={firstFieldRef} id="login-email" type="email" inputMode="email" className="auth-input" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="login-pass" className="auth-label">รหัสผ่าน</label>
                  <input id="login-pass" type="password" className="auth-input" placeholder="รหัสผ่านของคุณ" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
              </>
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
              <div role="alert" aria-live="assertive" className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[13px] font-medium rounded-lg border border-red-200 dark:border-red-900/50 flex items-start gap-2">
                <CircleAlert size={15} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !acceptedTerms)}
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
            >
              {loading && <LoaderCircle size={17} className="animate-spin" />}
              {isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {!isRegister && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-slate-900 px-3 text-[12px] text-slate-400 dark:text-slate-500">หรือ</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { window.location.href = '/api/auth/google'; }} className="auth-social">
                  <Icon name="google-color" className="text-base" />
                  Google
                </button>
                <button type="button" onClick={() => { window.location.href = '/api/auth/facebook'; }} className="auth-social">
                  <Icon name="facebook" className="text-base text-[#1877F2]" />
                  Facebook
                </button>
              </div>
            </>
          )}

          {/* Only on the login tab. On register it repeated what the tab row
              directly above already offers, and the register tab is the one
              fighting for vertical space. */}
          {!isRegister && (
            <p className="mt-5 text-center text-[13px] text-slate-500 dark:text-slate-400">
              ยังไม่มีบัญชี?{' '}
              <button
                type="button"
                onClick={() => setTab('register')}
                className="text-amber-600 dark:text-amber-400 font-medium hover:underline cursor-pointer"
              >
                สมัครสมาชิก
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Scoped by styled-jsx: every element rendered here carries the scope
          class, so these selectors need no :global() except for the `.dark`
          ancestor, which lives outside this component. */}
      <style jsx>{`
        .auth-label {
          display: block;
          text-align: left;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          margin-bottom: 0.375rem;
        }
        :global(.dark) .auth-label { color: #cbd5e1; }
        .auth-optional { color: #94a3b8; font-weight: 400; }

        .auth-input {
          width: 100%;
          background: #fff;
          border: 1px solid #d8dee9;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          outline: none;
          color: #0f172a;
        }
        :global(.dark) .auth-input {
          background: rgba(15, 23, 42, 0.6);
          border-color: #334155;
          color: #f8fafc;
        }
        .auth-input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.16);
        }
        .auth-input::placeholder { color: #94a3b8; }
        :global(.dark) .auth-input::placeholder { color: #64748b; }

        .auth-social {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          height: 42px;
          border: 1px solid #d8dee9;
          border-radius: 0.5rem;
          font-weight: 500;
          font-size: 13px;
          color: #334155;
          background: #fff;
          cursor: pointer;
        }
        .auth-social:hover { background: #f8fafc; }
        :global(.dark) .auth-social {
          background: rgba(15, 23, 42, 0.4);
          border-color: #334155;
          color: #cbd5e1;
        }
        :global(.dark) .auth-social:hover { background: #1e293b; }
      `}</style>
    </div>
  );
}
