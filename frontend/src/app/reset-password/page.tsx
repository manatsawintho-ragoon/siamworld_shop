'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

function ResetPasswordInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { alert: showAlert } = useAdminAlert();
  const [email, setEmail] = useState(search.get('email') || '');
  const [otp, setOtp] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp || !pw1) {
      showAlert({ type: 'warning', title: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      showAlert({ type: 'warning', title: 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก' });
      return;
    }
    if (pw1.length < 8) {
      showAlert({ type: 'warning', title: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' });
      return;
    }
    if (pw1 !== pw2) {
      showAlert({ type: 'error', title: 'รหัสผ่านไม่ตรงกัน' });
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { email, otp, newPassword: pw1 },
      });
      showAlert({
        type: 'success',
        title: 'รีเซ็ตรหัสผ่านสำเร็จ',
        message: 'กรุณาเข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่',
      });
      router.push('/');
    } catch (err: any) {
      showAlert({ type: 'error', title: 'รีเซ็ตล้มเหลว', message: err?.message || 'กรุณาลองใหม่' });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-gray-50 border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:outline-none text-gray-800 placeholder:text-gray-300 text-sm rounded-xl px-3.5 py-3 transition-colors';

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-xl font-black text-gray-800 mb-2">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm text-gray-500 mb-6">กรอกรหัส OTP 6 หลักจากอีเมลและตั้งรหัสผ่านใหม่</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            disabled={busy}
            autoComplete="email"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="รหัส OTP 6 หลัก"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className={`${inputCls} text-center text-2xl font-black tracking-[0.5em]`}
            disabled={busy}
          />
          <input
            type="password"
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            className={inputCls}
            disabled={busy}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className={inputCls}
            disabled={busy}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white text-sm font-black rounded-xl transition-all shadow-[0_4px_0_#14532d] hover:shadow-[0_2px_0_#14532d] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
          >
            {busy ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-check mr-2" />ตั้งรหัสผ่านใหม่</>}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-gray-400 space-x-4">
          <Link href="/forgot-password" className="hover:text-green-600 font-bold">ขอ OTP ใหม่</Link>
          <span>·</span>
          <Link href="/" className="hover:text-green-600 font-bold">หน้าหลัก</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <MainLayout>
      <Suspense fallback={<div className="text-center py-12 text-gray-400 text-sm">กำลังโหลด...</div>}>
        <ResetPasswordInner />
      </Suspense>
    </MainLayout>
  );
}
