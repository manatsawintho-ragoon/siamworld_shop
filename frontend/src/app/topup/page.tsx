'use client';
import { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';

const AMOUNTS = [50, 100, 200, 300, 500, 1000];

export default function TopupPage() {
  const { user, refresh, loading: authLoading } = useAuth();
  const [method, setMethod] = useState<'truemoney' | 'promptpay'>('truemoney');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pendingRef, setPendingRef] = useState<{ reference: string; amount: number } | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (authLoading) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-brand-400 mb-4"></i>
          <p className="text-gray-400 dark:text-gray-500">กำลังโหลด...</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
            <i className="fas fa-lock text-2xl text-gray-300 dark:text-gray-600"></i>
          </div>
          <h2 className="text-xl font-bold mb-2 dark:text-white">กรุณาเข้าสู่ระบบ</h2>
          <p className="text-gray-500 dark:text-gray-400">คุณต้องเข้าสู่ระบบก่อนจึงจะเติมเงินได้</p>
        </div>
      </MainLayout>
    );
  }

  const handleTruemoney = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await api('/payment/truemoney/redeem', {
        method: 'POST',
        token: getToken()!,
        body: { giftLink: code },
      });
      setResult({ success: true, message: data.message as string || 'เติมเงินสำเร็จ!' });
      setCode('');
      refresh();
    } catch (err: unknown) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'เติมเงินไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  };

  const handlePromptpay = async () => {
    setLoading(true);
    setResult(null);
    setPendingRef(null);
    try {
      const data = await api('/payment/promptpay/create', {
        method: 'POST',
        token: getToken()!,
        body: { amount },
      });
      const reference = (data as Record<string, unknown>).reference as string;
      setPendingRef({ reference, amount });
      setResult({ success: true, message: `สร้าง QR สำเร็จ — Reference: ${reference}` });
    } catch (err: unknown) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'สร้าง QR ไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPromptpay = async () => {
    if (!pendingRef) return;
    setConfirming(true);
    setResult(null);
    try {
      await api('/payment/promptpay/confirm', {
        method: 'POST',
        token: getToken()!,
        body: { reference: pendingRef.reference },
      });
      setResult({ success: true, message: `เติมเงิน ${pendingRef.amount.toLocaleString()} ฿ สำเร็จ!` });
      setPendingRef(null);
      await refresh();
    } catch (err: unknown) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'ยืนยันการชำระไม่สำเร็จ' });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">
          <i className="fas fa-wallet mr-2 text-brand-500"></i>เติมเงิน
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">เติมเงินเข้ากระเป๋าเพื่อซื้อไอเทมในร้านค้า</p>

        {/* Balance Card */}
        <div className="card p-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 dark:bg-brand-500/10 rounded-full -translate-y-8 translate-x-8"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">ยอดเงินคงเหลือ</p>
              <p className="text-3xl font-bold text-success-600 dark:text-success-400">{user.wallet_balance?.toLocaleString()} ฿</p>
            </div>
            <div className="w-14 h-14 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center">
              <i className="fas fa-coins text-2xl text-brand-500"></i>
            </div>
          </div>
        </div>

        {/* Method Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setMethod('truemoney')}
            className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 text-sm transition-all duration-200 ${
              method === 'truemoney'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-theme-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <i className="fas fa-gift"></i> TrueMoney Wallet
          </button>
          <button
            onClick={() => setMethod('promptpay')}
            className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 text-sm transition-all duration-200 ${
              method === 'promptpay'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-theme-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <i className="fas fa-qrcode"></i> PromptPay
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-xl p-4 mb-6 ${
            result.success
              ? 'bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20'
              : 'bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20'
          }`}>
            <div className={`flex gap-2 text-sm ${result.success ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'}`}>
              <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'} mt-0.5`}></i>
              <span>{result.message}</span>
            </div>
          </div>
        )}

        {/* TrueMoney Form */}
        {method === 'truemoney' && (
          <div className="card p-5">
            <h3 className="font-semibold mb-4 dark:text-white">
              <i className="fas fa-gift mr-2 text-brand-400"></i>เติมด้วย TrueMoney Voucher
            </h3>
            <form onSubmit={handleTruemoney} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">ลิงก์ Gift Voucher (TrueMoney)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input"
                  placeholder="https://gift.truemoney.com/campaign/?v=XXXXXXXX"
                  required
                  maxLength={200}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? (
                  <><i className="fas fa-spinner fa-spin"></i> กำลังตรวจสอบ...</>
                ) : (
                  <><i className="fas fa-check"></i> เติมเงิน</>
                )}
              </button>
            </form>
          </div>
        )}

        {/* PromptPay Form */}
        {method === 'promptpay' && (
          <div className="card p-5">
            <h3 className="font-semibold mb-4 dark:text-white">
              <i className="fas fa-qrcode mr-2 text-brand-400"></i>เติมด้วย PromptPay QR
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">เลือกจำนวนเงิน</label>
                <div className="grid grid-cols-3 gap-2">
                  {AMOUNTS.map(a => (
                    <button
                      key={a}
                      onClick={() => { setAmount(a); setPendingRef(null); setResult(null); }}
                      className={`py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                        amount === a
                          ? 'bg-brand-500 text-white shadow-theme-sm'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {a.toLocaleString()} ฿
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handlePromptpay} disabled={loading || confirming} className="btn-primary w-full justify-center py-3">
                {loading ? (
                  <><i className="fas fa-spinner fa-spin"></i> กำลังสร้าง QR...</>
                ) : (
                  <><i className="fas fa-qrcode"></i> สร้าง QR Code ({amount.toLocaleString()} ฿)</>
                )}
              </button>
              {pendingRef && (
                <div className="border border-warning-200 dark:border-warning-500/20 bg-warning-50 dark:bg-warning-500/10 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-warning-700 dark:text-warning-400">
                    <i className="fas fa-info-circle mr-1"></i>
                    สแกน QR แล้วกด <strong>ยืนยันการชำระเงิน</strong> เพื่อรับเงินเข้ากระเป๋า
                  </p>
                  <p className="text-xs text-warning-600 dark:text-warning-500 break-all">Reference: {pendingRef.reference}</p>
                  <button
                    onClick={handleConfirmPromptpay}
                    disabled={confirming}
                    className="w-full py-2.5 rounded-lg font-medium bg-success-500 hover:bg-success-600 text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    {confirming ? (
                      <><i className="fas fa-spinner fa-spin"></i> กำลังยืนยัน...</>
                    ) : (
                      <><i className="fas fa-check-circle"></i> ยืนยันการชำระเงิน</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
