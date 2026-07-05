'use client';
import { useEffect, useRef, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';
import {
  Zap, ChevronLeft, QrCode, Store, X, Info, Clock, Hourglass, Lock,
  Loader2, CheckCircle2, RefreshCw, ReceiptText, UploadCloud, Tag,
  ShoppingCart, Check, CheckCheck,
} from 'lucide-react';

type Step = 'amount' | 'qr' | 'upload' | 'success';

function QrCountdown({ expiresAt, onExpired }: { expiresAt: number; onExpired: () => void }) {
  const calc = () => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const [secs, setSecs] = useState(calc);
  const firedRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const s = calc();
      setSecs(s);
      if (s <= 0 && !firedRef.current) { firedRef.current = true; onExpired(); }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const expired = secs <= 0;
  const urgent  = secs <= 60 && !expired;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
      expired ? 'bg-error/10 border-error/25 text-error' :
      urgent  ? 'bg-orange-500/10 border-orange-500/25 text-orange-600' :
                'bg-blue-500/10 border-blue-500/25 text-blue-600'
    }`}>
      {expired ? <Clock className="w-3 h-3 text-error" strokeWidth={2.5} /> : urgent ? <Hourglass className="w-3 h-3 text-orange-500 animate-pulse" strokeWidth={2.5} /> : <Clock className="w-3 h-3 text-blue-500" strokeWidth={2.5} />}
      {expired ? 'QR หมดอายุแล้ว สร้างใหม่ได้เลย' : (
        <>QR หมดอายุใน <span className="tabular-nums font-black ml-1">{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span></>
      )}
    </div>
  );
}

const AMOUNTS = [50, 100, 200, 300, 500, 1000];

export default function PromptPayTopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const { alert } = useAdminAlert();
  const { settings } = useSettings();

  const ppEnabled = settings['promptpay_enabled'] !== 'false';
  const bonusEnabled = (settings['topup_bonus_promptpay_enabled'] ?? settings['topup_bonus_enabled']) === 'true';
  const bonusMult    = parseFloat(settings['topup_bonus_promptpay_multiplier'] ?? settings['topup_bonus_multiplier'] ?? '1') || 1;
  const hasBonus     = bonusEnabled && bonusMult > 1;

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);

  // Discount code
  const [discountCode, setDiscountCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<{ code: string; discountAmount: number } | null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);
  const [discountError, setDiscountError] = useState('');

  // QR Data
  const [qrUrl, setQrUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [qrAmount, setQrAmount]       = useState(0);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrExpired, setQrExpired]     = useState(false);

  // Slip Data
  const fileRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile]       = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [verifying, setVerifying]     = useState(false);

  // Success Data
  const [successAmount,     setSuccessAmount]     = useState(0);
  const [successPaid,       setSuccessPaid]       = useState(0);
  const [successMultiplier, setSuccessMultiplier] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      alert({ type: 'warning', title: 'กรุณาเข้าสู่ระบบ', message: 'คุณต้องล็อกอินก่อนเติมเงิน' }).then(() => router.push('/'));
    }
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  const selectedAmount = custom ? Math.max(10, Number(custom)) : amount;

  const handleGenerateQR = async () => {
    setLoading(true);
    try {
      const d = await api<any>('/payment/promptpay/create', {
        method: 'POST', token: getToken()!, body: { amount: selectedAmount },
      }) as any;
      setRecipientName(d.recipientName || '');
      setQrAmount(d.amount);
      setQrExpiresAt(Date.now() + 15 * 60 * 1000);
      const img = await QRCode.toDataURL(d.payload, { width: 200, margin: 2, color: { dark: '#003b80', light: '#FFFFFF' } });
      setQrUrl(img);
      setStep('qr');
    } catch (err: any) {
      await alert({ type: 'error', title: 'เกิดข้อผิดพลาด', message: err?.message || 'ไม่สามารถสร้าง QR Code ได้ กรุณาลองใหม่' });
    } finally { setLoading(false); }
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
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(slipFile);
      });
      const d = await api<any>('/payment/slip/verify', {
        method: 'POST', token: getToken()!,
        body: {
          base64,
          ...(qrAmount > 0 ? { expectedAmount: qrAmount } : {}),
          ...(discountInfo ? { discountCode: discountInfo.code } : {}),
        },
      }) as any;
      setSuccessAmount(d.amount);
      setSuccessPaid(d.paid_amount ?? d.amount);
      setSuccessMultiplier(d.multiplier ?? 1);
      await refresh();
      setStep('success');
    } catch (err: any) {
      await alert({ type: 'error', title: 'ตรวจสอบสลิปไม่สำเร็จ', message: err?.message || 'กรุณาตรวจสอบสลิปและลองใหม่อีกครั้ง' });
    } finally { setVerifying(false); }
  };

  const reset = () => {
    setStep('amount'); setQrUrl(''); setSlipFile(null); setSlipPreview('');
    setCustom(''); setAmount(100); setSuccessMultiplier(1); setSuccessPaid(0);
    setQrExpiresAt(null); setQrExpired(false);
    setDiscountInfo(null); setDiscountCode(''); setDiscountError('');
  };

  const goBack = () => {
    if (step === 'amount') router.push('/topup');
    else if (step === 'qr') setStep('amount');
    else if (step === 'upload') setStep('qr');
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-3 pb-8 font-prompt">

        {/* ── Bonus Promo Banner ── */}
        <AnimatePresence>
          {hasBonus && step !== 'success' && (
            <motion.div
              key="bonus-banner"
              initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="relative bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl overflow-hidden shadow-[0_4px_0_#c2410c,0_2px_20px_rgba(249,115,22,0.4)]"
            >
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex items-center gap-4 px-5 py-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Zap className="w-5 h-5 text-white" strokeWidth={2.25} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-0.5">โปรโมชั่น PromptPay</p>
                  <h3 className="text-lg font-black text-white leading-tight">
                    เติมผ่าน PromptPay วันนี้ ได้รับโบนัส
                    <span className="ml-2 text-2xl text-yellow-200 drop-shadow">x{bonusMult}</span>
                  </h3>
                  <p className="text-[11px] text-white/80 font-bold mt-0.5">เติม ฿100 → ได้รับ ฿{(100 * bonusMult).toLocaleString()} เข้า Wallet ทันที</p>
                </div>
                <div className="flex-shrink-0 text-center bg-white/20 border border-white/30 rounded-xl px-4 py-2">
                  <p className="text-[9px] font-black text-white/70 uppercase tracking-wider">คูณเงิน</p>
                  <p className="text-3xl font-black text-white leading-none">x{bonusMult}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <div className="bg-surface border-2 border-primary/30 rounded-xl p-3 flex items-center shadow-theme-sm">
          <div className="flex items-center gap-3">
            <button onClick={goBack} disabled={step === 'success' || verifying || loading}
              className="w-9 h-9 rounded-lg hover:bg-surface-hover border border-transparent hover:border-border flex items-center justify-center transition-all disabled:opacity-0">
              <ChevronLeft className="w-4 h-4 text-foreground-subtle" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-black text-foreground leading-none flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#003b80]" strokeWidth={2.25} /> เติมเงินผ่าน PromptPay
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                    (step === 'amount' && i === 1) ||
                    ((step === 'qr' || step === 'upload') && i === 2) ||
                    (step === 'success' && i === 3)
                    ? 'w-6 bg-primary' : 'w-1.5 bg-primary/20'
                  }`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait">

            {!ppEnabled && step === 'amount' && (
              <motion.div key="disabled" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-surface rounded-xl border-2 border-warning/30 shadow-theme-sm w-full p-8 text-center flex-1 flex flex-col items-center justify-center gap-3">
                <Store className="w-10 h-10 text-warning" strokeWidth={1.75} />
                <p className="text-sm font-black text-foreground">PromptPay ปิดรับชำระเงินชั่วคราว</p>
                <button onClick={() => router.push('/topup')} className="btn-primary px-5 py-2.5 text-white font-black text-[13px] rounded-lg">กลับไปเลือกช่องทาง</button>
              </motion.div>
            )}

            {/* STEP 1: Amount */}
            {ppEnabled && step === 'amount' && (
              <motion.div key="amount" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm w-full p-6 space-y-4 flex-1">
                <div className="flex items-center gap-3 border-b border-border-muted pb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#003b80] text-white"><QrCode className="w-5 h-5" strokeWidth={2.25} /></div>
                  <div>
                    <h2 className="text-lg font-black text-foreground leading-none">ระบุจำนวนเงิน</h2>
                    <p className="text-[10px] font-bold text-foreground-subtle uppercase tracking-widest mt-1">ขั้นตอนที่ 1: เลือกจำนวนที่ต้องการ</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {AMOUNTS.map(a => (
                    <button key={a} onClick={() => { setAmount(a); setCustom(String(a)); }}
                      className={`py-3 rounded-lg font-black text-sm border-2 transition-all ${
                        custom === String(a) || (!custom && amount === a)
                          ? 'bg-[#003b80] text-white border-[#003b80] shadow-[0_3px_0_#002147]'
                          : 'bg-surface-hover text-foreground-subtle border-border-muted hover:border-primary/40'
                      }`}>
                      ฿{a.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg text-[#003b80]">฿</div>
                  <input type="number" value={custom} onChange={e => setCustom(e.target.value)}
                    placeholder="ระบุจำนวนเงินอื่นๆ..." className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-border-muted bg-surface-hover text-base font-black text-foreground focus:outline-none focus:border-[#003b80] transition-all" />
                </div>

                {hasBonus ? (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <p className="text-[9px] font-black text-foreground-subtle uppercase tracking-widest mb-0.5">ยอดที่โอน</p>
                        <p className="text-xl font-black text-foreground-muted">฿{selectedAmount.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-sm"><X className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /></div>
                        <span className="text-[10px] font-black text-orange-600 mt-1">x{bonusMult}</span>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-0.5">ได้รับเข้า Wallet</p>
                        <p className="text-2xl font-black text-orange-600">฿{(selectedAmount * bonusMult).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-primary/8 border border-dashed border-primary/25 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-foreground-subtle uppercase tracking-widest mb-0.5">ยอดชำระสุทธิ</p>
                    <p className="text-2xl font-black text-[#003b80]">฿{selectedAmount.toLocaleString()}</p>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" strokeWidth={2.25} />
                  <p className="text-[11px] font-bold text-blue-600">ยอดเติมเงินขั้นต่ำ <span className="font-black text-blue-700">10 บาท</span> ต่อครั้ง</p>
                </div>

                <button onClick={handleGenerateQR} disabled={loading || selectedAmount < 10}
                  className="btn-primary w-full py-4 text-white font-black text-base bg-[#003b80] shadow-[0_4px_0_#002147] hover:shadow-[0_2px_0_#002147] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />}
                  ถัดไป: สร้างรายการชำระเงิน
                </button>
              </motion.div>
            )}

            {/* STEP 2: QR */}
            {step === 'qr' && (
              <motion.div key="qr" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm w-full p-6 space-y-4 flex-1 flex flex-col items-center">
                <div className="text-center">
                  <h2 className="text-xl font-black text-[#003b80] leading-none">แสกนชำระเงิน</h2>
                  <p className="text-xs font-bold text-foreground-subtle mt-1">สแกน QR Code ด้วยแอปธนาคารของคุณ</p>
                </div>

                <div className={`relative p-4 bg-white border-2 rounded-2xl shadow-sm transition-all ${qrExpired ? 'border-error/30 opacity-50' : 'border-border-muted'}`}>
                  {qrUrl ? <img src={qrUrl} alt="QR Code" className="w-44 h-44 mx-auto" /> : <div className="w-44 h-44 flex items-center justify-center"><Loader2 className="w-7 h-7 text-[#003b80] animate-spin" strokeWidth={2.5} /></div>}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center">
                    <img src="/images/thai_qr_payment.png" className="w-5 h-auto" />
                  </div>
                  {qrExpired && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                      <div className="text-center"><Clock className="w-8 h-8 text-error mx-auto mb-2" strokeWidth={2} /><p className="text-error font-black text-sm">QR หมดอายุ</p></div>
                    </div>
                  )}
                </div>

                {qrExpiresAt && <QrCountdown expiresAt={qrExpiresAt} onExpired={() => setQrExpired(true)} />}

                <div className="text-center space-y-0.5 bg-blue-500/10 py-2.5 px-8 rounded-lg border border-blue-500/20">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center justify-center gap-1"><Lock className="w-2.5 h-2.5" strokeWidth={2.5} /> ยอดที่ต้องโอน (ถูกล็อค)</p>
                  <p className="text-xl font-black text-[#003b80]">฿{qrAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-foreground-subtle">{recipientName}</p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2.5 max-w-sm">
                  <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" strokeWidth={2.25} />
                  <p className="text-[10px] font-bold text-foreground-muted leading-relaxed">แอปธนาคารจะกรอกยอด <b>฿{qrAmount.toLocaleString()}</b> ให้อัตโนมัติและ<b>ไม่สามารถเปลี่ยนแปลงได้</b> เมื่อโอนสำเร็จกดปุ่มด้านล่างเพื่ออัปโหลดสลิป</p>
                </div>

                {qrExpired ? (
                  <button onClick={() => { setQrExpired(false); setStep('amount'); }} className="btn w-full py-4 bg-error text-white font-black text-sm shadow-[0_4px_0_rgb(0_0_0/0.2)] hover:brightness-110 hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} /> สร้าง QR ใหม่
                  </button>
                ) : (
                  <button onClick={() => setStep('upload')} className="btn w-full py-4 bg-[#003b80] text-white font-black text-sm shadow-[0_4px_0_#002147] hover:shadow-[0_2px_0_#002147] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
                    <ReceiptText className="w-3.5 h-3.5" strokeWidth={2.25} /> โอนเงินแล้ว (แจ้งสลิป)
                  </button>
                )}
              </motion.div>
            )}

            {/* STEP 3: Upload */}
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm w-full p-6 space-y-4 flex-1">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-foreground leading-none">อัปโหลดหลักฐานสลิป</h2>
                  <p className="text-xs font-bold text-foreground-subtle">อัปโหลดสลิปเพื่อให้ระบบตรวจสอบความถูกต้อง</p>
                </div>

                <div className="space-y-4">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSlipSelect} />
                  {slipPreview ? (
                    <div className="relative group rounded-xl overflow-hidden border-2 border-border-muted bg-surface-hover p-3">
                      <img src={slipPreview} alt="slip" className="w-full max-h-[220px] object-contain mx-auto" />
                      <button onClick={() => { setSlipFile(null); setSlipPreview(''); }} aria-label="ลบสลิป" className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-surface text-error shadow-md flex items-center justify-center hover:bg-error hover:text-white transition-all"><X className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full py-10 border-2 border-dashed border-border rounded-2xl bg-surface-hover flex flex-col items-center justify-center gap-3 group hover:border-primary transition-all">
                      <div className="w-12 h-12 rounded-lg bg-surface border border-border-muted flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"><UploadCloud className="w-6 h-6 text-primary" strokeWidth={2} /></div>
                      <div className="text-center">
                        <p className="font-black text-foreground-muted uppercase tracking-widest text-[11px]">เลือกรูปภาพสลิป</p>
                        <p className="text-[9px] font-bold text-foreground-subtle mt-1">กดเพื่อเลือกไฟล์สลิปจากเครื่องของคุณ</p>
                      </div>
                    </button>
                  )}

                  {/* Discount code */}
                  <div className="p-3.5 rounded-xl border border-border-muted bg-surface-hover/40">
                    <label className="text-[11px] font-black text-foreground-muted uppercase tracking-widest mb-2 flex items-center gap-1.5"><Tag className="w-2.5 h-2.5 text-primary" strokeWidth={2.5} /> โค้ดส่วนลด (ถ้ามี)</label>
                    {discountInfo ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm"><span className="font-black text-primary">{discountInfo.code}</span><span className="text-foreground-subtle"> โบนัส +฿{discountInfo.discountAmount.toFixed(2)}</span></div>
                        <button type="button" onClick={() => { setDiscountInfo(null); setDiscountCode(''); setDiscountError(''); }} className="text-[11px] font-bold text-error hover:underline">ลบ</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input type="text" value={discountCode} onChange={(e) => { setDiscountCode(e.target.value); setDiscountError(''); }}
                          placeholder="เช่น WELCOME10" className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-foreground focus:outline-none focus:border-primary" disabled={discountChecking} />
                        <button type="button" disabled={discountChecking || !discountCode.trim() || !qrAmount}
                          onClick={async () => {
                            setDiscountChecking(true); setDiscountError('');
                            try {
                              const d = await api<any>('/payment/discount/preview', { method: 'POST', token: getToken()!, body: { code: discountCode.trim(), context: 'topup', amount: qrAmount } });
                              setDiscountInfo({ code: d.code, discountAmount: d.discountAmount });
                            } catch (e: any) { setDiscountError(e?.message || 'โค้ดไม่ถูกต้อง'); } finally { setDiscountChecking(false); }
                          }}
                          className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center">
                          {discountChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : 'ใช้โค้ด'}
                        </button>
                      </div>
                    )}
                    {discountError && <p className="text-[11px] text-error font-bold mt-1.5">{discountError}</p>}
                  </div>

                  <button onClick={handleVerifySlip} disabled={!slipFile || verifying}
                    className="btn-success w-full py-4 text-white font-black text-base shadow-[0_4px_0_#065f46] hover:shadow-[0_2px_0_#065f46] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2">
                    {verifying ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> กำลังตรวจสอบสลิป...</> : <><CheckCheck className="w-4 h-4" strokeWidth={2.25} /> ยืนยันและตรวจสอบสลิป</>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Success */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm w-full p-8 space-y-6 text-center flex-1">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-success/10 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-success flex items-center justify-center text-white shadow-xl mx-auto"><Check className="w-8 h-8" strokeWidth={2.5} /></div>
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-foreground tracking-tight">ทำรายการสำเร็จ!</h2>
                  <p className="text-sm font-bold text-foreground-subtle">ยอดเงินได้รับการเติมเข้า Wallet เรียบร้อยแล้ว</p>
                </div>
                {successMultiplier > 1 ? (
                  <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20 max-w-[260px] mx-auto space-y-2">
                    <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-foreground-subtle">ยอดที่โอน</span><span className="font-black text-foreground-muted">฿{successPaid.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-orange-500 flex items-center gap-1"><Zap className="w-2.5 h-2.5" strokeWidth={2.5} />โบนัส x{successMultiplier}</span><span className="font-black text-orange-500">+฿{(successAmount - successPaid).toLocaleString()}</span></div>
                    <div className="border-t border-orange-500/20 pt-2 flex items-center justify-between"><span className="text-[10px] font-black text-foreground-subtle uppercase tracking-wider">ได้รับเข้า Wallet</span><span className="text-2xl font-black text-orange-600">฿{successAmount.toLocaleString()}</span></div>
                  </div>
                ) : (
                  <div className="bg-surface-hover rounded-xl p-4 border border-border-muted max-w-[200px] mx-auto">
                    <p className="text-[9px] font-black text-foreground-subtle uppercase tracking-widest mb-0.5">จำนวนที่เติมเงิน</p>
                    <p className="text-3xl font-black text-success">฿{successAmount.toLocaleString()}</p>
                  </div>
                )}
                <div className="flex flex-col gap-2.5 max-w-[240px] mx-auto">
                  <button onClick={() => router.push('/shop')} className="btn-primary w-full py-3 text-white font-black text-[13px] shadow-[0_4px_0_rgb(var(--color-primary-muted))] flex items-center justify-center gap-2"><ShoppingCart className="w-3.5 h-3.5" strokeWidth={2.25} /> ไปที่หน้าร้านค้า</button>
                  <button onClick={reset} className="text-[11px] font-black text-foreground-subtle hover:text-primary transition-colors">เติมเงินรายการใหม่</button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
