'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';

type Step = 'input' | 'success';

export default function TrueMoneyTopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const { alert } = useAdminAlert();
  const { settings } = useSettings();

  const tmnEnabled = settings['truemoney_enabled'] === 'true';
  const tmnPhone   = (settings['truemoney_phone'] || '').replace(/\D/g, '');
  const tmnPhoneFmt = tmnPhone.length === 10 ? `${tmnPhone.slice(0, 3)}-${tmnPhone.slice(3, 6)}-${tmnPhone.slice(6)}` : tmnPhone;
  const bonusEnabled = (settings['topup_bonus_truemoney_enabled'] ?? settings['topup_bonus_enabled']) === 'true';
  const bonusMult    = parseFloat(settings['topup_bonus_truemoney_multiplier'] ?? settings['topup_bonus_multiplier'] ?? '1') || 1;
  const hasBonus     = bonusEnabled && bonusMult > 1;

  const [step, setStep] = useState<Step>('input');
  const [giftLink, setGiftLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPhone = () => {
    if (!tmnPhone) return;
    navigator.clipboard?.writeText(tmnPhone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const [successAmount,     setSuccessAmount]     = useState(0);
  const [successPaid,       setSuccessPaid]       = useState(0);
  const [successMultiplier, setSuccessMultiplier] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      alert({ type: 'warning', title: 'กรุณาเข้าสู่ระบบ', message: 'คุณต้องล็อกอินก่อนเติมเงิน' }).then(() => router.push('/'));
    }
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  const handleRedeem = async () => {
    if (!giftLink) return;
    setLoading(true);
    try {
      const d = await api<any>('/payment/truemoney/redeem', {
        method: 'POST', token: getToken()!, body: { giftLink },
      }) as any;
      setSuccessAmount(d.amount);
      setSuccessPaid(d.paid_amount ?? d.amount);
      setSuccessMultiplier(d.multiplier ?? 1);
      await refresh();
      setStep('success');
    } catch (err: any) {
      await alert({ type: 'error', title: 'แลกซองของขวัญไม่สำเร็จ', message: err?.message || 'กรุณาตรวจสอบลิงก์อีกครั้ง' });
    } finally { setLoading(false); }
  };

  const reset = () => { setStep('input'); setGiftLink(''); setSuccessMultiplier(1); setSuccessPaid(0); };

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
                  <i className="fas fa-bolt text-white text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-0.5">โปรโมชั่น TrueMoney</p>
                  <h3 className="text-lg font-black text-white leading-tight">
                    เติมผ่านซองของขวัญ ได้รับโบนัส
                    <span className="ml-2 text-2xl text-yellow-200 drop-shadow">x{bonusMult}</span>
                  </h3>
                  <p className="text-[11px] text-white/80 font-bold mt-0.5">ซอง ฿100 → ได้รับ ฿{(100 * bonusMult).toLocaleString()} เข้า Wallet ทันที</p>
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
        <div className="bg-surface border-2 border-green-200 rounded-xl p-3 flex items-center shadow-theme-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => step === 'input' ? router.push('/topup') : reset()} disabled={loading}
              className="w-9 h-9 rounded-lg hover:bg-green-50 border border-transparent hover:border-green-200 flex items-center justify-center transition-all disabled:opacity-0">
              <i className="fas fa-chevron-left text-foreground-subtle"></i>
            </button>
            <div>
              <h1 className="text-lg font-black text-foreground leading-none flex items-center gap-2">
                <i className="fas fa-gift text-[#ed1c24]"></i> เติมเงินผ่าน TrueMoney
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2].map((i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                    (step === 'input' && i === 1) || (step === 'success' && i === 2) ? 'w-6 bg-primary' : 'w-1.5 bg-green-100'
                  }`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-[380px] flex flex-col">
          <AnimatePresence mode="wait">

            {!tmnEnabled && step === 'input' && (
              <motion.div key="disabled" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-surface rounded-xl border-2 border-amber-200 shadow-theme-sm w-full p-8 text-center flex-1 flex flex-col items-center justify-center gap-3">
                <i className="fas fa-store-slash text-4xl text-amber-400" />
                <p className="text-sm font-black text-foreground">TrueMoney Wallet ยังไม่เปิดใช้งาน</p>
                <button onClick={() => router.push('/topup')} className="btn-primary px-5 py-2.5 text-white font-black text-[13px] rounded-lg">กลับไปเลือกช่องทาง</button>
              </motion.div>
            )}

            {/* STEP 1: Gift link input */}
            {tmnEnabled && step === 'input' && (
              <motion.div key="input" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="bg-surface rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-6 space-y-4 flex-1">
                <div className="flex items-center gap-3 border-b border-green-100 pb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#ed1c24] text-white"><i className="fas fa-gift text-lg"></i></div>
                  <div>
                    <h2 className="text-lg font-black text-foreground leading-none">ส่งซองของขวัญ</h2>
                    <p className="text-[10px] font-bold text-foreground-subtle uppercase tracking-widest mt-1">วางลิงก์ซองของขวัญที่นี่</p>
                  </div>
                </div>

                {/* ── Destination wallet (who the gift goes to) ── */}
                {tmnPhone && (
                  <div className="bg-red-50 border-2 border-[#ed1c24]/30 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#ed1c24] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <i className="fas fa-mobile-alt text-white text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-[#ed1c24] uppercase tracking-widest">ส่งซองของขวัญมาที่เบอร์นี้</p>
                      <p className="text-xl font-black text-foreground font-mono tracking-wider leading-tight mt-0.5">{tmnPhoneFmt}</p>
                      <p className="text-[10px] font-bold text-foreground-subtle mt-0.5">กระเป๋า TrueMoney ของร้าน (ระบบแลกซองเข้าให้อัตโนมัติ)</p>
                    </div>
                    <button type="button" onClick={copyPhone}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border-2 border-[#ed1c24]/30 text-[#ed1c24] text-[11px] font-black hover:bg-red-50 transition-all">
                      <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ed1c24]"><i className="fas fa-link text-lg"></i></div>
                    <input type="text" value={giftLink} onChange={e => setGiftLink(e.target.value)}
                      placeholder="วางลิงก์ซองของขวัญที่นี่..." className="w-full pl-12 pr-4 py-3.5 rounded-lg border-2 border-green-100 bg-surface-hover text-sm font-bold focus:outline-none focus:border-[#ed1c24] transition-all" />
                  </div>

                  <div className="bg-red-50/50 border border-dashed border-red-200 rounded-xl p-4">
                    <h4 className="text-[12px] font-black text-[#ed1c24] mb-3 flex items-center gap-2"><i className="fas fa-circle-info"></i> ขั้นตอนการสร้างซอง</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { n: 1, t: 'เข้าแอป TrueMoney Wallet เลือก "ส่งซองของขวัญ"' },
                        { n: 2, t: 'ระบุจำนวนเงินที่ต้องการเติม' },
                        { n: 3, t: 'เลือก "แบ่งจำนวนเงินเท่ากัน"' },
                        { n: 4, t: 'ระบุจำนวนคนรับซอง "1 คน"' },
                        { n: 5, t: 'กดยืนยัน คัดลอกลิงก์มาวางในช่องด้านบน' },
                      ].map(s => (
                        <div key={s.n} className="flex flex-col items-center text-center gap-1.5">
                          <div className="relative w-full aspect-[3/5] rounded-lg overflow-hidden border border-red-100 bg-white">
                            <img src={`/images/truemoney-sendgift-icon-20240521-how-to-create-${s.n}.png`} alt={`ขั้นตอนที่ ${s.n}`} className="w-full h-full object-contain" />
                            <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#ed1c24] text-white text-[9px] font-black flex items-center justify-center">{s.n}</span>
                          </div>
                          <p className="text-[9px] font-bold text-foreground-subtle leading-tight">{s.t}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button onClick={handleRedeem} disabled={loading || giftLink.trim().length < 6}
                  className="btn w-full py-4 rounded-lg bg-[#ed1c24] text-white font-black text-sm shadow-[0_4px_0_#991b1b] hover:shadow-[0_2px_0_#991b1b] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none">
                  {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-check-circle mr-2"></i>}
                  ยืนยันการแลกซองของขวัญ
                </button>
              </motion.div>
            )}

            {/* STEP 2: Success */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-surface rounded-xl border-2 border-green-200 shadow-theme-sm w-full p-8 space-y-6 text-center flex-1">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-green-500/10 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-20 h-20 rounded-2xl bg-success flex items-center justify-center text-white shadow-xl mx-auto"><i className="fas fa-check text-3xl"></i></div>
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-foreground tracking-tight">ทำรายการสำเร็จ!</h2>
                  <p className="text-sm font-bold text-foreground-subtle">ยอดเงินได้รับการเติมเข้า Wallet เรียบร้อยแล้ว</p>
                </div>
                {successMultiplier > 1 ? (
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 max-w-[260px] mx-auto space-y-2">
                    <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-foreground-subtle">ยอดในซอง</span><span className="font-black text-foreground-muted">฿{successPaid.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-orange-500"><i className="fas fa-bolt mr-1" />โบนัส x{successMultiplier}</span><span className="font-black text-orange-500">+฿{(successAmount - successPaid).toLocaleString()}</span></div>
                    <div className="border-t border-orange-200 pt-2 flex items-center justify-between"><span className="text-[10px] font-black text-foreground-subtle uppercase tracking-wider">ได้รับเข้า Wallet</span><span className="text-2xl font-black text-orange-600">฿{successAmount.toLocaleString()}</span></div>
                  </div>
                ) : (
                  <div className="bg-surface-hover rounded-xl p-4 border border-green-100 max-w-[200px] mx-auto">
                    <p className="text-[9px] font-black text-foreground-subtle uppercase tracking-widest mb-0.5">จำนวนที่เติมเงิน</p>
                    <p className="text-3xl font-black text-success">฿{successAmount.toLocaleString()}</p>
                  </div>
                )}
                <div className="flex flex-col gap-2.5 max-w-[240px] mx-auto">
                  <button onClick={() => router.push('/shop')} className="btn-primary w-full py-3 text-white font-black text-[13px] shadow-[0_4px_0_rgb(var(--color-primary-muted))]"><i className="fas fa-shopping-cart mr-2"></i> ไปที่หน้าร้านค้า</button>
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
