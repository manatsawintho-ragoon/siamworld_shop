'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import StatusScreen, { StatusDetailRow } from '@/components/StatusScreen';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';
import { useActiveCampaign } from '@/components/CampaignBanner';
import TopupSummary from '@/components/TopupSummary';
import GiftHowTo from '@/components/GiftHowTo';
import {
  ChevronLeft, Gift, Store, Check, Link2, Loader2, CheckCircle2,
  Zap, ShoppingCart, ChevronDown, AlertCircle,
} from 'lucide-react';

type Step = 'input' | 'success';

const HOW_TO = [
  { n: 1, t: 'เข้าแอป TrueMoney Wallet เลือก "ส่งซองของขวัญ"' },
  { n: 2, t: 'ระบุจำนวนเงินที่ต้องการเติม' },
  { n: 3, t: 'เลือก "แบ่งจำนวนเงินเท่ากัน"' },
  { n: 4, t: 'ระบุจำนวนคนรับซอง "1 คน"' },
  { n: 5, t: 'กดยืนยัน คัดลอกลิงก์มาวางในช่องด้านบน' },
];

/** Deliberately loose: this only catches obvious typos before the request is
 *  sent. The backend (extractVoucherHash) stays the authority on what a valid
 *  voucher is, so a real link must never be rejected here. */
const GIFT_LINK_RE = /gift\.truemoney\.com|[a-zA-Z0-9]{12,}/;

export default function TrueMoneyTopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const { alert } = useAdminAlert();
  const { settings } = useSettings();
  const campaign = useActiveCampaign();

  const tmnEnabled   = settings['truemoney_enabled'] === 'true';
  const bonusEnabled = (settings['topup_bonus_truemoney_enabled'] ?? settings['topup_bonus_enabled']) === 'true';
  const bonusMultRaw = parseFloat(settings['topup_bonus_truemoney_multiplier'] ?? settings['topup_bonus_multiplier'] ?? '1') || 1;
  const bonusMult    = bonusEnabled && bonusMultRaw > 1 ? bonusMultRaw : 1;

  const [step, setStep] = useState<Step>('input');
  const [giftLink, setGiftLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [howToOpen, setHowToOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [successAmount,     setSuccessAmount]     = useState(0);
  const [successPaid,       setSuccessPaid]       = useState(0);
  const [successMultiplier, setSuccessMultiplier] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      alert({ type: 'warning', title: 'กรุณาเข้าสู่ระบบ', message: 'คุณต้องล็อกอินก่อนเติมเงิน' }).then(() => router.push('/'));
    }
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  const accent = '#ed1c24';
  const trimmed = giftLink.trim();

  const handleRedeem = async () => {
    if (!trimmed) return;
    if (!GIFT_LINK_RE.test(trimmed)) {
      setLinkError('ลิงก์ซองของขวัญไม่ถูกต้อง กรุณาคัดลอกลิงก์จากแอป TrueMoney Wallet อีกครั้ง');
      return;
    }
    setLoading(true);
    setLinkError('');
    try {
      const d = await api<any>('/payment/truemoney/redeem', {
        method: 'POST', token: getToken()!, body: { giftLink: trimmed },
      }) as any;
      setSuccessAmount(d.amount);
      setSuccessPaid(d.paid_amount ?? d.amount);
      setSuccessMultiplier(d.multiplier ?? 1);
      await refresh();
      setStep('success');
    } catch (err: any) {
      setLinkError(err?.message || 'แลกซองของขวัญไม่สำเร็จ กรุณาตรวจสอบลิงก์อีกครั้ง');
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStep('input'); setGiftLink(''); setLinkError('');
    setSuccessMultiplier(1); setSuccessPaid(0);
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-3 pb-8 font-prompt">

        {/* ── Header ── */}
        <div className="bg-surface border-2 border-primary/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-theme-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => step === 'input' ? router.push('/topup') : reset()} disabled={loading} aria-label="ย้อนกลับ"
              className="w-9 h-9 rounded-lg hover:bg-surface-hover border border-transparent hover:border-border flex items-center justify-center transition-all disabled:opacity-0 flex-shrink-0">
              <ChevronLeft className="w-4 h-4 text-foreground-subtle" strokeWidth={2.5} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-foreground leading-none flex items-center gap-2">
                <Gift className="w-4 h-4 flex-shrink-0" style={{ color: accent }} strokeWidth={2.25} /> เติมเงินผ่าน TrueMoney
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2].map(i => (
                  <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                    (step === 'input' && i === 1) || (step === 'success' && i === 2) ? 'w-6 bg-primary' : 'w-1.5 bg-primary/20'
                  }`} />
                ))}
              </div>
            </div>
          </div>

          {bonusMult > 1 && step === 'input' && (
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-orange-500 text-white text-[10px] sm:text-[11px] font-black shadow-sm">
              <Zap className="w-3 h-3" strokeWidth={2.5} /> โบนัส x{bonusMult}
            </span>
          )}
        </div>

        {!tmnEnabled && step === 'input' && (
          <div className="bg-surface rounded-xl border-2 border-warning/30 shadow-theme-sm w-full p-8 text-center flex flex-col items-center justify-center gap-3 overlay-in">
            <Store className="w-10 h-10 text-warning" strokeWidth={1.75} />
            <p className="text-sm font-black text-foreground">TrueMoney Wallet ยังไม่เปิดใช้งาน</p>
            <Link href="/topup" className="btn-primary px-5 py-2.5 text-white font-black text-[13px] rounded-lg">กลับไปเลือกช่องทาง</Link>
          </div>
        )}

        {/* ── STEP 1: Gift link ── */}
        {tmnEnabled && step === 'input' && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start dialog-in">
            <div className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-border-muted pb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: accent }}>
                  <Gift className="w-5 h-5" strokeWidth={2.25} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground leading-none">วางลิงก์ซองของขวัญ</h2>
                  <p className="text-[10px] font-bold text-foreground-subtle uppercase tracking-widest mt-1">ระบบจะแลกซองและเติมเงินให้อัตโนมัติ</p>
                </div>
              </div>

              <div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: accent }}>
                    <Link2 className="w-5 h-5" strokeWidth={2.25} />
                  </div>
                  <input type="text" value={giftLink} inputMode="url" autoComplete="off"
                    onChange={e => { setGiftLink(e.target.value); setLinkError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !loading) handleRedeem(); }}
                    placeholder="https://gift.truemoney.com/campaign/?v=..."
                    className={`w-full pl-12 pr-4 py-3.5 rounded-lg border-2 bg-surface-hover text-sm font-bold text-foreground focus:outline-none transition-all ${
                      linkError ? 'border-error' : 'border-border-muted focus:border-primary'
                    }`} />
                </div>
                {linkError ? (
                  <div className="mt-2 bg-error/10 border border-error/25 rounded-lg px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                    <p className="text-[11px] font-bold text-error leading-relaxed">{linkError}</p>
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-foreground-subtle mt-2">
                    ซองต้องเป็นแบบ 1 คนรับ และยังไม่ถูกใช้งาน
                  </p>
                )}
              </div>

              <button onClick={handleRedeem} disabled={loading || trimmed.length < 6}
                className="btn w-full py-4 rounded-lg text-white font-black text-sm shadow-[0_4px_0_#991b1b] hover:shadow-[0_2px_0_#991b1b] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                style={{ backgroundColor: accent }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> : <CheckCircle2 className="w-4 h-4" strokeWidth={2.25} />}
                ยืนยันการแลกซองของขวัญ
              </button>

              {/* How-to, collapsed by default so the page opens on the action */}
              <div className="rounded-xl border border-border-muted overflow-hidden">
                <button type="button" onClick={() => setHowToOpen(v => !v)} aria-expanded={howToOpen}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 bg-surface-hover/60 hover:bg-surface-hover transition-colors">
                  <span className="text-[12px] font-black text-foreground-muted">วิธีสร้างซองของขวัญ (5 ขั้นตอน)</span>
                  <ChevronDown className={`w-4 h-4 text-foreground-subtle transition-transform ${howToOpen ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                </button>
                {howToOpen && (
                  <div className="p-4 border-t border-border-muted">
                    <GiftHowTo steps={HOW_TO} accent={accent} />
                  </div>
                )}
              </div>
            </div>

            <TopupSummary accent={accent} method="TrueMoney" amount={null}
              bonusMult={bonusMult} campaign={campaign} walletBalance={user.wallet_balance} />
          </div>
        )}

        {/* ── STEP 2: Success ── */}
        {step === 'success' && (
          <div className="bg-surface rounded-xl border-2 border-primary/30 shadow-theme-sm w-full p-5 sm:p-8 dialog-in">
            <StatusScreen
              compact
              variant="success"
              title="ทำรายการสำเร็จ!"
              description="ยอดเงินได้รับการเติมเข้า Wallet เรียบร้อยแล้ว"
              detail={
                successMultiplier > 1 ? (
                  <>
                    <StatusDetailRow label="ยอดในซอง" value={`฿${successPaid.toLocaleString()}`} />
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
