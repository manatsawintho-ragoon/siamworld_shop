'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const AMOUNTS = [50, 100, 200, 300, 500, 1000];

export default function TopupPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();
  const [method, setMethod] = useState<'truemoney' | 'promptpay'>('truemoney');
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState('');
  const [giftLink, setGiftLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [qrData, setQrData] = useState<{ reference: string; qrCode?: string; amount: number } | null>(null);

  if (!authLoading && !user) { router.push('/'); return null; }

  const selectedAmount = customAmount ? Number(customAmount) : amount;

  const handleTrueMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftLink.trim()) return;
    setLoading(true); setResult(null);
    try {
      const d = await api('/payment/truemoney/redeem', { method: 'POST', token: getToken()!, body: { giftLink: giftLink.trim() } }) as any;
      setResult({ success: true, message: d.message || `เติมเงินสำเร็จ! ได้รับ ฿${d.amount?.toLocaleString() || ''}` });
      setGiftLink('');
      refresh();
    } catch (err: any) { setResult({ success: false, message: err?.message || 'เกิดข้อผิดพลาด' }); }
    setLoading(false);
  };

  const handlePromptPay = async () => {
    if (selectedAmount < 1) return;
    setLoading(true); setResult(null); setQrData(null);
    try {
      const d = await api('/payment/promptpay/create', { method: 'POST', token: getToken()!, body: { amount: selectedAmount } }) as any;
      setQrData({ reference: d.reference, qrCode: d.qrCode, amount: selectedAmount });
    } catch (err: any) { setResult({ success: false, message: err?.message || 'เกิดข้อผิดพลาด' }); }
    setLoading(false);
  };

  const handleConfirmPromptPay = async () => {
    if (!qrData) return;
    setLoading(true);
    try {
      const d = await api('/payment/promptpay/confirm', { method: 'POST', token: getToken()!, body: { reference: qrData.reference } }) as any;
      setResult({ success: true, message: d.message || 'เติมเงินสำเร็จ!' });
      setQrData(null);
      refresh();
    } catch (err: any) { setResult({ success: false, message: err?.message || 'ยังไม่พบการชำระเงิน กรุณาลองใหม่' }); }
    setLoading(false);
  };

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2 mb-2">
          <i className="fas fa-coins text-primary" aria-hidden="true"></i>เติมเงิน
        </h1>
        <p className="text-foreground-muted text-sm mb-1">เติมเงินเข้ากระเป๋าเพื่อซื้อไอเทมในร้านค้า</p>
        {user && (
          <p className="text-sm font-bold text-primary mb-6">
            ยอดเงินปัจจุบัน: ฿{user.wallet_balance?.toLocaleString() || '0'}
          </p>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`rounded-xl p-3 mb-4 text-sm flex items-center gap-2 ${result.success
                ? 'bg-success-light border border-success/20 text-success-foreground'
                : 'bg-error-light border border-error/20 text-error-foreground'}`}>
              <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`} aria-hidden="true"></i>
              {result.message}
              <button onClick={() => setResult(null)} className="ml-auto opacity-60 hover:opacity-100"><i className="fas fa-times"></i></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Method Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMethod('truemoney'); setQrData(null); setResult(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${method === 'truemoney'
              ? 'bg-[#ff6600] text-white shadow-theme-xs'
              : 'bg-surface-hover text-foreground-muted hover:bg-border'}`}
          >
            <i className="fas fa-mobile-alt mr-1.5"></i>TrueMoney
          </button>
          <button
            onClick={() => { setMethod('promptpay'); setQrData(null); setResult(null); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${method === 'promptpay'
              ? 'bg-[#003b80] text-white shadow-theme-xs'
              : 'bg-surface-hover text-foreground-muted hover:bg-border'}`}
          >
            <i className="fas fa-qrcode mr-1.5"></i>PromptPay
          </button>
        </div>

        {/* TrueMoney Tab */}
        {method === 'truemoney' && (
          <div className="card p-5 animate-fade-in">
            <h2 className="font-bold text-foreground mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#ff6600]/10 flex items-center justify-center"><i className="fas fa-mobile-alt text-[#ff6600] text-xs"></i></span>
              TrueMoney Wallet
            </h2>
            <p className="text-xs text-foreground-muted mb-4">วางลิงก์ซองอังเปาจาก TrueMoney เพื่อเติมเงินอัตโนมัติ</p>
            <form onSubmit={handleTrueMoney} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground-muted mb-1.5">ลิงก์ซองอังเปา</label>
                <input
                  type="text"
                  value={giftLink}
                  onChange={e => setGiftLink(e.target.value)}
                  placeholder="https://gift.truemoney.com/campaign/?v=..."
                  className="input text-sm"
                  required
                  aria-label="ลิงก์ซองอังเปา TrueMoney"
                />
              </div>
              <button type="submit" disabled={loading || !giftLink.trim()} className="btn-success w-full justify-center py-2.5 min-h-[44px]">
                {loading ? <><i className="fas fa-spinner fa-spin"></i> กำลังตรวจสอบ...</> : <><i className="fas fa-wallet"></i> เติมเงิน</>}
              </button>
            </form>
          </div>
        )}

        {/* PromptPay Tab */}
        {method === 'promptpay' && !qrData && (
          <div className="card p-5 animate-fade-in">
            <h2 className="font-bold text-foreground mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#003b80]/10 flex items-center justify-center"><i className="fas fa-qrcode text-[#003b80] text-xs"></i></span>
              PromptPay QR
            </h2>
            <p className="text-xs text-foreground-muted mb-4">เลือกจำนวนเงินแล้วสแกน QR Code เพื่อชำระ</p>

            <label className="block text-xs font-bold text-foreground-muted mb-2">เลือกจำนวนเงิน</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {AMOUNTS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => { setAmount(a); setCustomAmount(''); }}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${!customAmount && amount === a
                    ? 'bg-primary text-white shadow-theme-xs'
                    : 'bg-surface-hover text-foreground-muted hover:bg-border'}`}
                >
                  ฿{a.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-foreground-muted mb-1.5">หรือใส่จำนวนเอง</label>
              <input
                type="number"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="0"
                min={1}
                className="input text-sm"
                aria-label="จำนวนเงินที่ต้องการเติม"
              />
            </div>
            <button onClick={handlePromptPay} disabled={loading || selectedAmount < 1} className="btn-success w-full justify-center py-2.5 min-h-[44px]">
              {loading ? <><i className="fas fa-spinner fa-spin"></i> กำลังสร้าง QR...</> : <><i className="fas fa-qrcode"></i> สร้าง QR Code (฿{selectedAmount.toLocaleString()})</>}
            </button>
          </div>
        )}

        {/* QR Display */}
        {method === 'promptpay' && qrData && (
          <div className="card p-5 animate-fade-in text-center">
            <h2 className="font-bold text-foreground mb-1">สแกนเพื่อชำระเงิน</h2>
            <p className="text-xs text-foreground-muted mb-4">สแกน QR Code ด้านล่างผ่านแอปธนาคาร</p>
            <div className="inline-block bg-white p-4 rounded-xl border border-border mb-3">
              {qrData.qrCode ? (
                <img src={qrData.qrCode} alt="PromptPay QR" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-foreground-muted">
                  <i className="fas fa-qrcode text-6xl opacity-20"></i>
                </div>
              )}
            </div>
            <p className="text-2xl font-black text-primary mb-4">฿{qrData.amount.toLocaleString()}</p>
            <div className="flex gap-2">
              <button onClick={() => setQrData(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-surface-hover text-foreground-muted hover:bg-border transition-all">
                ยกเลิก
              </button>
              <button onClick={handleConfirmPromptPay} disabled={loading} className="btn-success flex-1 justify-center py-2.5">
                {loading ? <><i className="fas fa-spinner fa-spin"></i> ตรวจสอบ...</> : <><i className="fas fa-check"></i> ชำระแล้ว</>}
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs text-foreground-muted space-y-1">
          <p><i className="fas fa-shield-alt text-primary mr-1" aria-hidden="true"></i>ระบบเติมเงินปลอดภัย ผ่านช่องทางที่เชื่อถือได้</p>
          <p><i className="fas fa-bolt text-primary mr-1" aria-hidden="true"></i>เงินจะเข้ากระเป๋าทันทีหลังชำระเสร็จ</p>
          <p><i className="fas fa-headset text-primary mr-1" aria-hidden="true"></i>พบปัญหา? ติดต่อเราผ่าน Discord</p>
        </div>
      </div>
    </MainLayout>
  );
}
