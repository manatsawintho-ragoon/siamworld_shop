'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import StatusScreen, { StatusDetailRow } from '@/components/StatusScreen';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';
import { useActiveCampaign } from '@/components/CampaignBanner';
import TopupSummary from '@/components/TopupSummary';
import { toSlipDataUrl } from '@/lib/slipImage';
import {
  Zap, ChevronLeft, QrCode, Store, X, Info, Clock, Hourglass, Lock,
  Loader2, ArrowRight, RefreshCw, UploadCloud, Tag, AlertCircle,
  ShoppingCart, Check, CheckCheck, ImageUp,
} from 'lucide-react';

type Step = 'amount' | 'pay' | 'success';

const QR_TTL_MS = 15 * 60 * 1000;
const AMOUNTS = [50, 100, 200, 300, 500, 1000];

/**
 * Sits on the pay screen alongside both the QR and the slip upload, so it stays
 * on screen for the whole time the player is away in their banking app.
 */
function QrCountdown({ expiresAt, onExpired }: { expiresAt: number; onExpired: () => void }) {
  const calc = useCallback(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)), [expiresAt]);
  const [secs, setSecs] = useState(calc);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    setSecs(calc());
    const t = setInterval(() => {
      const s = calc();
      setSecs(s);
      if (s <= 0 && !firedRef.current) { firedRef.current = true; onExpired(); }
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, calc]);

  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const expired = secs <= 0;
  const urgent  = secs <= 60 && !expired;

  return (
    <div className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
      expired ? 'bg-error/10 border-error/25 text-error' :
      urgent  ? 'bg-orange-500/10 border-orange-500/25 text-orange-700' :
                'bg-blue-500/10 border-blue-500/25 text-blue-600'
    }`}>
      {expired
        ? <Clock className="w-3 h-3 text-error" strokeWidth={2.5} />
        : urgent
          ? <Hourglass className="w-3 h-3 text-orange-500 animate-pulse" strokeWidth={2.5} />
          : <Clock className="w-3 h-3 text-blue-500" strokeWidth={2.5} />}
      {expired ? 'QR หมดอายุแล้ว กดสร้างใหม่ได้เลย' : (
        <>QR หมดอายุใน <span className="tabular-nums font-black ml-1">{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span></>
      )}
    </div>
  );
}

export default function PromptPayTopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const { alert } = useAdminAlert();
  const { settings } = useSettings();
  const campaign = useActiveCampaign();

  const ppEnabled    = settings['promptpay_enabled'] !== 'false';
  const bonusEnabled = (settings['topup_bonus_promptpay_enabled'] ?? settings['topup_bonus_enabled']) === 'true';
  const bonusMultRaw = parseFloat(settings['topup_bonus_promptpay_multiplier'] ?? settings['topup_bonus_multiplier'] ?? '1') || 1;
  const bonusMult    = bonusEnabled && bonusMultRaw > 1 ? bonusMultRaw : 1;
  /* The shop's own logo sits in the middle of the QR. Owner-hosted images (the
     usual case is postimg) do go down, so an unset or failed logo simply leaves
     the QR plain. */
  const shopLogo     = (settings['website_logo_url'] || '').trim();

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);

  // Discount code
  const [discountCode, setDiscountCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<{ code: string; discountAmount: number } | null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);
  const [discountError, setDiscountError] = useState('');

  // QR
  const [qrUrl, setQrUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [qrAmount, setQrAmount]       = useState(0);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrExpired, setQrExpired]     = useState(false);
  const [logoFailed, setLogoFailed]   = useState(false);

  // Slip
  const fileRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile]       = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [slipError, setSlipError]     = useState('');
  const [dragging, setDragging]       = useState(false);
  const [verifying, setVerifying]     = useState(false);

  // Success
  const [successAmount,     setSuccessAmount]     = useState(0);
  const [successPaid,       setSuccessPaid]       = useState(0);
  const [successMultiplier, setSuccessMultiplier] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      alert({ type: 'warning', title: 'กรุณาเข้าสู่ระบบ', message: 'คุณต้องล็อกอินก่อนเติมเงิน' }).then(() => router.push('/'));
    }
  }, [authLoading, user, router]);

  const acceptSlip = useCallback((file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSlipError('รองรับเฉพาะไฟล์รูปภาพเท่านั้น');
      return;
    }
    setSlipError('');
    setSlipFile(file);
    const reader = new FileReader();
    reader.onload = ev => setSlipPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  // Screenshot straight from the clipboard: on desktop banking that is how the
  // slip usually arrives, and it saves a save-then-browse round trip.
  useEffect(() => {
    if (step !== 'pay') return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files || []).find(f => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); acceptSlip(file); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [step, acceptSlip]);

  if (authLoading || !user) return null;

  const selectedAmount = custom ? Math.max(10, Number(custom) || 0) : amount;
  const accent = '#003b80';

  const createQr = async (amt: number) => {
    setLoading(true);
    try {
      const d = await api<any>('/payment/promptpay/create', {
        method: 'POST', token: getToken()!, body: { amount: amt },
      }) as any;
      setRecipientName(d.recipientName || '');
      setQrAmount(d.amount);
      setQrExpired(false);
      setQrExpiresAt(Date.now() + QR_TTL_MS);
      // Level H (30% recovery) because a logo sits over the middle of the code.
      // PromptPay payloads are short, so the extra redundancy costs nothing that
      // matters at this render size.
      const img = await QRCode.toDataURL(d.payload, {
        width: 240, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: accent, light: '#FFFFFF' },
      });
      setQrUrl(img);
      setStep('pay');
    } catch (err: any) {
      await alert({ type: 'error', title: 'เกิดข้อผิดพลาด', message: err?.message || 'ไม่สามารถสร้าง QR Code ได้ กรุณาลองใหม่' });
    } finally { setLoading(false); }
  };

  const handleVerifySlip = async () => {
    if (!slipFile) return;
    setVerifying(true);
    setSlipError('');
    try {
      const base64 = await toSlipDataUrl(slipFile);
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
      setSlipError(err?.message || 'ตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบสลิปแล้วลองใหม่อีกครั้ง');
    } finally { setVerifying(false); }
  };

  const clearSlip = () => { setSlipFile(null); setSlipPreview(''); setSlipError(''); };

  const reset = () => {
    setStep('amount'); setQrUrl(''); setCustom(''); setAmount(100);
    setSuccessMultiplier(1); setSuccessPaid(0);
    setQrExpiresAt(null); setQrExpired(false); setQrAmount(0);
    setDiscountInfo(null); setDiscountCode(''); setDiscountError('');
    clearSlip();
  };

  const goBack = () => {
    if (step === 'amount') router.push('/topup');
    else if (step === 'pay') { clearSlip(); setStep('amount'); }
  };

  /* Discount code block. It lives inside the summary rail because it changes the
     totals printed directly above it. */
  const discountBlock = (
    <div className="border-t border-border-muted pt-3">
      <label className="text-[10px] font-black text-foreground-subtle uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <Tag className="w-2.5 h-2.5 text-primary" strokeWidth={2.5} /> โค้ดส่วนลด (ถ้ามี)
      </label>
      {discountInfo ? (
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] min-w-0">
            <span className="font-black text-primary">{discountInfo.code}</span>
            <span className="text-foreground-subtle"> โบนัส +฿{discountInfo.discountAmount.toFixed(2)}</span>
          </div>
          <button type="button" onClick={() => { setDiscountInfo(null); setDiscountCode(''); setDiscountError(''); }}
            className="text-[11px] font-bold text-error hover:underline flex-shrink-0">ลบ</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input type="text" value={discountCode} onChange={e => { setDiscountCode(e.target.value); setDiscountError(''); }}
            placeholder="เช่น WELCOME10" disabled={discountChecking}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface text-[13px] font-bold text-foreground focus:outline-none focus:border-primary" />
          <button type="button" disabled={discountChecking || !discountCode.trim() || !qrAmount}
            onClick={async () => {
              setDiscountChecking(true); setDiscountError('');
              try {
                const d = await api<any>('/payment/discount/preview', {
                  method: 'POST', token: getToken()!,
                  body: { code: discountCode.trim(), context: 'topup', amount: qrAmount },
                }) as any;
                setDiscountInfo({ code: d.code, discountAmount: d.discountAmount });
              } catch (e: any) { setDiscountError(e?.message || 'โค้ดไม่ถูกต้อง'); } finally { setDiscountChecking(false); }
            }}
            className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-black disabled:opacity-50 flex items-center justify-center flex-shrink-0">
            {discountChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : 'ใช้โค้ด'}
          </button>
        </div>
      )}
      {discountError && <p className="text-[11px] text-error font-bold mt-1.5">{discountError}</p>}
    </div>
  );

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-3 pb-8 font-prompt">

        {/* ── Header ── */}
        <div className="bg-surface border-2 border-primary/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-theme-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goBack} disabled={step === 'success' || verifying || loading} aria-label="ย้อนกลับ"
              className="w-9 h-9 rounded-lg hover:bg-surface-hover border border-transparent hover:border-border flex items-center justify-center transition-all disabled:opacity-0 flex-shrink-0">
              <ChevronLeft className="w-4 h-4 text-foreground-subtle" strokeWidth={2.5} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-foreground leading-none flex items-center gap-2">
                <QrCode className="w-4 h-4 flex-shrink-0" style={{ color: accent }} strokeWidth={2.25} /> เติมเงินผ่าน PromptPay
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                    (step === 'amount' && i === 1) || (step === 'pay' && i === 2) || (step === 'success' && i === 3)
                      ? 'w-6 bg-primary' : 'w-1.5 bg-primary/20'
                  }`} />
                ))}
              </div>
            </div>
          </div>

          {bonusMult > 1 && step !== 'success' && (
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-orange-500 text-white text-[10px] sm:text-[11px] font-black shadow-sm">
              <Zap className="w-3 h-3" strokeWidth={2.5} /> โบนัส x{bonusMult}
            </span>
          )}
        </div>

        {!ppEnabled && step !== 'success' && (
          <div className="bg-surface rounded-xl border-2 border-warning/30 shadow-theme-sm w-full p-8 text-center flex flex-col items-center justify-center gap-3 overlay-in">
            <Store className="w-10 h-10 text-warning" strokeWidth={1.75} />
            <p className="text-sm font-black text-foreground">PromptPay ปิดรับชำระเงินชั่วคราว</p>
            <Link href="/topup" className="btn-primary px-5 py-2.5 text-white font-black text-[13px] rounded-lg">กลับไปเลือกช่องทาง</Link>
          </div>
        )}

        {/* ── STEP 1: Amount ── */}
        {ppEnabled && step === 'amount' && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start dialog-in">
            <div className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-border-muted pb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: accent }}>
                  <QrCode className="w-5 h-5" strokeWidth={2.25} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground leading-none">ระบุจำนวนเงิน</h2>
                  <p className="text-[10px] font-bold text-foreground-subtle uppercase tracking-widest mt-1">ขั้นตอนที่ 1 จาก 2</p>
                </div>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                {AMOUNTS.map(a => {
                  const active = custom === String(a) || (!custom && amount === a);
                  return (
                    <button key={a} onClick={() => { setAmount(a); setCustom(String(a)); }} aria-pressed={active}
                      className={`py-3.5 min-h-[48px] rounded-lg font-black text-sm border-2 transition-all ${
                        active ? 'text-white' : 'bg-surface-hover text-foreground-subtle border-border-muted hover:border-primary/40'
                      }`}
                      style={active ? { backgroundColor: accent, borderColor: accent, boxShadow: '0 3px 0 #002147' } : undefined}>
                      ฿{a.toLocaleString()}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg" style={{ color: accent }}>฿</div>
                <input type="number" inputMode="numeric" value={custom} onChange={e => setCustom(e.target.value)}
                  placeholder="ระบุจำนวนเงินอื่นๆ..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-border-muted bg-surface-hover text-base font-black text-foreground focus:outline-none focus:border-primary transition-all" />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" strokeWidth={2.25} />
                <p className="text-[11px] font-bold text-blue-600">ยอดเติมเงินขั้นต่ำ <span className="font-black text-blue-700">10 บาท</span> ต่อครั้ง</p>
              </div>

              <button onClick={() => createQr(selectedAmount)} disabled={loading || selectedAmount < 10}
                className="btn w-full py-4 rounded-lg text-white font-black text-base shadow-[0_4px_0_#002147] hover:shadow-[0_2px_0_#002147] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                style={{ backgroundColor: accent }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
                ถัดไป: สร้าง QR ชำระเงิน
              </button>
            </div>

            <TopupSummary accent={accent} method="PromptPay" amount={selectedAmount}
              bonusMult={bonusMult} campaign={campaign} walletBalance={user.wallet_balance} />
          </div>
        )}

        {/* ── STEP 2: Pay - QR, countdown and slip upload on one screen ── */}
        {ppEnabled && step === 'pay' && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-3 items-start dialog-in">

            {/* QR + countdown */}
            <div className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm p-4 sm:p-6 flex flex-col items-center gap-3.5">
              <div className="text-center">
                <h2 className="text-xl font-black leading-none" style={{ color: accent }}>สแกนเพื่อชำระเงิน</h2>
                <p className="text-xs font-bold text-foreground-subtle mt-1.5">สแกน QR ด้วยแอปธนาคาร แล้วแนบสลิปได้ในหน้านี้เลย</p>
              </div>

              <div className={`relative p-4 bg-white border-2 rounded-2xl shadow-sm transition-all ${qrExpired ? 'border-error/30 opacity-50' : 'border-border-muted'}`}>
                {qrUrl
                  ? <img src={qrUrl} alt="PromptPay QR Code" className="w-48 h-48 mx-auto" />
                  : <div className="w-48 h-48 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} strokeWidth={2.5} /></div>}
                {/* No shop logo, or the owner's image host is down: leave the QR
                    plain rather than covering its middle with a placeholder. */}
                {shopLogo && !logoFailed && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 bg-white rounded-xl shadow-md border border-gray-200 flex items-center justify-center overflow-hidden p-1">
                    <img src={shopLogo} alt="" className="w-full h-full object-contain"
                      onError={() => setLogoFailed(true)} />
                  </div>
                )}
                {qrExpired && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                    <div className="text-center">
                      <Clock className="w-8 h-8 text-error mx-auto mb-2" strokeWidth={2} />
                      <p className="text-error font-black text-sm">QR หมดอายุ</p>
                    </div>
                  </div>
                )}
              </div>

              {qrExpiresAt && <QrCountdown expiresAt={qrExpiresAt} onExpired={() => setQrExpired(true)} />}

              <div className="text-center space-y-0.5 bg-blue-500/10 py-2.5 px-6 rounded-lg border border-blue-500/20 w-full">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center justify-center gap-1">
                  <Lock className="w-2.5 h-2.5" strokeWidth={2.5} /> ยอดที่ต้องโอน (ถูกล็อก)
                </p>
                <p className="text-xl font-black" style={{ color: accent }}>฿{qrAmount.toLocaleString()}</p>
                {recipientName && <p className="text-[10px] font-bold text-foreground-subtle">{recipientName}</p>}
              </div>

              {qrExpired ? (
                <button onClick={() => createQr(qrAmount)} disabled={loading}
                  className="btn w-full py-3.5 rounded-lg bg-error text-white font-black text-sm shadow-[0_4px_0_rgb(0_0_0/0.2)] hover:brightness-110 hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} />}
                  สร้าง QR ใหม่
                </button>
              ) : (
                <p className="text-[10px] font-bold text-foreground-subtle text-center leading-relaxed max-w-xs">
                  แอปธนาคารจะกรอกยอด <b className="text-foreground-muted">฿{qrAmount.toLocaleString()}</b> ให้อัตโนมัติ และแก้ไขไม่ได้
                </p>
              )}
            </div>

            {/* Slip upload + summary */}
            <div className="space-y-3">
              <div className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-black text-foreground leading-none">แนบสลิปการโอน</h3>
                  <p className="text-[10px] font-bold text-foreground-subtle mt-1.5">ลากรูปมาวาง กด Ctrl+V หรือเลือกไฟล์</p>
                </div>

                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { acceptSlip(e.target.files?.[0]); e.target.value = ''; }} />

                {slipPreview ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-border-muted bg-surface-hover p-2.5">
                    <img src={slipPreview} alt="สลิปที่แนบ" className="w-full max-h-[200px] object-contain mx-auto" />
                    <button onClick={clearSlip} aria-label="ลบสลิป"
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-surface text-error shadow-md flex items-center justify-center hover:bg-error hover:text-white transition-all">
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); acceptSlip(e.dataTransfer.files?.[0]); }}
                    className={`w-full py-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2.5 transition-all ${
                      dragging ? 'border-primary bg-primary/10' : 'border-border bg-surface-hover hover:border-primary'
                    }`}>
                    <div className="w-11 h-11 rounded-lg bg-surface border border-border-muted flex items-center justify-center shadow-sm">
                      {dragging
                        ? <ImageUp className="w-5 h-5 text-primary" strokeWidth={2} />
                        : <UploadCloud className="w-5 h-5 text-primary" strokeWidth={2} />}
                    </div>
                    <div className="text-center px-3">
                      <p className="font-black text-foreground-muted uppercase tracking-widest text-[11px]">เลือกรูปภาพสลิป</p>
                      <p className="text-[9px] font-bold text-foreground-subtle mt-1">รองรับรูปจากแกลเลอรีหรือภาพหน้าจอ</p>
                    </div>
                  </button>
                )}

                {/* By this point the player has already transferred real money,
                    so a bare red line reads as "my money is gone". The reason
                    from the backend is specific; what was missing was telling
                    them the transfer is not lost and who can fix it. */}
                {slipError && (
                  <div className="bg-error/10 border border-error/25 rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                      <p className="text-[11px] font-bold text-error leading-relaxed">{slipError}</p>
                    </div>
                    <p className="text-[10px] font-bold text-foreground-subtle leading-relaxed pl-[1.375rem]">
                      เงินที่โอนไปแล้วไม่ได้หายไปไหน อัปโหลดสลิปใหม่ให้ชัดเจนอีกครั้ง หรือแจ้งแอดมินพร้อมสลิปเพื่อเติมให้ด้วยมือ
                    </p>
                  </div>
                )}

                <button onClick={handleVerifySlip} disabled={!slipFile || verifying}
                  className="btn-success w-full py-3.5 rounded-lg text-white font-black text-sm shadow-[0_4px_0_#065f46] hover:shadow-[0_2px_0_#065f46] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2">
                  {verifying
                    ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> กำลังตรวจสอบสลิป...</>
                    : <><CheckCheck className="w-4 h-4" strokeWidth={2.25} /> ยืนยันและตรวจสอบสลิป</>}
                </button>
              </div>

              <TopupSummary accent={accent} method="PromptPay" amount={qrAmount || selectedAmount}
                bonusMult={bonusMult} campaign={campaign} walletBalance={user.wallet_balance}>
                {discountBlock}
              </TopupSummary>
            </div>
          </div>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 'success' && (
          <div className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm w-full p-5 sm:p-8 dialog-in">
            <StatusScreen
              compact
              variant="success"
              title="ทำรายการสำเร็จ!"
              description="ยอดเงินได้รับการเติมเข้า Wallet เรียบร้อยแล้ว"
              detail={
                successMultiplier > 1 ? (
                  /* Bonus top-ups keep their own breakdown: the amount transferred
                     and the amount credited differ, and hiding that difference is
                     what makes players think they were charged wrong. */
                  <>
                    <StatusDetailRow label="ยอดที่โอน" value={`฿${successPaid.toLocaleString()}`} />
                    <StatusDetailRow
                      label={`โบนัส x${successMultiplier}`}
                      value={`+฿${(successAmount - successPaid).toLocaleString()}`}
                    />
                    <div className="border-t border-border-muted pt-2 mt-2">
                      <StatusDetailRow
                        label="ได้รับเข้า Wallet"
                        value={`฿${successAmount.toLocaleString()}`}
                        strong
                      />
                    </div>
                  </>
                ) : (
                  <StatusDetailRow
                    label="จำนวนที่เติมเงิน"
                    value={`฿${successAmount.toLocaleString()}`}
                    strong
                  />
                )
              }
              actions={
                <>
                  <Link href="/shop" className="btn-primary w-full py-3 text-white font-black text-[13px] shadow-[0_4px_0_rgb(var(--color-primary-muted))] flex items-center justify-center gap-2">
                    <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2.25} /> ไปที่หน้าร้านค้า
                  </Link>
                  <button onClick={reset} className="text-[11px] font-black text-foreground-subtle hover:text-primary transition-colors">
                    เติมเงินรายการใหม่
                  </button>
                </>
              }
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
