'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';
import { Loader2, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const { alert: showAlert } = useAdminAlert();
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showAlert({ type: 'warning', title: 'กรุณากรอกอีเมล' });
      return;
    }
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      // Backend always responds 200 to avoid account enumeration. Tell the user
      // to check email and continue to the reset step.
      showAlert({
        type: 'success',
        title: 'ส่งรหัสยืนยันแล้ว',
        message: 'หากอีเมลถูกต้อง ระบบจะส่งรหัส OTP 6 หลักให้ภายในไม่กี่นาที',
      });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      showAlert({ type: 'error', title: 'ส่งคำขอไม่สำเร็จ', message: err?.message || 'กรุณาลองใหม่' });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-surface-hover border border-border focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none text-foreground placeholder:text-foreground-subtle text-sm rounded-xl px-3.5 py-3 transition-colors';

  return (
    <MainLayout>
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-surface border border-border rounded-2xl shadow-theme-lg p-8">
          <h1 className="text-xl font-black text-foreground mb-2">ลืมรหัสผ่าน</h1>
          <p className="text-sm text-foreground-muted mb-6">
            กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งรหัส OTP 6 หลักไปให้
          </p>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              placeholder="อีเมลของคุณ"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              disabled={busy}
              autoComplete="email"
              autoFocus
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground text-sm font-black rounded-xl transition-all shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <><Send className="w-4 h-4" strokeWidth={2.25} />ส่งรหัส OTP</>}
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-foreground-subtle">
            <Link href="/" className="hover:text-primary font-bold">← กลับหน้าหลัก</Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
