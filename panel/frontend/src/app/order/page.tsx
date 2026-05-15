'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Package { months: number; price: number; label: string; save: number; kind?: 'regular' | 'trial' | 'intro' }
interface Promo {
  kind: 'trial' | 'intro';
  months: number;
  days?: number;
  price: number;
  label: string;
  regularPrice: number;
}
type OrderKind = 'regular' | 'trial' | 'intro';

function OrderContent() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initKindParam = searchParams.get('kind');
  const initKind: OrderKind = (initKindParam === 'trial' || initKindParam === 'intro') ? initKindParam : 'regular';
  const initMonths = parseInt(searchParams.get('months') || '1');

  const [orderKind, setOrderKind] = useState<OrderKind>(initKind);
  const [packages, setPackages] = useState<Package[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [easyslipFee, setEasyslipFee] = useState<number>(0.396);
  const [selectedMonths, setSelectedMonths] = useState(initMonths);
  const [shopName, setShopName] = useState('');
  const [mcIp, setMcIp] = useState('');
  const [mcIpError, setMcIpError] = useState('');
  const [hasPublicIp, setHasPublicIp] = useState<'yes' | 'no' | null>(null);
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [usedTrial, setUsedTrial] = useState(false);
  const [usedIntro, setUsedIntro] = useState(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/?auth=login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/api/subscriptions/packages'),
      api.get('/api/subscriptions'),
    ]).then(([pkgRes, subRes]) => {
      setPackages(pkgRes.data.packages || []);
      if (pkgRes.data.promos) setPromos(pkgRes.data.promos);
      if (typeof pkgRes.data.easyslipFee === 'number') setEasyslipFee(pkgRes.data.easyslipFee);
      setUsedTrial(!!subRes.data.usedTrial);
      setUsedIntro(!!subRes.data.usedIntro);
    }).catch(() => {}).finally(() => setEligibilityLoaded(true));
  }, [user]);

  const trialPromo = promos.find(p => p.kind === 'trial');
  const introPromo = promos.find(p => p.kind === 'intro');

  const selectedPkg = packages.find(p => p.months === selectedMonths);
  const balance = user?.walletBalance || 0;
  const price = orderKind === 'trial'
    ? 0
    : orderKind === 'intro'
      ? (introPromo?.price || 99)
      : (selectedPkg?.price || 0);
  const insufficient = price > 0 && balance < price;
  const orderLabel = orderKind === 'trial'
    ? `ทดลองฟรี ${trialPromo?.days || 7} วัน`
    : orderKind === 'intro'
      ? `เดือนแรกพิเศษ ฿${introPromo?.price || 99}`
      : (selectedPkg?.label || '—');

  const validateName = (v: string) => {
    if (!v) { setNameError('กรุณากรอกชื่อร้าน'); return false; }
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(v)) {
      setNameError('ใช้ตัวพิมพ์เล็ก a-z, 0-9, ขีด (-) ความยาว 3-30 ตัว');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateMcIp = (v: string) => {
    if (!v) { setMcIpError('กรุณากรอก IP ของ Minecraft Server'); return false; }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) {
      setMcIpError('รูปแบบ IP ไม่ถูกต้อง เช่น 1.2.3.4');
      return false;
    }
    setMcIpError('');
    return true;
  };

  const handleOrder = async () => {
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { shopName, mcIp, kind: orderKind };
      if (orderKind === 'regular') body.packageMonths = selectedMonths;
      if (orderKind === 'intro')   body.packageMonths = 1;
      await api.post('/api/subscriptions', body);
      await refreshUser();
      setStep('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'เกิดข้อผิดพลาด');
      setStep('form');
    } finally { setSubmitting(false); }
  };

  if (loading || !eligibilityLoaded) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <i className="fas fa-spinner fa-spin text-3xl text-primary" />
    </div>
  );

  if (orderKind === 'trial' && usedTrial) return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-20 h-20 rounded-[2rem] bg-secondary border-2 border-border text-muted-foreground flex items-center justify-center mx-auto text-3xl mb-6">
          <i className="fas fa-check" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight">ใช้สิทธิ์ทดลองฟรีไปแล้ว</h2>
        <p className="text-sm text-muted-foreground font-semibold mb-8 leading-relaxed">
          สิทธิ์ทดลองใช้งานฟรีใช้ได้ครั้งเดียวต่อบัญชี<br/>
          คุณสามารถเลือกซื้อแพ็กเกจปกติได้
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {introPromo && !usedIntro && (
            <Button className="rounded-full px-8 h-12 font-bold" onClick={() => setOrderKind('intro')}>
              <i className="fas fa-tag mr-2" /> เดือนแรก ฿{introPromo.price}
            </Button>
          )}
          <Button variant="secondary" className="rounded-full px-8 h-12 font-bold border border-border" onClick={() => setOrderKind('regular')}>
            <i className="fas fa-box-open mr-2" /> ซื้อแพ็กเกจปกติ
          </Button>
        </div>
      </div>
    </div>
  );

  if (orderKind === 'intro' && usedIntro) return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-20 h-20 rounded-[2rem] bg-secondary border-2 border-border text-muted-foreground flex items-center justify-center mx-auto text-3xl mb-6">
          <i className="fas fa-check" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight">ใช้โปรเดือนแรกไปแล้ว</h2>
        <p className="text-sm text-muted-foreground font-semibold mb-8 leading-relaxed">
          โปรโมชั่นเดือนแรกใช้ได้ครั้งเดียวต่อบัญชี<br/>
          คุณสามารถเลือกซื้อแพ็กเกจปกติได้
        </p>
        <Button variant="secondary" className="rounded-full px-8 h-12 font-bold border border-border" onClick={() => setOrderKind('regular')}>
          <i className="fas fa-box-open mr-2" /> ซื้อแพ็กเกจปกติ
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" className="rounded-full cursor-pointer h-10 w-10 border-border" asChild>
            <button onClick={() => router.back()}>
              <i className="fas fa-arrow-left text-muted-foreground" />
            </button>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight">สั่งซื้อ <span className="text-primary">แพ็กเกจ</span></h1>
            <p className="text-sm text-muted-foreground font-medium">เลือกแพ็กเกจและตั้งชื่อร้านของคุณ</p>
          </div>
        </div>

        {step === 'done' ? (
          <Card className="text-center max-w-lg mx-auto shadow-lg border-primary/50 bg-primary/5">
            <CardContent className="p-10 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-4xl mb-6">
                <i className="fas fa-rocket animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">ส่งคำสั่งซื้อสำเร็จ!</h2>
              <p className="text-sm text-muted-foreground mb-8 leading-relaxed font-semibold">
                ระบบกำลังดำเนินการติดตั้งร้านค้าของคุณ<br/>
                ใช้เวลาประมาณ 5-10 นาที
              </p>
              <Button className="w-full rounded-full cursor-pointer h-12 text-base shadow-sm" asChild>
                <Link href="/dashboard">
                  <i className="fas fa-gauge-high mr-2" /> เข้าสู่แดชบอร์ด
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : step === 'confirm' ? (
          <Card className="max-w-xl mx-auto shadow-md border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <i className="fas fa-clipboard-check" />
                </div>
                ยืนยันการสั่งซื้อ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-secondary/50 rounded-2xl p-5 space-y-4 mb-6 border border-border">
                {[
                  { label: 'ชื่อร้านค้า',   value: shopName, icon: 'fa-store' },
                  { label: 'โดเมน',     value: `${shopName}.siamsite.shop`, icon: 'fa-globe' },
                  { label: 'แพ็กเกจ',    value: orderLabel, icon: 'fa-box-open' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center pb-2 border-b border-border/50 last:border-0 last:pb-0">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <i className={`fas ${row.icon} text-primary/70`} /> {row.label}
                    </span>
                    <span className="text-sm font-bold text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-4 mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ยอดชำระทั้งสิ้น</span>
                    <span className="text-2xl font-extrabold text-primary">฿{price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">คงเหลือหลังชำระ</span>
                    <span className={`text-sm font-bold ${balance - price < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                      ฿{(balance - price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1 rounded-full cursor-pointer h-12 font-bold" onClick={() => setStep('form')} disabled={submitting}>
                ย้อนกลับ
              </Button>
              <Button className="flex-1 rounded-full cursor-pointer h-12 font-bold shadow-sm hover:shadow-md transition-all" onClick={handleOrder} disabled={submitting}>
                {submitting ? <><i className="fas fa-spinner fa-spin mr-2" /> กำลังดำเนินการ...</> : 'ยืนยันและชำระเงิน'}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
            <div className="space-y-6">
              {orderKind !== 'regular' && (
                <Card className={`border ${orderKind === 'trial' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-primary/50 bg-primary/5'}`}>
                  <CardContent className="p-5 flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-sm flex-shrink-0 ${orderKind === 'trial' ? 'bg-emerald-500' : 'bg-primary'}`}>
                      <i className={`fas ${orderKind === 'trial' ? 'fa-rocket' : 'fa-tag'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        โปรโมชั่นที่เลือก
                      </p>
                      <p className="text-sm font-extrabold text-foreground truncate">
                        {orderKind === 'trial'
                          ? `ทดลองฟรี ${trialPromo?.days || 7} วัน · ฿0`
                          : `เดือนแรกพิเศษ ฿${introPromo?.price || 99} (ปกติ ฿${introPromo?.regularPrice || 350})`}
                      </p>
                    </div>
                    <button
                      onClick={() => setOrderKind('regular')}
                      className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer flex-shrink-0 underline"
                    >
                      เปลี่ยนเป็นปกติ
                    </button>
                  </CardContent>
                </Card>
              )}

              {orderKind === 'regular' && (
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <i className="fas fa-box-open" />
                    </div>
                    1. เลือกแพ็กเกจ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {packages.map((pkg) => {
                      const active = selectedMonths === pkg.months;
                      const discountPercent = pkg.save > 0 ? Math.round((pkg.save / (pkg.price + pkg.save)) * 100) : 0;
                      return (
                        <div
                          key={pkg.months}
                          onClick={() => setSelectedMonths(pkg.months)}
                          className={`relative p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer flex flex-col items-center
                            ${active 
                              ? 'bg-primary border-primary text-primary-foreground shadow-md scale-[1.02]' 
                              : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5'}`}
                        >
                          {discountPercent > 0 && (
                            <div className={`absolute -top-2.5 -right-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shadow-sm
                              ${active ? 'bg-white text-primary' : 'bg-destructive text-white'}`}>
                              ลด {discountPercent}%
                            </div>
                          )}
                          <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${active ? 'text-primary-foreground' : 'text-foreground'}`}>
                            {pkg.label}
                          </div>
                          <div className={`text-2xl font-extrabold ${active ? 'text-white' : 'text-primary'}`}>
                            ฿{pkg.price.toLocaleString()}
                          </div>
                          {pkg.save > 0 ? (
                            <Badge variant={active ? "outline" : "success"} className={`mt-2 text-[10px] ${active ? 'border-white/40 bg-transparent text-white' : ''}`}>
                              ประหยัด ฿{pkg.save.toLocaleString()}
                            </Badge>
                          ) : <div className="h-[24px] mt-2" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}

              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
                      <i className="fas fa-store" />
                    </div>
                    {orderKind === 'regular' ? '2.' : '1.'} ตั้งชื่อร้านค้า
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Subdomain ของร้าน</label>
                    <div className="relative">
                      <i className="fas fa-link absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3.5 text-base font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-foreground placeholder:text-muted-foreground lowercase"
                        placeholder="เช่น: mchanom"
                        value={shopName}
                        onChange={e => {
                          setShopName(e.target.value.toLowerCase());
                          validateName(e.target.value.toLowerCase());
                        }}
                      />
                    </div>
                    {nameError && (
                      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                        <i className="fas fa-triangle-exclamation flex-shrink-0" /> {nameError}
                      </div>
                    )}
                    <div className="mt-3 bg-secondary/50 rounded-xl p-4 border border-border flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-primary shadow-sm border border-border flex-shrink-0">
                        <i className="fas fa-globe text-lg" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">ที่อยู่ร้านค้า (URL)</p>
                        <p className="text-sm font-bold text-foreground truncate tracking-tight lowercase">
                          {shopName ? shopName : '...'}
                          <span className="text-primary">.siamsite.shop</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                      IP ของ Minecraft Server <span className="text-destructive">*</span>
                    </label>

                    {/* Connection wizard */}
                    {hasPublicIp === null && (
                      <div className="mb-4 p-5 rounded-2xl border border-primary/20 bg-primary/5">
                        <p className="text-sm font-bold text-foreground mb-4 flex items-center">
                          <i className="fas fa-circle-question mr-2 text-primary text-lg" /> เซิร์ฟเวอร์ของคุณมี IP สาธารณะหรือไม่?
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Button variant="default" onClick={() => setHasPublicIp('yes')} className="h-12 font-bold cursor-pointer rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                            <i className="fas fa-check mr-2" /> มี (VPS / Dedicated)
                          </Button>
                          <Button variant="outline" onClick={() => setHasPublicIp('no')} className="h-12 font-bold cursor-pointer rounded-xl hover:bg-secondary">
                            <i className="fas fa-question mr-2" /> ไม่มี / ไม่แน่ใจ
                          </Button>
                        </div>
                      </div>
                    )}

                    {hasPublicIp === 'no' && (
                      <div className="mb-4 p-5 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-foreground flex items-center">
                            <i className="fas fa-lightbulb mr-2 text-destructive" /> ทางเลือกสำหรับเซิร์ฟเวอร์ที่อยู่หลัง NAT
                          </p>
                          <button onClick={() => setHasPublicIp(null)} className="text-xs font-bold text-muted-foreground hover:text-foreground underline cursor-pointer">เปลี่ยนคำตอบ</button>
                        </div>
                        <ul className="space-y-3 text-xs font-medium text-muted-foreground">
                          <li className="flex gap-3"><i className="fas fa-server text-primary mt-0.5" /><span><b className="text-foreground">เช่า VPS:</b> ย้ายเซิร์ฟเวอร์ไป VPS เพื่อได้ IP สาธารณะถาวร — แนะนำที่สุด</span></li>
                          <li className="flex gap-3"><i className="fas fa-cloud text-primary mt-0.5" /><span><b className="text-foreground">Cloudflare Tunnel:</b> ติดตั้ง cloudflared บนเครื่อง MC ของคุณ และเปิดเส้น TCP กลับมา</span></li>
                          <li className="flex gap-3"><i className="fas fa-house-signal text-primary mt-0.5" /><span><b className="text-foreground">Port Forwarding:</b> ตั้งค่า router ให้ forward port 25565 + RCON ออกอินเทอร์เน็ต</span></li>
                        </ul>
                        <p className="text-xs font-bold text-primary italic border-t border-destructive/10 pt-3">
                          เมื่อพร้อมใช้แล้ว เลือก &quot;มี (VPS / Dedicated)&quot; และกรอก IP เพื่อดำเนินการต่อ
                        </p>
                      </div>
                    )}

                    {hasPublicIp === 'yes' && (
                      <>
                        <input
                          className="w-full px-4 py-3.5 bg-background border border-border rounded-xl text-base font-bold outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground"
                          placeholder="เช่น: 1.2.3.4"
                          value={mcIp}
                          onChange={e => { setMcIp(e.target.value); validateMcIp(e.target.value); }}
                        />
                        {mcIpError && (
                          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                            <i className="fas fa-triangle-exclamation flex-shrink-0" /> {mcIpError}
                          </div>
                        )}
                        {!mcIpError && mcIp && (
                          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                            <i className="fas fa-shield-halved flex-shrink-0" /> ระบบจะอนุญาตเฉพาะ IP นี้เชื่อมต่อ
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side Summary */}
            <div className="lg:sticky lg:top-24 h-fit">
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <i className="fas fa-receipt" />
                    </div>
                    สรุปรายการ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">แพ็กเกจ</span>
                      <span className="text-sm font-bold text-foreground">{orderLabel}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ราคา</span>
                      <span className={`text-xl font-extrabold ${orderKind === 'trial' ? 'text-emerald-500' : 'text-primary'}`}>
                        {orderKind === 'trial' ? 'ฟรี' : `฿${price.toLocaleString()}`}
                      </span>
                    </div>
                    {orderKind !== 'trial' && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">คงเหลือปัจจุบัน</span>
                          <span className="text-sm font-semibold text-foreground">฿{balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">หลังสั่งซื้อ</span>
                          <span className={`text-sm font-bold ${balance - price < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                            ฿{(balance - price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="bg-secondary/50 border border-border rounded-xl p-3 mt-4">
                      <p className="text-[10px] font-semibold text-muted-foreground leading-relaxed">
                        <i className="fas fa-circle-info mr-1.5 text-primary" />
                        ราคาแพ็กเกจไม่รวมค่าธรรมเนียม EasySlip API ฿{easyslipFee} ต่อรายการเติมเงิน
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  {insufficient && (
                    <div className="w-full p-4 bg-destructive/10 border border-destructive/20 rounded-xl mb-2 flex flex-col gap-3">
                      <div>
                        <p className="text-xs font-bold text-destructive uppercase tracking-tight mb-0.5">ยอดเงินไม่เพียงพอ</p>
                        <p className="text-xs font-semibold text-destructive/80">ขาดอีก ฿{(price - balance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <Button variant="destructive" className="w-full rounded-lg text-xs font-bold cursor-pointer shadow-sm hover:shadow-md transition-all" asChild>
                        <Link href="/dashboard/topup">เติมเงินตอนนี้</Link>
                      </Button>
                    </div>
                  )}

                  <Button
                    className={`w-full rounded-full cursor-pointer h-14 text-base font-bold shadow-md hover:shadow-lg transition-all ${orderKind === 'trial' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    disabled={
                      !shopName || !!nameError ||
                      hasPublicIp !== 'yes' || !mcIp || !!mcIpError ||
                      insufficient ||
                      (orderKind === 'regular' && !selectedPkg) || submitting
                    }
                    onClick={() => { if (validateName(shopName) && validateMcIp(mcIp)) setStep('confirm'); }}
                  >
                    {orderKind === 'trial' ? 'เริ่มทดลองฟรี' : orderKind === 'intro' ? `ชำระ ฿${price} · เปิดร้านเลย` : 'ดำเนินการสั่งซื้อ'}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-3xl text-primary" />
      </div>
    }>
      <OrderContent />
    </Suspense>
  );
}