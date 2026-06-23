'use client';
import { useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { useAdminAlert } from '@/components/AdminAlert';

// Per-method bonus resolver (mirrors backend resolveTopupBonus, with legacy fallback).
function methodBonus(settings: Record<string, string>, method: 'promptpay' | 'truemoney') {
  const enabled = (settings[`topup_bonus_${method}_enabled`] ?? settings['topup_bonus_enabled']) === 'true';
  const mult = parseFloat(settings[`topup_bonus_${method}_multiplier`] ?? settings['topup_bonus_multiplier'] ?? '1') || 1;
  return enabled && mult > 1 ? mult : 1;
}

export default function TopupSelectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert } = useAdminAlert();
  const { settings } = useSettings();

  const ppEnabled  = settings['promptpay_enabled'] !== 'false'; // default on if unset
  const tmnEnabled = settings['truemoney_enabled'] === 'true';  // default off until configured
  const ppMult  = methodBonus(settings, 'promptpay');
  const tmnMult = methodBonus(settings, 'truemoney');

  useEffect(() => {
    if (!authLoading && !user) {
      alert({ type: 'warning', title: 'กรุณาเข้าสู่ระบบ', message: 'คุณต้องล็อกอินก่อนเติมเงิน' }).then(() => {
        router.push('/');
      });
    }
  }, [authLoading, user, router]);
  if (authLoading || !user) return null;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-4 pb-8 font-prompt">

        {/* Header */}
        <div className="bg-surface border-2 border-green-200 rounded-xl p-4 shadow-theme-sm">
          <h1 className="text-lg font-black text-foreground leading-none">เติมเงินเข้าระบบ</h1>
          <p className="text-xs font-bold text-foreground-subtle mt-1.5">เลือกช่องทางที่ต้องการเติมเงิน</p>
        </div>

        {/* Method chooser */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* PromptPay Card */}
          <button
            onClick={() => ppEnabled && router.push('/topup/promptpay')}
            disabled={!ppEnabled}
            className={`group relative bg-surface rounded-2xl border-2 overflow-hidden flex flex-col shadow-theme-sm transition-all duration-300 text-center h-[300px] ${
              ppEnabled ? 'border-green-200 hover:border-[#003b80] hover:shadow-lg' : 'border-border grayscale opacity-70 cursor-not-allowed'
            }`}
          >
            {ppEnabled && ppMult > 1 && (
              <span className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black shadow-sm">
                <i className="fas fa-bolt text-[9px]" /> โบนัส x{ppMult}
              </span>
            )}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fas fa-qrcode text-7xl text-[#003b80]"></i>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-[#003b80]/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                <img src="/images/thai_qr_payment.png" alt="PromptPay" className="relative h-20 w-auto object-contain transform group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#003b80]">PromptPay</h3>
                <p className="text-xs font-bold text-foreground-subtle leading-tight">
                  สแกนจ่ายผ่าน QR Code<br/>
                  <span className="text-[9px] uppercase tracking-wider opacity-60">
                    {ppEnabled ? 'รองรับทุกแอปธนาคาร' : 'ยังไม่เปิดใช้งาน'}
                  </span>
                </p>
              </div>
            </div>
            <div className={`py-3.5 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${ppEnabled ? 'bg-[#003b80] group-hover:bg-[#004ba3]' : 'bg-gray-300'}`}>
              {ppEnabled ? <>เลือกช่องทางนี้ <i className="fas fa-chevron-right text-[9px] group-hover:translate-x-1 transition-transform"></i></> : 'ไม่พร้อมใช้งาน'}
            </div>
          </button>

          {/* TrueMoney Card */}
          <button
            onClick={() => tmnEnabled && router.push('/topup/truemoney')}
            disabled={!tmnEnabled}
            className={`group relative bg-surface rounded-2xl border-2 overflow-hidden flex flex-col shadow-theme-sm transition-all duration-300 text-center h-[300px] ${
              tmnEnabled ? 'border-green-200 hover:border-[#ed1c24] hover:shadow-lg' : 'border-border grayscale opacity-70 cursor-not-allowed'
            }`}
          >
            {tmnEnabled && tmnMult > 1 && (
              <span className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500 text-white text-[10px] font-black shadow-sm">
                <i className="fas fa-bolt text-[9px]" /> โบนัส x{tmnMult}
              </span>
            )}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <i className="fas fa-wallet text-7xl text-[#ed1c24]"></i>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-[#ed1c24]/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                <img src="/images/truemoney_wallet.png" alt="TrueMoney" className="relative h-16 w-auto object-contain transform group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#ed1c24]">TrueMoney Wallet</h3>
                <p className="text-xs font-bold text-foreground-subtle leading-tight">
                  เติมผ่านซองของขวัญ<br/>
                  <span className="text-[9px] uppercase tracking-wider opacity-60">
                    {tmnEnabled ? 'วางลิงก์ซองของขวัญ' : 'ยังไม่เปิดใช้งาน'}
                  </span>
                </p>
              </div>
            </div>
            <div className={`py-3.5 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${tmnEnabled ? 'bg-[#ed1c24] group-hover:bg-[#c81118]' : 'bg-gray-300'}`}>
              {tmnEnabled ? <>เลือกช่องทางนี้ <i className="fas fa-chevron-right text-[9px] group-hover:translate-x-1 transition-transform"></i></> : 'ไม่พร้อมใช้งาน'}
            </div>
          </button>
        </div>

        {!ppEnabled && !tmnEnabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
            <i className="fas fa-triangle-exclamation text-amber-500 text-sm" />
            <p className="text-[12px] font-bold text-amber-800">ขณะนี้ร้านยังไม่เปิดรับการเติมเงิน กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
