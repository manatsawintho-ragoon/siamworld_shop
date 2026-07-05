'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import QRCode from 'qrcode';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';

// Used until live package prices load from the backend.
const FALLBACK_PRESETS = [100, 350, 500, 945, 1000, 1785];
type PkgPrice = { months: number; price: number; label: string };
const STEPS = ['เลือกยอด', 'สแกน QR', 'แนบสลิป', 'สำเร็จ'];
const STEP_MAP: Record<string, number> = { amount: 0, qr: 1, slip: 2, done: 3 };

export default function TopupPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'amount' | 'qr' | 'slip' | 'done'>('amount');
  const [qrData, setQrData] = useState<{ payload: string; recipientName: string; recipientId: string } | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [slip, setSlip] = useState<string>('');
  const [slipPreview, setSlipPreview] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newBalance, setNewBalance] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [packages, setPackages] = useState<PkgPrice[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loading && !user) router.push('/?auth=login'); }, [user, loading, router]);

  // Pull live package prices so the quick-select amounts track backend pricing.
  useEffect(() => {
    api.get('/api/subscriptions/packages')
      .then(({ data }) => setPackages(data.packages || []))
      .catch(() => {});
  }, []);

  const redeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setRedeeming(true);
    try {
      const { data } = await api.post('/api/vouchers/redeem', { code: voucherCode.trim() });
      await refreshUser();
      const rewarded = Number(data.amount) || 0;
      toast.success('แลกรับสำเร็จ', `ได้รับเงิน ฿${rewarded.toLocaleString()} เข้ากระเป๋า`);
      setVoucherCode('');
    } catch (e: any) {
      const msg = e.response?.data?.error || 'โค้ดไม่ถูกต้องหรือถูกใช้ไปแล้ว';
      toast.error('ไม่สามารถแลกได้', msg);
    } finally {
      setRedeeming(false);
    }
  };

  const generateQR = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 10) { setError('ยอดขั้นต่ำ 10 บาท'); return; }
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/wallet/topup/qr', { amount: amt });
      setQrData(data);
      const img = await QRCode.toDataURL(data.payload, { width: 280, margin: 2 });
      setQrImage(img);
      setStep('qr');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'ไม่สามารถสร้าง QR Code ได้';
      setError(msg);
      toast.error('สร้าง QR ไม่สำเร็จ', msg);
    } finally { setSubmitting(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        setSlipPreview(compressed);
        setSlip(compressed.split(',')[1] || '');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const submitSlip = async () => {
    if (!slip) { setError('กรุณาแนบสลิปการโอนเงิน'); return; }
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/wallet/topup/slip', { amount: parseFloat(amount), slipBase64: slip });
      setNewBalance(data.balanceAfter);
      await refreshUser();
      setStep('done');
      toast.success('เติมเงินสำเร็จ', `เพิ่ม ฿${parseFloat(amount).toLocaleString()} เข้ากระเป๋าแล้ว`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'ตรวจสอบสลิปไม่สำเร็จ';
      setError(msg);
      toast.error('ตรวจสอบสลิปไม่สำเร็จ', msg);
    } finally { setSubmitting(false); }
  };

  if (loading) return null;

  const currentStepIdx = STEP_MAP[step] ?? 0;

  // Quick-select amounts: round figures interleaved with live package prices.
  const pkgPrice = (m: number) => packages.find(p => p.months === m)?.price;
  const presets = packages.length
    ? [100, pkgPrice(1), 500, pkgPrice(3), 1000, pkgPrice(6)].filter((n): n is number => typeof n === 'number')
    : FALLBACK_PRESETS;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* ── หัวข้อ ── */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-full cursor-pointer h-10 w-10 border-border" asChild>
            <Link href="/dashboard">
              <Icon name="arrow-left" className="text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">เติมเงินเข้ากระเป๋า</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">
              ยอดคงเหลือ: <span className="font-bold text-emerald-600 dark:text-emerald-400">฿{(user?.walletBalance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>

        {/* ── Step Indicator ── */}
        <Card className="shadow-sm border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      i < currentStepIdx
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : i === currentStepIdx
                        ? 'bg-primary/10 border-2 border-primary text-primary'
                        : 'bg-secondary text-muted-foreground'}`}>
                      {i < currentStepIdx ? <Icon name="check" className="text-xs" /> : i + 1}
                    </div>
                    <span className={`text-[11px] mt-2 font-semibold tracking-wide hidden sm:block whitespace-nowrap ${i <= currentStepIdx ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-12 sm:w-20 h-1 mx-3 mb-5 sm:mb-0 rounded-full transition-colors ${i < currentStepIdx ? 'bg-primary' : 'bg-secondary'}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── STEP: สำเร็จ ── */}
        {step === 'done' && (
          <Card className="text-center max-w-md mx-auto shadow-md border-emerald-500/30">
            <CardContent className="p-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mb-6">
                <Icon name="check" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">เติมเงินสำเร็จ!</h2>
              <p className="text-sm text-muted-foreground mb-2">ยอดเงินคงเหลือใหม่</p>
              <p className="text-4xl font-extrabold text-primary mb-8">
                ฿{newBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex w-full gap-3">
                <Button className="flex-1 rounded-full cursor-pointer" variant="outline" onClick={() => { setStep('amount'); setAmount(''); setSlip(''); setSlipPreview(''); }}>
                  <Icon name="plus" className="mr-2" /> เติมอีกครั้ง
                </Button>
                <Button className="flex-1 rounded-full cursor-pointer" asChild>
                  <Link href="/dashboard">
                    <Icon name="gauge-high" className="mr-2" /> แดชบอร์ด
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP: สแกน QR ── */}
        {step === 'qr' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border flex flex-col items-center text-center">
              <CardHeader>
                <CardDescription className="uppercase tracking-widest font-bold">สแกนเพื่อชำระเงิน</CardDescription>
                <CardTitle className="text-4xl font-extrabold text-primary mt-2">฿{parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-6">
                {qrImage && (
                  <div className="p-3 rounded-2xl bg-white border border-border shadow-sm mb-4">
                    <img src={qrImage} alt="QR Code" className="rounded-xl" width={220} />
                  </div>
                )}
                <p className="text-base font-bold text-foreground">{qrData?.recipientName}</p>
                {qrData?.recipientId && <p className="text-xs text-muted-foreground mt-1 font-medium">{qrData.recipientId}</p>}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name="circle-info" />
                  </div>
                  ขั้นตอนการชำระเงิน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {['เปิดแอปพลิเคชันธนาคาร', 'สแกน QR Code ด้านซ้าย', 'ตรวจสอบยอดเงินและยืนยันการโอน', 'บันทึกสลิป แล้วกดปุ่มด้านล่าง'].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground font-medium">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="mt-0.5">{t}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button className="w-full rounded-full cursor-pointer h-12 text-base" onClick={() => setStep('slip')}>
                  <Icon name="image" className="mr-2" /> แนบสลิปการโอน
                </Button>
                <Button className="w-full rounded-full cursor-pointer h-12 text-base" variant="outline" onClick={() => setStep('amount')}>
                  <Icon name="arrow-left" className="mr-2" /> กลับ
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* ── STEP: แนบสลิป ── */}
        {step === 'slip' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name="image" />
                  </div>
                  อัปโหลดสลิปการโอน
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <div
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${slipPreview ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-secondary/50'}`}
                  onClick={() => fileRef.current?.click()}>
                  {slipPreview ? (
                    <img src={slipPreview} alt="slip" className="max-h-52 mx-auto rounded-xl object-contain shadow-sm" />
                  ) : (
                    <div className="py-8">
                      <Icon name="cloud-arrow-up" className="text-4xl text-primary/40 mb-4 block" />
                      <p className="text-sm font-bold text-foreground">คลิกเพื่ออัปโหลดสลิป</p>
                      <p className="text-xs text-muted-foreground mt-2">รองรับ JPG, PNG</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </div>
                {slipPreview && (
                  <button className="mt-4 w-full text-sm text-destructive hover:text-destructive/80 transition-colors flex items-center justify-center gap-2 font-bold cursor-pointer"
                    onClick={() => { setSlip(''); setSlipPreview(''); }}>
                    <Icon name="trash" /> ลบรูปเพื่อเปลี่ยนใหม่
                  </button>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
                    <Icon name="receipt" />
                  </div>
                  สรุปรายการ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm bg-secondary/30 p-4 rounded-xl border border-border">
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">ยอดที่โอน</span>
                    <span className="text-primary font-bold text-lg">฿{parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-border/50">
                    <span className="text-muted-foreground font-medium">ยอดคงเหลือปัจจุบัน</span>
                    <span className="text-foreground font-semibold">฿{(user?.walletBalance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground font-medium">ยอดรวมหลังเติมเงิน</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                      ฿{((user?.walletBalance || 0) + parseFloat(amount || '0')).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3">
                {error && (
                  <div className="w-full flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 font-semibold mb-2">
                    <Icon name="circle-exclamation" className="flex-shrink-0" />{error}
                  </div>
                )}
                <Button data-track="topup_submit" className="w-full rounded-full cursor-pointer h-12 text-base" onClick={submitSlip} disabled={!slip || submitting}>
                  {submitting ? <><Icon name="spinner" className="mr-2 animate-spin" /> กำลังตรวจสอบ...</> : <><Icon name="shield-check" className="mr-2" /> ยืนยันสลิป</>}
                </Button>
                <Button className="w-full rounded-full cursor-pointer h-12 text-base" variant="outline" onClick={() => setStep('qr')}>
                  <Icon name="arrow-left" className="mr-2" /> กลับ
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* ── STEP: เลือกยอด ── */}
        {step === 'amount' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Quick Select */}
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon name="bolt" />
                    </div>
                    เลือกยอดด่วน
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {presets.map(p => (
                      <button key={p} onClick={() => { setAmount(String(p)); setError(''); }}
                        className={`py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${amount === String(p)
                          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                          : 'bg-background border-border text-foreground hover:border-primary/50 hover:bg-primary/5'}`}>
                        ฿{p.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
                    <Icon name="info-circle" className="text-primary mt-0.5" />
                    <p className="text-xs text-primary/90 font-semibold leading-relaxed">
                      ยอดที่ตรงกับแพ็กเกจ: <br/>
                      {packages.length
                        ? packages.map(p => `฿${p.price.toLocaleString()} (${p.label})`).join(' · ')
                        : '฿350 (1 เดือน), ฿945 (3 เดือน), ฿1,785 (6 เดือน)'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* กรอกยอดเอง */}
              <Card className="shadow-sm border-border flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">ระบุจำนวนเงิน</CardTitle>
                    <Badge variant="secondary" className="font-semibold px-2 py-1">
                      <Icon name="wallet" className="text-primary mr-1.5" /> ฿{(user?.walletBalance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg pointer-events-none">฿</span>
                    <input type="number"
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-4 text-2xl font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground placeholder:text-muted-foreground"
                      placeholder="0"
                      value={amount}
                      onChange={e => { setAmount(e.target.value); setError(''); }}
                      min={10} />
                  </div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-3 flex items-center gap-1.5">
                    <Icon name="circle-info" /> ยอดขั้นต่ำ 10 บาท ต่อครั้ง
                  </p>
                  {error && (
                    <p className="text-xs text-destructive mt-3 flex items-center gap-1.5 font-bold">
                      <Icon name="circle-exclamation" />{error}
                    </p>
                  )}
                  {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) >= 10 && (
                    <div className="flex justify-between items-center text-sm mt-6 p-4 bg-secondary/50 rounded-xl border border-border">
                      <span className="text-muted-foreground font-semibold">ยอดรวมหลังเติม</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                        ฿{((user?.walletBalance || 0) + parseFloat(amount || '0')).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full rounded-full cursor-pointer h-14 text-base shadow-md hover:shadow-lg transition-all"
                    onClick={generateQR}
                    disabled={submitting || !amount || parseFloat(amount) < 10}>
                    {submitting
                      ? <><Icon name="spinner" className="mr-2 animate-spin" /> กำลังสร้าง QR...</>
                      : <><Icon name="qrcode" className="mr-2" /> สร้าง QR Code</>}
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            {/* Redeem Promo Code Section */}
            <Card className="shadow-sm border-emerald-500/20 max-w-2xl mx-auto">
              <CardContent className="p-6">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Icon name="ticket" />
                  </div>
                  แลกโค้ดโปรโมชั่น / Voucher
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Icon name="gift" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text"
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-foreground placeholder:text-muted-foreground uppercase"
                      placeholder="กรอกโค้ดที่นี่"
                      value={voucherCode}
                      onChange={e => setVoucherCode(e.target.value)} />
                  </div>
                  <Button
                    variant="outline"
                    className="sm:w-32 h-[50px] rounded-xl cursor-pointer font-bold border-emerald-500/50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                    onClick={redeemVoucher}
                    disabled={redeeming || !voucherCode}>
                    {redeeming ? <Icon name="spinner" className="animate-spin" /> : 'แลกรับ'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}