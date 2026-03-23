'use client';
import { useEffect, useRef, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';

type View = 'select' | 'promptpay' | 'qr' | 'success';

const AMOUNTS = [50, 100, 200, 300, 500, 1000];

export default function TopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();

  const [view, setView]       = useState<View>('select');
  const [amount, setAmount]   = useState(100);
  const [custom, setCustom]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // QR step
  const [qrUrl, setQrUrl]               = useState('');
  const [reference, setReference]       = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientId, setRecipientId]   = useState('');
  const [qrAmount, setQrAmount]         = useState(0);

  // Slip upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile]       = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [verifying, setVerifying]     = useState(false);

  // Success
  const [successAmount, setSuccessAmount]     = useState(0);
  const [successBalance, setSuccessBalance]   = useState(0);

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  const selectedAmount = custom ? Math.max(1, Number(custom)) : amount;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerateQR = async () => {
    setError('');
    setLoading(true);
    try {
      const d = await api<any>('/payment/promptpay/create', {
        method: 'POST',
        token: getToken()!,
        body: { amount: selectedAmount },
      }) as any;

      setReference(d.reference);
      setRecipientName(d.recipientName || '');
      setRecipientId(d.recipientId || '');
      setQrAmount(d.amount);

      // Generate QR image client-side from PromptPay payload
      const img = await QRCode.toDataURL(d.payload, {
        width: 260,
        margin: 2,
        color: { dark: '#003B80', light: '#FFFFFF' },
      });
      setQrUrl(img);
      setView('qr');
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleSlipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipFile(file);
    const reader = new FileReader();
    reader.onload = ev => setSlipPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleVerifySlip = async () => {
    if (!slipFile) return;
    setVerifying(true);
    setError('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload  = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(slipFile);
      });

      const d = await api<any>('/payment/slip/verify', {
        method: 'POST',
        token: getToken()!,
        body: { base64 },
      }) as any;

      setSuccessAmount(d.amount);
      setSuccessBalance(d.balanceAfter);
      await refresh();
      setView('success');
    } catch (err: any) {
      setError(err?.message || 'ตรวจสอบสลิปไม่สำเร็จ');
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setView('select');
    setError('');
    setQrUrl('');
    setSlipFile(null);
    setSlipPreview('');
    setCustom('');
    setAmount(100);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <i className="fas fa-coins text-primary"></i> เติมเงิน
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            ยอดเงินปัจจุบัน:{' '}
            <span className="font-bold text-primary">฿{user.wallet_balance?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
          </p>
        </div>

        {/* Back button (not on select/success) */}
        {(view === 'promptpay' || view === 'qr') && (
          <button onClick={() => view === 'qr' ? setView('promptpay') : reset()}
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground mb-4 transition-colors">
            <i className="fas fa-arrow-left"></i> ย้อนกลับ
          </button>
        )}

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl p-3 mb-4 text-sm bg-error-light border border-error/20 text-error-foreground">
              <i className="fas fa-exclamation-circle flex-shrink-0"></i>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="opacity-60 hover:opacity-100"><i className="fas fa-times"></i></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ── STEP 0: Select method ── */}
          {view === 'select' && (
            <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-3">
              <p className="text-xs font-bold text-foreground-muted mb-2">เลือกช่องทางชำระเงิน</p>

              {/* PromptPay */}
              <button onClick={() => { setView('promptpay'); setError(''); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-[#003B80]/20 bg-[#003B80]/5 hover:border-[#003B80]/50 hover:bg-[#003B80]/10 transition-all duration-200 group text-left">
                <div className="w-14 h-14 rounded-2xl bg-[#003B80] flex items-center justify-center flex-shrink-0 shadow-[0_4px_0_#001f5c] group-hover:shadow-[0_2px_0_#001f5c] group-hover:translate-y-0.5 transition-all">
                  <i className="fas fa-qrcode text-2xl text-white"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-base">PromptPay</p>
                  <p className="text-xs text-gray-500 mt-0.5">สแกน QR ด้วยแอปธนาคาร แล้วอัปโหลดสลิป</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> ตรวจสอบอัตโนมัติ
                    </span>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-300 group-hover:text-[#003B80] transition-colors"></i>
              </button>

              {/* TrueMoney — coming soon */}
              <div className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed relative overflow-hidden">
                <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-gift text-2xl text-gray-400"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-500 text-base">TrueMoney Wallet</p>
                  <p className="text-xs text-gray-400 mt-0.5">เติมผ่านซองอังเปา TrueMoney</p>
                </div>
                <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">เร็วๆ นี้</span>
              </div>

              {/* Info */}
              <div className="mt-2 bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs text-foreground-muted space-y-1.5">
                <p><i className="fas fa-shield-alt text-primary mr-1.5"></i>ระบบตรวจสอบสลิปอัตโนมัติ ป้องกันสลิปปลอม</p>
                <p><i className="fas fa-bolt text-primary mr-1.5"></i>เงินเข้ากระเป๋าทันทีหลังสลิปผ่าน</p>
                <p><i className="fas fa-headset text-primary mr-1.5"></i>ปัญหา? ติดต่อผ่าน Discord</p>
              </div>
            </motion.div>
          )}

          {/* ── STEP 1: PromptPay — select amount ── */}
          {view === 'promptpay' && (
            <motion.div key="promptpay" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#003B80]/5 border border-[#003B80]/15">
                <div className="w-10 h-10 rounded-xl bg-[#003B80] flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-qrcode text-white"></i>
                </div>
                <div>
                  <p className="font-black text-gray-900 text-sm">PromptPay</p>
                  <p className="text-xs text-gray-500">เลือกจำนวนเงินที่ต้องการเติม</p>
                </div>
              </div>

              {/* Preset amounts */}
              <div>
                <label className="block text-xs font-bold text-foreground-muted mb-2">จำนวนเงิน</label>
                <div className="grid grid-cols-3 gap-2">
                  {AMOUNTS.map(a => (
                    <button key={a} type="button"
                      onClick={() => { setAmount(a); setCustom(''); }}
                      className={`py-3 rounded-xl text-sm font-bold transition-all ${!custom && amount === a
                        ? 'bg-[#003B80] text-white shadow-[0_4px_0_#001f5c]'
                        : 'bg-surface-hover text-foreground-muted hover:bg-border'}`}>
                      ฿{a.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <label className="block text-xs font-bold text-foreground-muted mb-1.5">หรือใส่จำนวนเอง</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted text-sm font-bold">฿</span>
                  <input type="number" value={custom} onChange={e => setCustom(e.target.value)}
                    placeholder="0" min={1} max={100000}
                    className="input text-sm pl-8 w-full" />
                </div>
              </div>

              <button onClick={handleGenerateQR} disabled={loading || selectedAmount < 1}
                className="w-full py-3.5 rounded-xl font-black text-white bg-[#003B80] shadow-[0_4px_0_#001f5c] hover:brightness-110 hover:shadow-[0_2px_0_#001f5c] hover:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {loading
                  ? <><i className="fas fa-spinner fa-spin"></i> สร้าง QR...</>
                  : <><i className="fas fa-qrcode"></i> สร้าง QR Code (฿{selectedAmount.toLocaleString()})</>}
              </button>
            </motion.div>
          )}

          {/* ── STEP 2: QR display + slip upload ── */}
          {view === 'qr' && (
            <motion.div key="qr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-4">

              {/* QR card */}
              <div className="bg-white rounded-2xl border-2 border-[#003B80]/20 overflow-hidden">
                {/* Header */}
                <div className="bg-[#003B80] px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-qrcode text-white text-sm"></i>
                    <span className="font-bold text-white text-sm">PromptPay QR Code</span>
                  </div>
                  <span className="text-white/70 text-xs">สแกนเพื่อโอนเงิน</span>
                </div>

                {/* QR image */}
                <div className="flex flex-col items-center py-6 bg-white">
                  {qrUrl
                    ? <img src={qrUrl} alt="PromptPay QR" className="w-56 h-56 rounded-lg" />
                    : <div className="w-56 h-56 flex items-center justify-center"><i className="fas fa-spinner fa-spin text-3xl text-[#003B80]"></i></div>
                  }
                  <p className="text-3xl font-black text-[#003B80] mt-4">฿{qrAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                  {recipientName && (
                    <p className="text-sm font-semibold text-gray-700 mt-1">{recipientName}</p>
                  )}
                  {recipientId && (
                    <p className="text-xs text-gray-400 mt-0.5">{recipientId}</p>
                  )}
                </div>

                {/* Steps */}
                <div className="px-5 pb-5 space-y-2">
                  {[
                    'เปิดแอปธนาคาร → สแกน QR Code',
                    `โอน ฿${qrAmount.toLocaleString()} ตามจำนวนที่แสดง`,
                    'ถ่ายรูปสลิปหรือ screenshot แล้วอัปโหลดด้านล่าง',
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-gray-600">
                      <span className="w-5 h-5 rounded-full bg-[#003B80] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Slip upload */}
              <div className="card p-5 space-y-3">
                <p className="text-sm font-black text-foreground">อัปโหลดสลิปโอนเงิน</p>
                <p className="text-xs text-foreground-muted">อัปโหลดสลิปหรือ screenshot จากแอปธนาคาร เพื่อยืนยันการโอนและรับเงินเข้ากระเป๋า</p>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSlipSelect} />

                {slipPreview ? (
                  <div className="relative">
                    <img src={slipPreview} alt="slip preview" className="w-full max-h-64 object-contain rounded-xl border border-border" />
                    <button onClick={() => { setSlipFile(null); setSlipPreview(''); if (fileRef.current) fileRef.current.value = ''; }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary rounded-xl py-8 flex flex-col items-center gap-2 text-foreground-muted hover:text-primary transition-all">
                    <i className="fas fa-cloud-upload-alt text-3xl"></i>
                    <span className="text-sm font-semibold">คลิกเพื่อเลือกรูปสลิป</span>
                    <span className="text-xs">รองรับ JPEG, PNG, GIF, WebP (ไม่เกิน 4 MB)</span>
                  </button>
                )}

                <button onClick={handleVerifySlip} disabled={!slipFile || verifying}
                  className="btn-success w-full justify-center py-3 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed">
                  {verifying
                    ? <><i className="fas fa-spinner fa-spin"></i> กำลังตรวจสอบสลิป...</>
                    : <><i className="fas fa-check-circle"></i> ยืนยันสลิปและรับเงิน</>}
                </button>

                <p className="text-[10px] text-center text-foreground-muted">
                  ระบบตรวจสอบสลิปด้วย AI อัตโนมัติ — ใช้เวลาไม่กี่วินาที
                </p>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Success ── */}
          {view === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center py-8 space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto shadow-[0_4px_0_#bbf7d0]">
                <i className="fas fa-check text-3xl text-green-600"></i>
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900">เติมเงินสำเร็จ!</p>
                <p className="text-4xl font-black text-green-600 mt-2">฿{successAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm text-gray-500 mt-2">
                  ยอดเงินใหม่: <span className="font-bold text-gray-800">฿{successBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={reset} className="px-6 py-2.5 rounded-xl bg-surface-hover text-foreground-muted text-sm font-semibold hover:bg-border transition-all">
                  เติมเงินอีกครั้ง
                </button>
                <button onClick={() => router.push('/shop')} className="btn-success px-6 py-2.5">
                  <i className="fas fa-store"></i> ไปร้านค้า
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </MainLayout>
  );
}
