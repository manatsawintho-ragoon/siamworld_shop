'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';

interface Package { months: number; price: number; label: string; save: number }
interface IntroPromo { price: number; regularPrice: number }
interface Subscription { id: number; shop_name: string; domain: string; status: string; expires_at: string; kind?: string }

type RenewOption =
  | { kind: 'intro'; price: number; label: string; months: 1 }
  | { kind: 'regular'; months: number; price: number; label: string; save: number };

function RenewContent() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const subId = searchParams.get('id');

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [introPromo, setIntroPromo] = useState<IntroPromo | null>(null);
  const [usedIntro, setUsedIntro] = useState(false);
  const [selectedSub, setSelectedSub] = useState<number | null>(subId ? parseInt(subId) : null);
  const [selection, setSelection] = useState<RenewOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [renewedShop, setRenewedShop] = useState('');

  useEffect(() => { if (!loading && !user) router.push('/?auth=login'); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/subscriptions').then(r => {
      setSubs(r.data.subscriptions || []);
      setUsedIntro(!!r.data.usedIntro);
    });
    api.get('/api/subscriptions/packages').then(r => {
      setPackages(r.data.packages || []);
      const intro = (r.data.promos || []).find((p: { kind: string }) => p.kind === 'intro');
      if (intro) setIntroPromo({ price: intro.price, regularPrice: intro.regularPrice });
    });
  }, [user]);

  const balance = user?.walletBalance || 0;
  const selectedSubData = subs.find(s => s.id === selectedSub);
  const canUseIntro = !!introPromo && !usedIntro && selectedSubData?.kind === 'trial';

  // Default the selection once data is loaded or sub changes
  useEffect(() => {
    if (!selectedSubData) { setSelection(null); return; }
    if (canUseIntro && introPromo) {
      setSelection({ kind: 'intro', price: introPromo.price, label: 'ทดลองเดือนแรก (1 เดือน)', months: 1 });
    } else if (packages.length) {
      const first = packages[0];
      setSelection({ kind: 'regular', months: first.months, price: first.price, label: first.label, save: first.save });
    }
  }, [selectedSubData?.id, canUseIntro, introPromo?.price, packages]);

  const price = selection?.price || 0;
  const insufficient = balance < price;

  const handleRenew = async () => {
    if (!selectedSub || !selection) return;
    setError('');
    setSubmitting(true);
    try {
      const body = selection.kind === 'intro'
        ? { kind: 'intro' }
        : { packageMonths: selection.months };
      await api.post(`/api/subscriptions/${selectedSub}/renew`, body);
      await refreshUser();
      setRenewedShop(selectedSubData?.shop_name || '');
      setDone(true);
      toast.success('ต่ออายุสำเร็จ', `ต่ออายุ ${selectedSubData?.shop_name} เป็นเวลา ${selection.label} แล้ว`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'ต่ออายุไม่สำเร็จ';
      setError(msg);
      toast.error('ต่ออายุไม่สำเร็จ', msg);
    } finally { setSubmitting(false); }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Back + Title */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-full cursor-pointer h-10 w-10 border-border" asChild>
            <Link href="/dashboard">
              <Icon name="arrow-left" className="text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ต่ออายุแพ็กเกจ</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">
              ยอดเงินคงเหลือ: <span className="font-bold text-emerald-600 dark:text-emerald-400">฿{balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>

        {done ? (
          <Card className="text-center max-w-md mx-auto shadow-md border-emerald-500/30">
            <CardContent className="p-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mb-6">
                <Icon name="check" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">ต่ออายุสำเร็จแล้ว!</h2>
              <p className="text-sm text-muted-foreground mb-8">
                ร้านค้า <span className="font-bold text-foreground">{renewedShop}</span> ได้รับการต่ออายุเป็นเวลา <span className="font-bold text-primary">{selection?.label}</span>
              </p>
              <Button className="w-full rounded-full cursor-pointer" asChild>
                <Link href="/dashboard">
                  <Icon name="gauge-high" className="mr-2" /> กลับไปยังแดชบอร์ด
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            {/* Left: Shop + Package selection */}
            <div className="space-y-6">
              {/* Shop selector */}
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon name="store" />
                    </div>
                    เลือกร้านค้า
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subs.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Icon name="store-slash" className="text-3xl mb-3 opacity-50 block" />
                      ยังไม่มีร้านค้าให้เลือก
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {subs.filter(s => !['cancelled'].includes(s.status)).map(sub => {
                        const diff = new Date(sub.expires_at).getTime() - Date.now();
                        const d = Math.floor(diff / 86400000);
                        const isExpiring = d < 7 && d >= 0;
                        const isActive = selectedSub === sub.id;

                        return (
                          <div key={sub.id} onClick={() => setSelectedSub(sub.id)}
                            className={`w-full flex items-center p-4 rounded-xl border transition-all cursor-pointer ${isActive
                              ? 'bg-primary/5 border-primary shadow-sm'
                              : 'bg-background border-border hover:border-primary/50'}`}>
                            <div className="flex items-center gap-4 w-full">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                                <Icon name="cube" className="text-sm" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-foreground truncate">{sub.shop_name}</span>
                                  {isExpiring && (
                                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">กำลังจะหมดอายุ</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-semibold">
                                  <Icon name="globe" className="text-[10px]" />{sub.domain}
                                  <span className="opacity-50">·</span>
                                  <Icon name="calendar" className="text-[10px]" />
                                  {new Date(sub.expires_at).toLocaleDateString('th-TH')}
                                </div>
                              </div>
                              {isActive && <Icon name="check-circle" className="text-primary text-lg flex-shrink-0" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Package selector */}
              <Card className="shadow-sm border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
                      <Icon name="box-open" />
                    </div>
                    เลือกระยะเวลา
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canUseIntro && introPromo && (
                    <div
                      onClick={() => setSelection({ kind: 'intro', price: introPromo.price, label: 'ทดลองเดือนแรก (1 เดือน)', months: 1 })}
                      className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                        selection?.kind === 'intro'
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-md'
                          : 'bg-background border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5'
                      }`}>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm shadow-emerald-500/30">
                        <Icon name="tag" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">โปรเดือนแรก · ครั้งแรก</span>
                        </div>
                        <p className="text-sm font-black text-foreground">
                          ต่ออายุ 1 เดือน <span className="text-emerald-600">฿{introPromo.price}</span>
                          <span className="ml-2 font-semibold text-muted-foreground line-through text-xs">฿{introPromo.regularPrice}</span>
                        </p>
                        <p className="text-xs font-semibold text-muted-foreground">ประหยัด ฿{introPromo.regularPrice - introPromo.price} · เฉพาะร้านที่กำลังทดลอง</p>
                      </div>
                      {selection?.kind === 'intro' && <Icon name="check-circle" className="text-emerald-600 text-lg flex-shrink-0" />}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {packages.map(p => {
                      const isSelected = selection?.kind === 'regular' && selection.months === p.months;
                      return (
                        <div key={p.months}
                          onClick={() => setSelection({ kind: 'regular', months: p.months, price: p.price, label: p.label, save: p.save })}
                          className={`p-5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                            ? 'bg-primary border-primary text-primary-foreground shadow-md scale-[1.02]'
                            : 'bg-background border-border hover:border-primary/50 hover:bg-primary/5'}`}>
                          <div className={`font-bold text-sm ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>{p.label}</div>
                          <div className={`font-extrabold text-2xl my-1.5 ${isSelected ? 'text-white' : 'text-primary'}`}>฿{p.price.toLocaleString()}</div>
                          {p.save > 0 ? (
                            <Badge variant={isSelected ? "outline" : "success"} className={`mt-1 text-[10px] ${isSelected ? 'border-white/40 bg-transparent text-white' : ''}`}>
                              ประหยัด ฿{p.save}
                            </Badge>
                          ) : <div className="h-[22px] mt-1" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Summary */}
            <div className="lg:sticky lg:top-24 h-fit">
              <Card className="shadow-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon name="receipt" />
                    </div>
                    สรุปรายการ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm bg-secondary/30 p-4 rounded-xl border border-border">
                    {selectedSubData && (
                      <div className="flex justify-between items-center pb-3 border-b border-border/50">
                        <span className="text-muted-foreground font-medium">ร้านค้า</span>
                        <span className="text-foreground font-bold truncate max-w-[130px]">{selectedSubData.shop_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">ระยะเวลา</span>
                      <span className="text-foreground font-bold">{selection?.label || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">ราคาแพ็กเกจ</span>
                      <span className="text-primary font-bold text-lg">฿{price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-border/50">
                      <span className="text-muted-foreground font-medium">ยอดเงินคงเหลือ</span>
                      <span className="text-foreground font-semibold">฿{balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-muted-foreground font-medium">ยอดหลังต่ออายุ</span>
                      <span className={`font-bold text-lg ${insufficient ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        ฿{(balance - price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  {insufficient && (
                    <div className="w-full text-xs text-destructive mb-1 flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-3 font-semibold">
                      <Icon name="triangle-exclamation" className="mt-0.5 flex-shrink-0" />
                      <span>
                        ยอดเงินคงเหลือไม่เพียงพอ{' '}
                        <Link href="/dashboard/topup" className="underline font-bold hover:opacity-80">เติมเงินเข้ากระเป๋า</Link>
                      </span>
                    </div>
                  )}

                  {error && (
                    <div className="w-full flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 font-semibold mb-1">
                      <Icon name="circle-exclamation" className="flex-shrink-0" />{error}
                    </div>
                  )}

                  <Button
                    data-track="renew_submit"
                    className="w-full rounded-full cursor-pointer h-12 text-base shadow-md hover:shadow-lg transition-all"
                    disabled={!selectedSub || !selection || insufficient || submitting}
                    onClick={handleRenew}>
                    {submitting
                      ? <><Icon name="spinner" className="mr-2 animate-spin" /> กำลังดำเนินการ...</>
                      : <><Icon name="rotate-right" className="mr-2" /> ยืนยันการต่ออายุ</>}
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

export default function RenewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-secondary rounded-full" />
          <div className="h-4 w-32 bg-secondary rounded-full" />
        </div>
      </div>
    }>
      <RenewContent />
    </Suspense>
  );
}