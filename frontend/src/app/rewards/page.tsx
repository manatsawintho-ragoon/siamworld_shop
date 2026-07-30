'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import {
  Gift, Coins, Sparkles, Package, Lock, Loader2, Check, AlertCircle, ArrowRight, Clock,
} from 'lucide-react';

interface Reward {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  pointCost: number;
  stock: number | null;
  perUserLimit: number | null;
  alreadyRedeemed: number;
  requiresCampaignId: number | null;
  campaignLocked: boolean;
  isNew: boolean;
}

/** Client-side mirror of reward.logic.checkRedeemable, for the button state. */
function blockReason(r: Reward, balance: number, signedIn: boolean): string | null {
  if (!signedIn) return 'เข้าสู่ระบบเพื่อแลก';
  if (r.campaignLocked) return 'เฉพาะช่วงแคมเปญ';
  if (r.stock !== null && r.stock <= 0) return 'ของหมด';
  if (r.perUserLimit !== null && r.alreadyRedeemed >= r.perUserLimit) return 'แลกครบแล้ว';
  if (balance < r.pointCost) return 'point ไม่พอ';
  return null;
}

export default function RewardShopPage() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(() => {
    const token = getToken();
    Promise.all([
      api('/rewards', { token: token ?? undefined })
        .then(d => setRewards((d.rewards as Reward[]) || [])).catch(() => setRewards([])),
      token
        ? api('/campaign/points', { token })
            .then(d => setBalance(Number(d.balance) || 0)).catch(() => setBalance(0))
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const redeem = async (reward: Reward) => {
    setRedeeming(reward.id);
    setFeedback(null);
    try {
      // A fresh key per click: retries of THIS click dedupe, but a deliberate
      // second redemption of the same reward is still allowed.
      const idempotencyKey = `${reward.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await api(`/rewards/${reward.id}/redeem`, {
        method: 'POST', token: getToken()!, body: { idempotencyKey },
      });
      setFeedback({ type: 'ok', text: `แลก "${reward.name}" สำเร็จ ไปรับของในกระเป๋าได้เลย` });
      load();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'แลกของรางวัลไม่สำเร็จ' });
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <MainLayout>
      {/* Header + balance */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-10 h-10 rounded-2xl bg-primary/12 flex items-center justify-center flex-shrink-0">
          <Gift className="w-5 h-5 text-primary" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-foreground leading-tight">แลกของรางวัล</h1>
          <p className="text-xs text-foreground-subtle mt-0.5">ใช้ point จากแคมเปญเติมเงินแลกของในเกม</p>
        </div>

        {user && (
          /* Wraps to its own full-width row on phones instead of being squeezed
             next to the title - the balance is what decides whether anything on
             this page is affordable, so it should stay legible. */
          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl theme-navbar-banner text-white shadow-theme-sm">
            <Coins className="w-4 h-4 text-white/85" strokeWidth={2.5} />
            <div className="leading-tight">
              <p className="text-[10px] font-bold text-white/75 uppercase tracking-wider">point ของคุณ</p>
              <p className="text-base font-black tabular-nums">{balance.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Points are a one-way sink; saying so up front prevents support tickets. */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/8 border border-primary/15 mb-5">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.25} />
        <p className="text-[11px] sm:text-xs text-foreground-muted leading-relaxed">
          point ได้จากการเติมเงินช่วงแคมเปญ ใช้แลกของรางวัลได้อย่างเดียว
          แลกเป็นเงินหรือถอนออกไม่ได้ และของที่แลกแล้วจะเข้า
          <Link href="/inventory" className="text-primary font-bold mx-1 underline underline-offset-2">กระเป๋าของคุณ</Link>
          ให้กดรับเข้าเกมตอนออนไลน์
        </p>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2.5 p-3 rounded-xl mb-5 border ${
          feedback.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700'
            : 'bg-rose-500/10 border-rose-500/25 text-rose-600'}`}>
          {feedback.type === 'ok'
            ? <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />}
          <p className="text-xs font-bold">{feedback.text}</p>
          {feedback.type === 'ok' && (
            <Link href="/inventory" className="ml-auto inline-flex items-center gap-1 text-[11px] font-black">
              ไปที่กระเป๋า <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="theme-card overflow-hidden animate-pulse">
              <div className="aspect-square bg-border-muted" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-border rounded-full w-3/4" />
                <div className="h-6 bg-border rounded-lg w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-20 theme-card">
          <div className="w-14 h-14 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6 text-foreground-subtle" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-bold text-foreground">ยังไม่มีของรางวัล</p>
          <p className="text-xs text-foreground-subtle mt-1">รอผู้ดูแลเพิ่มของรางวัลเร็ว ๆ นี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rewards.map((r, i) => {
            const blocked = blockReason(r, balance, Boolean(user));
            const remaining = r.perUserLimit !== null ? r.perUserLimit - r.alreadyRedeemed : null;
            return (
              <motion.div key={r.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
                className="theme-card overflow-hidden flex flex-col">

                <div className="aspect-square bg-surface-hover relative overflow-hidden">
                  {r.image ? (
                    <img src={r.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="w-9 h-9 text-foreground-subtle/40" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                    {r.isNew && (
                      <span className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide">NEW</span>
                    )}
                    {r.campaignLocked && (
                      <span className="inline-flex items-center gap-1 bg-black/65 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" strokeWidth={2.5} /> แคมเปญ
                      </span>
                    )}
                  </div>
                  {r.stock !== null && r.stock <= 5 && r.stock > 0 && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-amber-500 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" strokeWidth={2.5} /> เหลือ {r.stock}
                    </span>
                  )}
                </div>

                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-bold text-foreground text-[13px] leading-snug line-clamp-2">{r.name}</h3>
                  {r.description && (
                    <p className="text-[11px] text-foreground-subtle mt-1 line-clamp-2">{r.description}</p>
                  )}

                  <div className="flex items-center gap-1.5 mt-2.5">
                    <Coins className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
                    <span className="text-base font-black text-primary tabular-nums">{r.pointCost.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-foreground-subtle">point</span>
                  </div>

                  {remaining !== null && (
                    <p className="text-[10px] text-foreground-subtle mt-1">
                      แลกได้อีก {Math.max(0, remaining)} จาก {r.perUserLimit} ครั้ง
                    </p>
                  )}

                  <button
                    onClick={() => redeem(r)}
                    disabled={Boolean(blocked) || redeeming === r.id}
                    className={`mt-3 w-full py-2.5 min-h-[40px] rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                      blocked
                        ? 'bg-surface-hover text-foreground-subtle cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:brightness-110 active:scale-95'}`}>
                    {redeeming === r.id
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} /> กำลังแลก</>
                      : blocked
                        ? blocked
                        : <>แลกเลย <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} /></>}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
