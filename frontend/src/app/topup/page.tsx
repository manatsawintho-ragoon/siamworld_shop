'use client';
import { useEffect, useRef, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { useSettings } from '@/context/SettingsContext';

type Step = 'selection' | 'amount' | 'qr' | 'upload' | 'truemoney' | 'success';
type Method = 'promptpay' | 'truemoney' | null;

const AMOUNTS = [50, 100, 200, 300, 500, 1000];

export default function TopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>('selection');
  const [method, setMethod] = useState<Method>(null);
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // QR Data
  const [qrUrl, setQrUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [qrAmount, setQrAmount]           = useState(0);

  // Slip Data
  const fileRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile]       = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [verifying, setVerifying]     = useState(false);

  // TrueMoney Data
  const [giftLink, setGiftLink] = useState('');

  // Success Data
  const [successAmount,     setSuccessAmount]     = useState(0);
  const [successPaid,       setSuccessPaid]       = useState(0);
  const [successMultiplier, setSuccessMultiplier] = useState(1);

  // Bonus settings from public API
  const { settings } = useSettings();
  const bonusEnabled = settings['topup_bonus_enabled'] === 'true';
  const bonusMult    = parseFloat(settings['topup_bonus_multiplier'] || '1') || 1;
  const hasBonus     = bonusEnabled && bonusMult > 1;

  useEffect(() => { if (!authLoading && !user) router.push('/'); }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  const selectedAmount = custom ? Math.max(1, Number(custom)) : amount;

  // Handlers
  const handleSelectMethod = (m: Method) => {
    if (m === 'truemoney') return; // Disable selection
    setMethod(m);
    setStep('amount');
  };

  const handleGenerateQR = async () => {
    setError('');
    setLoading(true);
    try {
      const d = await api<any>('/payment/promptpay/create', {
        method: 'POST',
        token: getToken()!,
        body: { amount: selectedAmount },
      }) as any;

      setRecipientName(d.recipientName || '');
      setQrAmount(d.amount);

      const img = await QRCode.toDataURL(d.payload, {
        width: 200, margin: 2,
        color: { dark: '#003b80', light: '#FFFFFF' },
      });
      setQrUrl(img);
      setStep('qr');
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการสร้าง QR Code');
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
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(slipFile);
      });
      const d = await api<any>('/payment/slip/verify', {
        method: 'POST',
        token: getToken()!,
        body: { base64 },
      }) as any;
      setSuccessAmount(d.amount);
      setSuccessPaid(d.paid_amount ?? d.amount);
      setSuccessMultiplier(d.multiplier ?? 1);
      await refresh();
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setVerifying(false);
    }
  };

  const handleRedeemTrueMoney = async () => {
    if (!giftLink) return;
    setLoading(true);
    setError('');
    try {
      const d = await api<any>('/payment/truemoney/redeem', {
        method: 'POST',
        token: getToken()!,
        body: { giftLink },
      }) as any;
      setSuccessAmount(d.amount);
      await refresh();
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'แลกซองของขวัญไม่สำเร็จ กรุณาตรวจสอบลิงก์อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('selection');
    setMethod(null);
    setError('');
    setQrUrl('');
    setSlipFile(null);
    setSlipPreview('');
    setCustom('');
    setAmount(100);
    setGiftLink('');
    setSuccessMultiplier(1);
    setSuccessPaid(0);
  };

  const goBack = () => {
    if (step === 'amount' || step === 'truemoney') setStep('selection');
    else if (step === 'qr') setStep('amount');
    else if (step === 'upload') setStep('qr');
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-3 pb-8 font-prompt">

        {/* ── Bonus Promo Banner ── */}
        <AnimatePresence>
          {hasBonus && (
            <motion.div
              key="bonus-banner"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="relative bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl overflow-hidden shadow-[0_4px_0_#c2410c,0_2px_20px_rgba(249,115,22,0.4)]"
            >
              {/* decorative glow */}
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-black/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex items-center gap-4 px-5 py-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <i className="fas fa-bolt text-white text-lg" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-0.5">โปรโมชั่นพิเศษ</p>
                  <h3 className="text-lg font-black text-white leading-tight">
                    เติมเงินวันนี้ ได้รับโบนัส
                    <span className="ml-2 text-2xl text-yellow-200 drop-shadow">x{bonusMult}</span>
                  </h3>
                  <p className="text-[11px] text-white/80 font-bold mt-0.5">
                    เติม ฿100 → ได้รับ ฿{(100 * bonusMult).toLocaleString()} เข้า Wallet ทันที
                  </p>
                </div>

                {/* Multiplier badge */}
                <div className="flex-shrink-0 text-center bg-white/20 border border-white/30 rounded-xl px-4 py-2">
                  <p className="text-[9px] font-black text-white/70 uppercase tracking-wider">คูณเงิน</p>
                  <p className="text-3xl font-black text-white leading-none">x{bonusMult}</p>
                </div>
              </div>

              {/* Mini table row preview */}
              <div className="relative border-t border-white/20 bg-black/10 px-5 py-2 flex items-center gap-4 overflow-x-auto">
                <span className="text-[10px] font-black text-white/60 uppercase tracking-wider flex-shrink-0">ตัวอย่าง</span>
                {[50, 100, 200, 500].map(a => (
                  <span key={a} className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] font-bold text-white/80">฿{a}</span>
                    <i className="fas fa-arrow-right text-[8px] text-white/50" />
                    <span className="text-[12px] font-black text-yellow-200">฿{(a * bonusMult).toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress Header (Removed Balance) ── */}
        <div className="bg-white border-2 border-green-200 rounded-xl p-3 flex items-center shadow-theme-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={goBack}
              disabled={step === 'selection' || step === 'success' || verifying || loading}
              className="w-9 h-9 rounded-lg hover:bg-green-50 border border-transparent hover:border-green-200 flex items-center justify-center transition-all disabled:opacity-0"
            >
              <i className="fas fa-chevron-left text-gray-500"></i>
            </button>
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-none">เติมเงินเข้าระบบ</h1>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                    (step === 'selection' && i === 1) ||
                    ((step === 'amount' || step === 'truemoney') && i === 2) ||
                    ((step === 'qr' || step === 'upload') && i === 3) ||
                    (step === 'success' && i === 4)
                    ? 'w-6 bg-primary' : 'w-1.5 bg-green-100'
                  }`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div className="min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: Selection */}
            {step === 'selection' && (
              <motion.div 
                key="selection" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full"
              >
                {/* PromptPay Card */}
                <button 
                  onClick={() => handleSelectMethod('promptpay')} 
                  className="group relative bg-white rounded-2xl border-2 border-green-200 overflow-hidden flex flex-col shadow-theme-sm hover:border-[#003b80] hover:shadow-lg transition-all duration-300 text-center h-[280px]"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i className="fas fa-qrcode text-7xl text-[#003b80]"></i>
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#003b80]/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                      <img 
                        src="/images/thai_qr_payment.png" 
                        alt="PromptPay" 
                        className="relative h-20 w-auto object-contain transform group-hover:scale-105 transition-transform duration-300" 
                      />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-[#003b80]">PromptPay</h3>
                      <p className="text-xs font-bold text-gray-500 leading-tight">
                        สแกนจ่ายผ่าน QR Code<br/>
                        <span className="text-[9px] uppercase tracking-wider opacity-60">รองรับทุกแอปธนาคาร</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-[#003b80] py-3.5 text-white font-black text-[11px] uppercase tracking-widest group-hover:bg-[#004ba3] transition-colors flex items-center justify-center gap-2">
                    เลือกช่องทางนี้ 
                    <i className="fas fa-chevron-right text-[9px] group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </button>

                {/* TrueMoney Card (Disabled Version) */}
                <div className="group relative bg-gray-50 rounded-2xl border-2 border-gray-200 overflow-hidden flex flex-col shadow-sm grayscale opacity-70 text-center h-[280px] cursor-not-allowed">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <i className="fas fa-wallet text-7xl text-gray-400"></i>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative z-10">
                    <img 
                      src="/images/truemoney_wallet.png" 
                      alt="TrueMoney" 
                      className="relative h-16 w-auto object-contain" 
                    />
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-gray-500">TrueMoney Wallet</h3>
                      <p className="text-xs font-bold text-gray-400 leading-tight">
                        เติมผ่านซองของขวัญ<br/>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">ยังไม่เปิดใช้งาน (เร็วๆ นี้)</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-300 py-3.5 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2">
                    ไม่พร้อมใช้งาน
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: TrueMoney Input */}
            {step === 'truemoney' && (
              <motion.div 
                key="truemoney" 
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="bg-white rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-6 space-y-4 flex-1"
              >
                <div className="flex items-center gap-3 border-b border-green-100 pb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#ed1c24] text-white">
                    <i className="fas fa-gift text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 leading-none">ส่งซองของขวัญ</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">ขั้นตอนที่ 2: วางลิงก์ซองของขวัญที่นี่</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ed1c24]">
                      <i className="fas fa-link text-lg"></i>
                    </div>
                    <input 
                      type="text" 
                      value={giftLink} 
                      onChange={e => setGiftLink(e.target.value)}
                      placeholder="วางลิงก์ซองของขวัญที่นี่..." 
                      className="w-full pl-12 pr-4 py-3.5 rounded-lg border-2 border-green-100 bg-gray-50 text-sm font-bold focus:outline-none focus:border-[#ed1c24] transition-all" 
                    />
                  </div>

                  <div className="bg-red-50/50 border border-dashed border-red-200 rounded-xl p-4">
                    <h4 className="text-[11px] font-black text-[#ed1c24] mb-2 flex items-center gap-2">
                      <i className="fas fa-info-circle"></i>
                      วิธีเติมเงินผ่านซองของขวัญ
                    </h4>
                    <ol className="text-[10px] font-bold text-gray-500 space-y-1 list-decimal ml-4 leading-relaxed">
                      <li>เข้าแอป TrueMoney Wallet</li>
                      <li>ไปที่เมนู <span className="text-gray-900">"ส่งซองของขวัญ"</span></li>
                      <li>สร้างซอง <span className="text-gray-900">"แบ่งจำนวนเงินเท่ากัน"</span> และเลือกผู้รับ <span className="text-gray-900">1 คน</span></li>
                      <li>คัดลอกลิงก์ซองของขวัญมาวางในช่องด้านบน</li>
                    </ol>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-[11px] font-bold flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    {error}
                  </div>
                )}

                <button 
                  onClick={handleRedeemTrueMoney} 
                  disabled={loading || !giftLink.includes('truemoney.com')}
                  className="btn w-full py-4 rounded-lg bg-[#ed1c24] text-white font-black text-sm shadow-[0_4px_0_#991b1b] hover:shadow-[0_2px_0_#991b1b] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                >
                  {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-check-circle mr-2"></i>}
                  ยืนยันการแลกซองของขวัญ
                </button>
              </motion.div>
            )}

            {/* STEP 2: Amount Input (for PromptPay) */}
            {step === 'amount' && (
              <motion.div 
                key="amount" 
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="bg-white rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-6 space-y-4 flex-1"
              >
                <div className="flex items-center gap-3 border-b border-green-100 pb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#003b80] text-white">
                    <i className="fas fa-qrcode text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 leading-none">ระบุจำนวนเงิน</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">ขั้นตอนที่ 2: เลือกจำนวนพอยท์ที่ต้องการ</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {AMOUNTS.map(a => (
                    <button key={a} onClick={() => { setAmount(a); setCustom(''); }}
                      className={`py-3 rounded-lg font-black text-sm border-2 transition-all ${!custom && amount === a
                        ? 'bg-[#003b80] text-white border-[#003b80] shadow-[0_3px_0_#002147]'
                        : 'bg-gray-50 text-gray-500 border-green-100 hover:border-green-300'
                      }`}>
                      ฿{a.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg text-[#003b80]">฿</div>
                  <input type="number" value={custom} onChange={e => setCustom(e.target.value)}
                    placeholder="ระบุจำนวนเงินอื่นๆ..." className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-green-100 bg-gray-50 text-base font-black focus:outline-none focus:border-[#003b80] transition-all" />
                </div>

                {hasBonus ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">ยอดที่โอน</p>
                        <p className="text-xl font-black text-gray-600">฿{selectedAmount.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-center px-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                          <i className="fas fa-times text-white text-xs" />
                        </div>
                        <span className="text-[10px] font-black text-orange-600 mt-1">x{bonusMult}</span>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-0.5">ได้รับเข้า Wallet</p>
                        <p className="text-2xl font-black text-orange-600">฿{(selectedAmount * bonusMult).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-orange-200 text-center">
                      <span className="text-[10px] font-black text-orange-500">
                        <i className="fas fa-bolt mr-1" />โบนัส +฿{(selectedAmount * (bonusMult - 1)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-dashed border-green-200 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">ยอดชำระสุทธิ</p>
                    <p className="text-2xl font-black text-[#003b80]">฿{selectedAmount.toLocaleString()}</p>
                  </div>
                )}

                <button onClick={handleGenerateQR} disabled={loading || selectedAmount < 1}
                  className="btn-primary w-full py-4 text-white font-black text-base bg-[#003b80] shadow-[0_4px_0_#002147] hover:shadow-[0_2px_0_#002147] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] disabled:translate-y-0 disabled:shadow-none">
                  {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-check-circle mr-2"></i>}
                  ถัดไป: สร้างรายการชำระเงิน
                </button>
              </motion.div>
            )}

            {/* STEP 3: QR Display */}
            {step === 'qr' && (
              <motion.div 
                key="qr" 
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-6 space-y-4 flex-1 flex flex-col items-center"
              >
                <div className="text-center">
                  <h2 className="text-xl font-black text-[#003b80] leading-none">แสกนชำระเงิน</h2>
                  <p className="text-xs font-bold text-gray-400 mt-1">สแกน QR Code ด้วยแอปธนาคารของคุณ</p>
                </div>

                <div className="relative p-4 bg-white border-2 border-green-100 rounded-2xl shadow-sm">
                  {qrUrl ? <img src={qrUrl} alt="QR Code" className="w-44 h-44 mx-auto" /> : <div className="w-44 h-44 flex items-center justify-center"><i className="fas fa-circle-notch fa-spin text-2xl text-[#003b80]"></i></div>}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-lg shadow-md border border-gray-100 flex items-center justify-center">
                    <img src="/images/thai_qr_payment.png" className="w-5 h-auto" />
                  </div>
                </div>

                <div className="text-center space-y-0.5 bg-gray-50 py-2.5 px-8 rounded-lg border border-green-100">
                  <p className="text-xl font-black text-[#003b80]">฿{qrAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-500">{recipientName}</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5 max-w-sm">
                  <i className="fas fa-info-circle text-amber-500 mt-0.5 text-xs"></i>
                  <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                    เมื่อโอนเงินสำเร็จแล้ว กรุณากดปุ่ม <b>"โอนเงินแล้ว (แจ้งสลิป)"</b> เพื่ออัปโหลดสลิปและรับพอยท์
                  </p>
                </div>

                <button onClick={() => setStep('upload')} className="btn w-full py-4 bg-[#003b80] text-white font-black text-sm shadow-[0_4px_0_#002147] hover:shadow-[0_2px_0_#002147] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] flex items-center justify-center gap-2">
                  <i className="fas fa-file-invoice-dollar text-xs"></i>
                  โอนเงินแล้ว (แจ้งสลิป)
                </button>
              </motion.div>
            )}

            {/* STEP 4: Slip Upload */}
            {step === 'upload' && (
              <motion.div 
                key="upload" 
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="bg-white rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-6 space-y-4 flex-1"
              >
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-gray-900 leading-none">อัปโหลดหลักฐานสลิป</h2>
                  <p className="text-xs font-bold text-gray-400">อัปโหลดสลิปเพื่อให้ระบบตรวจสอบความถูกต้อง</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-[11px] font-bold flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSlipSelect} />
                  
                  {slipPreview ? (
                    <div className="relative group rounded-xl overflow-hidden border-2 border-green-100 bg-gray-50 p-3">
                      <img src={slipPreview} alt="slip" className="w-full max-h-[220px] object-contain mx-auto" />
                      <button onClick={() => { setSlipFile(null); setSlipPreview(''); }} className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white text-red-500 shadow-md flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                        <i className="fas fa-times text-xs"></i>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full py-10 border-2 border-dashed border-green-200 rounded-2xl bg-gray-50 flex flex-col items-center justify-center gap-3 group hover:border-primary transition-all">
                      <div className="w-12 h-12 rounded-lg bg-white border border-green-100 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                        <i className="fas fa-cloud-upload-alt text-xl text-primary"></i>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-gray-700 uppercase tracking-widest text-[11px]">เลือกรูปภาพสลิป</p>
                        <p className="text-[9px] font-bold text-gray-400 mt-1">กดเพื่อเลือกไฟล์สลิปจากเครื่องของคุณ</p>
                      </div>
                    </button>
                  )}

                  <button onClick={handleVerifySlip} disabled={!slipFile || verifying}
                    className="btn-success w-full py-4 text-white font-black text-base shadow-[0_4px_0_#065f46] hover:shadow-[0_2px_0_#065f46] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] disabled:translate-y-0 disabled:shadow-none">
                    {verifying ? <><i className="fas fa-circle-notch fa-spin mr-2"></i> กำลังตรวจสอบสลิป...</> : <><i className="fas fa-check-double mr-2"></i> ยืนยันและตรวจสอบสลิป</>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: Success */}
            {step === 'success' && (
              <motion.div 
                key="success" 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-8 space-y-6 text-center flex-1"
              >
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-green-500/10 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-success flex items-center justify-center text-white shadow-xl mx-auto">
                    <i className="fas fa-check text-3xl"></i>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">ทำรายการสำเร็จ!</h2>
                  <p className="text-sm font-bold text-gray-500">ยอดเงินได้รับการเติมเข้า Wallet เรียบร้อยแล้ว</p>
                </div>

                {successMultiplier > 1 ? (
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 max-w-[260px] mx-auto space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-400">ยอดที่โอน</span>
                      <span className="font-black text-gray-600">฿{successPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-orange-500"><i className="fas fa-bolt mr-1" />โบนัส x{successMultiplier}</span>
                      <span className="font-black text-orange-500">+฿{(successAmount - successPaid).toLocaleString()}</span>
                    </div>
                    <div className="border-t border-orange-200 pt-2 flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">ได้รับเข้า Wallet</span>
                      <span className="text-2xl font-black text-orange-600">฿{successAmount.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 border border-green-100 max-w-[200px] mx-auto">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">จำนวนที่เติมเงิน</p>
                    <p className="text-3xl font-black text-success">฿{successAmount.toLocaleString()}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 max-w-[240px] mx-auto">
                  <button onClick={() => router.push('/shop')} className="btn-primary w-full py-3 text-white font-black text-[13px] shadow-[0_4px_0_rgb(var(--color-primary-muted))]">
                    <i className="fas fa-shopping-cart mr-2"></i> ไปที่หน้าร้านค้า
                  </button>
                  <button onClick={reset} className="text-[11px] font-black text-gray-400 hover:text-primary transition-colors">
                    เติมเงินรายการใหม่
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </MainLayout>
  );
}
