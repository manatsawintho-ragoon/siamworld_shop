'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Sparkles, Coins, Timer } from 'lucide-react';

export interface ActiveCampaign {
  id: number;
  pointsPerBaht: number;
  minTopupAmount: number;
  endsAt: string;
}

/** Shared fetch of GET /api/campaign/active - public, no auth. Used by the
 * banner itself and by the top-up amount nudge so both read the same data
 * without duplicating the fetch/type. */
export function useActiveCampaign(): ActiveCampaign | null {
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<any>('/campaign/active')
      .then(d => { if (!cancelled) setCampaign(((d as any).campaign as ActiveCampaign | null) ?? null); })
      .catch(() => { if (!cancelled) setCampaign(null); });
    return () => { cancelled = true; };
  }, []);

  return campaign;
}

/** "2 วัน 04:12:33" or, once under a day is left, just "04:12:33". */
function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hhmmss = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return days > 0 ? `${days} วัน ${hhmmss}` : hhmmss;
}

export default function CampaignBanner() {
  const campaign = useActiveCampaign();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!campaign) { setRemainingMs(null); return; }

    setEnded(false);
    const endsAtMs = new Date(campaign.endsAt).getTime();
    setRemainingMs(endsAtMs - Date.now());

    intervalRef.current = setInterval(() => {
      const remaining = endsAtMs - Date.now();
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRemainingMs(0);
        setEnded(true);
      } else {
        setRemainingMs(remaining);
      }
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [campaign?.id, campaign?.endsAt]);

  if (!campaign || ended || remainingMs === null || remainingMs <= 0) return null;

  // Smallest whole-baht amount that yields at least 1 point, so the rate reads
  // naturally regardless of how the operator configured pointsPerBaht (e.g.
  // 0.1 -> "every ฿10 = 1 point", 2 -> "every ฿1 = 2 point").
  const bahtPerPoint = campaign.pointsPerBaht > 0 ? Math.ceil(1 / campaign.pointsPerBaht) : 0;
  const pointsAtThatAmount = bahtPerPoint > 0 ? Math.max(1, Math.floor(bahtPerPoint * campaign.pointsPerBaht)) : 0;

  return (
    <div className="theme-navbar-banner rounded-xl p-4 shadow-theme-sm border border-white/10 text-white">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" strokeWidth={2.25} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black leading-tight">แคมเปญเติมเงินพิเศษ</h2>
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1 text-[11px] font-bold text-white/85">
            {bahtPerPoint > 0 && (
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3" strokeWidth={2.5} /> เติมทุก ฿{bahtPerPoint.toLocaleString()} รับ {pointsAtThatAmount} point
              </span>
            )}
            {campaign.minTopupAmount > 0 && (
              <span>ขั้นต่ำ ฿{campaign.minTopupAmount.toLocaleString()} ต่อครั้ง</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-black/15 border border-white/20 rounded-lg px-3 py-2 flex-shrink-0">
          <Timer className="w-3.5 h-3.5 text-white/80" strokeWidth={2.5} />
          <span className="text-xs font-black tabular-nums">เหลือเวลา {formatCountdown(remainingMs)}</span>
        </div>
      </div>
    </div>
  );
}
