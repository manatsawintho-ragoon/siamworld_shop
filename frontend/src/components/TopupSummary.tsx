'use client';
import { ReactNode } from 'react';
import { Zap, Sparkles, Wallet, Info } from 'lucide-react';
import type { ActiveCampaign } from './CampaignBanner';

interface TopupSummaryProps {
  /** Payment brand colour. PromptPay #003b80, TrueMoney #ed1c24. */
  accent: string;
  /** Channel name shown in the rail header. */
  method: string;
  /**
   * Baht the player is paying. `null` when the amount is not known yet, which is
   * the normal case for an Angpao gift: the value only exists inside the voucher.
   */
  amount: number | null;
  /** Top-up bonus multiplier for this channel. 1 means no bonus. */
  bonusMult: number;
  campaign: ActiveCampaign | null;
  walletBalance: number;
  /** Discount-code block, or anything else that belongs under the totals. */
  children?: ReactNode;
}

/**
 * The persistent right-hand rail on both top-up pages: what you pay, what lands
 * in the wallet, and what it earns. It stays mounted for the whole flow so the
 * player never loses sight of the numbers while scanning or uploading.
 */
export default function TopupSummary({
  accent, method, amount, bonusMult, campaign, walletBalance, children,
}: TopupSummaryProps) {
  const hasBonus = bonusMult > 1;
  const credited = amount !== null ? amount * bonusMult : null;
  const meetsCampaign = campaign !== null && amount !== null && amount >= campaign.minTopupAmount;
  const points = campaign && amount !== null ? Math.floor(amount * campaign.pointsPerBaht) : 0;

  return (
    <div className="rounded-xl border-2 border-border-muted bg-surface-hover/40 p-4 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-foreground-subtle uppercase tracking-widest">สรุปรายการ</p>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: accent }}>
          {method}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-foreground-subtle">ยอดที่ชำระ</span>
          <span className="text-sm font-black text-foreground-muted tabular-nums">
            {amount !== null ? `฿${amount.toLocaleString()}` : 'ตามยอดในซอง'}
          </span>
        </div>

        {hasBonus && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-orange-700 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" strokeWidth={2.5} /> โบนัสเติมเงิน
            </span>
            <span className="text-sm font-black text-orange-700 tabular-nums">x{bonusMult}</span>
          </div>
        )}

        <div className="border-t border-border-muted pt-2.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-foreground-subtle uppercase tracking-wider">ได้รับเข้า Wallet</span>
          <span className="text-2xl font-black tabular-nums leading-none" style={{ color: hasBonus ? '#c2410c' : accent }}>
            {credited !== null ? `฿${credited.toLocaleString()}` : `x${bonusMult}`}
          </span>
        </div>
      </div>

      {campaign && (
        <div className={`rounded-lg px-3 py-2 flex items-start gap-2 border text-[11px] font-bold ${
          amount === null || meetsCampaign
            ? 'bg-primary/10 border-primary/25 text-primary'
            : 'bg-warning/10 border-warning/25 text-warning'
        }`}>
          {amount === null ? (
            <>
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
              <span>เติมตั้งแต่ ฿{campaign.minTopupAmount.toLocaleString()} ขึ้นไป รับแต้มแคมเปญ</span>
            </>
          ) : meetsCampaign ? (
            <>
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
              <span>จะได้รับ {points.toLocaleString()} point</span>
            </>
          ) : (
            <>
              <Info className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.25} />
              <span>เติมอีก ฿{(campaign.minTopupAmount - amount).toLocaleString()} จึงจะได้รับแต้มแคมเปญ</span>
            </>
          )}
        </div>
      )}

      {children}

      <div className="border-t border-border-muted pt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-foreground-subtle flex items-center gap-1.5">
          <Wallet className="w-3 h-3" strokeWidth={2.5} /> ยอดคงเหลือปัจจุบัน
        </span>
        <span className="text-sm font-black text-foreground tabular-nums">
          ฿{Number(walletBalance || 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
