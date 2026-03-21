'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const AMOUNTS = [20, 50, 100, 200, 300, 500, 1000, 2000];

export default function TopupPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'truemoney' | 'promptpay'>('truemoney');
  const [voucherUrl, setVoucherUrl] = useState('');
  const [amount, setAmount] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [qr, setQr] = useState<{ url: string; transactionId: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!authLoading && !user) { router.push('/'); return null; }

  const handleTruemoney = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const d = await api('/payment/truemoney/redeem', { method: 'POST', token: getToken()!, body: { voucherUrl } }) as any;
      setResult({ success: true, message: d.message || `เติมเงินสำเร็จ! ได้รับ ฿${d.amount?.toLocaleString() || '?'}` });
      refresh(); setVoucherUrl('');
    } catch (err: any) { setResult({ success: false, message: err?.message || 'เกิดข้อผิดพลาด' }); }
    setLoading(false);
  };

  const handlePromptpay = async () => {
    setLoading(true); setResult(null); setQr(null);
    try {
      const d = await api('/payment/promptpay/create', { method: 'POST', token: getToken()!, body: { amount } }) as any;
      setQr({ url: d.qrUrl || d.qr_url, transactionId: d.transactionId || d.transaction_id });
    } catch (err: any) { setResult({ success: false, message: err?.message || 'เกิดข้อผิดพลาด' }); }
    setLoading(false);
  };

  const confirmPromptpay = async () => {
    if (!qr) return;
    setConfirming(true); setResult(null);
    try {
      const d = await api('/payment/promptpay/confirm', { method: 'POST', token: getToken()!, body: { transactionId: qr.transactionId } }) as any;
      setResult({ success: true, message: d.message || 'เติมเงินสำเร็จ!' });
      refresh(); setQr(null);
    } catch (err: any) { setResult({ success: false, message: err?.message || 'ยังไม่พบการชำระเงิน กรุณาลองใหม่' }); }
    setConfirming(false);
  };

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2 mb-2">
          <i className="fas fa-wallet text-primary" aria-hidden="true"></i>เติมเงิน
        </h1>
        <p className="text-foreground-muted text-sm mb-6">เติมเงินเข้ากระเป๋าเพื่อซื้อสินค้าและเปิดกล่องสุ่ม</p>

        {/* Balance */}
        <div className="card p-5 mb-6 bg-gradient-to-br from-primary/5 to-primary/0 border-primary/20">
          <p className="text-sm text-foreground-muted">ยอดเงินคงเหลือ</p>
          <p className="text-3xl font-black text-foreground tabular-nums mt-1">
            ฿{user?.wallet_balance?.toLocaleString() || '0'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 border border-gray-200 p-1 rounded-xl">
          <button onClick={() => { setTab('truemoney'); setResult(null); setQr(null); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${tab === 'truemoney' ? 'bg-primary text-white shadow-md' : 'text-foreground-muted hover:bg-gray-200'}`}>
            <i className="fas fa-mobile-screen mr-1.5" aria-hidden="true"></i>TrueMoney
          </button>
          <button onClick={() => { setTab('promptpay'); setResult(null); setQr(null); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${tab === 'promptpay' ? 'bg-primary text-white shadow-md' : 'text-foreground-muted hover:bg-gray-200'}`}>
            <i className="fas fa-qrcode mr-1.5" aria-hidden="true"></i>PromptPay
          </button>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`rounded-xl p-3 mb-4 text-sm flex items-center gap-2 ${result.success
                ? 'bg-success-light border border-success/20 text-success-foreground'
                : 'bg-error-light border border-error/20 text-error-foreground'}`}>
              <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`} aria-hidden="true"></i>
              {result.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TrueMoney */}
        {tab === 'truemoney' && (
          <div className="card p-5 animate-fade-in">
            <h2 className="font-bold text-foreground mb-1">TrueMoney e-Voucher</h2>
            <p className="text-xs text-foreground-muted mb-4">วางลิงก์ซองของขวัญ TrueMoney Wallet</p>
            <form onSubmit={handleTruemoney} className="space-y-3">
              <input type="text" value={voucherUrl} onChange={e => setVoucherUrl(e.target.value)} placeholder="https://gift.truemoney.com/campaign/?v=..."
                className="input" required aria-label="ลิงก์ TrueMoney e-Voucher" />
              <button type="submit" disabled={loading || !voucherUrl.trim()} className="btn-success w-full justify-center py-2.5 min-h-[44px]">
                {loading ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> กำลังตรวจสอบ...</> : <><i className="fas fa-check" aria-hidden="true"></i> เติมเงิน</>}
              </button>
            </form>
          </div>
        )}

        {/* PromptPay */}
        {tab === 'promptpay' && (
          <div className="card p-5 animate-fade-in">
            {!qr ? (
              <>
                <h2 className="font-bold text-foreground mb-1">PromptPay QR Code</h2>
                <p className="text-xs text-foreground-muted mb-4">เลือกจำนวนเงินที่ต้องการเติม</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {AMOUNTS.map(a => (
                    <button key={a} onClick={() => setAmount(a)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] tabular-nums ${amount === a
                        ? 'bg-primary text-white shadow-theme-xs' : 'bg-surface-hover text-foreground-muted hover:bg-border'}`}>
                      ฿{a}
                    </button>
                  ))}
                </div>
                <button onClick={handlePromptpay} disabled={loading} className="btn-primary w-full justify-center py-2.5 min-h-[44px]">
                  {loading ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> กำลังสร้าง QR...</>
                    : <><i className="fas fa-qrcode" aria-hidden="true"></i> สร้าง QR Code (฿{amount})</>}
                </button>
              </>
            ) : (
              <div className="text-center">
                <p className="text-sm text-foreground font-medium mb-3">สแกน QR เพื่อชำระเงิน</p>
                <div className="bg-white rounded-2xl p-4 inline-block mb-4">
                  <img src={qr.url} alt="PromptPay QR Code" className="w-48 h-48 object-contain" />
                </div>
                <p className="text-lg font-black text-foreground tabular-nums mb-4">฿{amount.toLocaleString()}</p>
                <div className="space-y-2">
                  <button onClick={confirmPromptpay} disabled={confirming} className="btn-success w-full justify-center py-2.5 min-h-[44px]">
                    {confirming ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> กำลังตรวจสอบ...</>
                      : <><i className="fas fa-check" aria-hidden="true"></i> ชำระเงินแล้ว ยืนยัน</>}
                  </button>
                  <button onClick={() => setQr(null)} className="btn-ghost w-full justify-center">สร้าง QR ใหม่</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs text-foreground-muted space-y-1">
          <p><i className="fas fa-info-circle text-primary mr-1" aria-hidden="true"></i>เงินจะเข้ากระเป๋าทันทีหลังเติมสำเร็จ</p>
          <p><i className="fas fa-shield-halved text-primary mr-1" aria-hidden="true"></i>ระบบมีความปลอดภัย ข้อมูลถูกเข้ารหัส</p>
          <p><i className="fas fa-headset text-primary mr-1" aria-hidden="true"></i>พบปัญหา? ติดต่อเราผ่าน Discord</p>
        </div>
      </div>
    </MainLayout>
  );
}
