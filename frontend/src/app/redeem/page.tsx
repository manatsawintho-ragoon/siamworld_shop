'use client';
import { useState, useEffect, useRef } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, CheckCircle2, XCircle, X, Info, Server, Check, Loader2,
  Gift, Gamepad2, Coins, Headphones, type LucideIcon,
} from 'lucide-react';

interface Server { id: number; name: string; }

export default function RedeemCodePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode]         = useState('');
  const [servers, setServers]   = useState<Server[]>([]);
  const [serverId, setServerId] = useState<number>(0);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ success: boolean; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api('/public/servers').then(d => {
      const list = (d.servers as Server[]) || [];
      setServers(list);
      if (list.length > 0) setServerId(list[0].id);
    });
  }, []);

  if (!authLoading && !user) { router.push('/'); return null; }

  // Step 1: button click → open the "are you logged in-game?" confirmation modal.
  // Step 2: modal "yes" → actually call the redeem endpoint.
  // This stops players from spamming codes before they've logged into the MC server.
  const handleRedeemClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setResult(null);
    setConfirmOpen(true);
  };

  const doRedeem = async () => {
    setConfirmOpen(false);
    setLoading(true); setResult(null);
    try {
      const body: any = { code: code.trim() };
      if (serverId) body.serverId = serverId;
      const d = await api('/user/redeem-code', { method: 'POST', token: getToken()!, body }) as any;
      setResult({ success: true, message: d.message || 'ใช้โค้ดสำเร็จ!' });
      setCode('');
    } catch (err: any) {
      setResult({ success: false, message: err?.message || 'เกิดข้อผิดพลาด' });
    }
    setLoading(false);
  };

  const tips: { Icon: LucideIcon; tint: string; text: string }[] = [
    { Icon: Gamepad2,   tint: '34 197 94',   text: 'สำหรับโค้ดประเภทไอเท็ม คุณต้องออนไลน์อยู่ในเซิร์ฟเวอร์ที่เลือกก่อนกดใช้โค้ด' },
    { Icon: Coins,      tint: '245 158 11',  text: 'โค้ดประเภทเครดิต จะเพิ่มเงินเข้ากระเป๋าทันที ไม่ต้องออนไลน์ในเกม' },
    { Icon: Ticket,     tint: '59 130 246',  text: 'โค้ดแต่ละตัวสามารถใช้ได้เพียง 1 ครั้งต่อบัญชีเท่านั้น' },
    { Icon: Headphones, tint: '168 85 247',  text: 'พบปัญหาการใช้โค้ด? ติดต่อทีมงานผ่านช่อง Discord' },
  ];

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Ticket className="w-5 h-5 text-orange-500" strokeWidth={2.25} /> แลกโค้ด
          </h1>
          <p className="text-xs text-foreground-subtle mt-0.5">กรอกโค้ดเพื่อรับไอเท็มหรือเครดิตเข้าบัญชีทันที</p>
        </div>

        {/* ── Main Redeem Card ── */}
        <div className="bg-surface rounded-2xl shadow-sm border border-border/70 overflow-hidden">

          {/* Card Header */}
          <div className="px-5 py-3.5 border-b border-border bg-surface-hover/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/12 flex items-center justify-center flex-shrink-0">
              <Ticket className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.25} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">กรอกโค้ด</h3>
              <p className="text-[11px] text-foreground-subtle">โค้ดแต่ละตัวสามารถใช้ได้ 1 ครั้งต่อบัญชี</p>
            </div>
          </div>

          <form onSubmit={handleRedeemClick} className="p-5 space-y-5">

            {/* Result Banner */}
            <AnimatePresence>
              {result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium ${
                    result.success
                      ? 'bg-success/10 border-success/25 text-success'
                      : 'bg-error/10 border-error/25 text-error'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    result.success ? 'bg-success/15' : 'bg-error/15'
                  }`}>
                    {result.success
                      ? <CheckCircle2 className="w-4 h-4 text-success" strokeWidth={2.25} />
                      : <XCircle className="w-4 h-4 text-error" strokeWidth={2.25} />}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="font-bold text-[13px] leading-tight">
                      {result.success ? 'ใช้โค้ดสำเร็จ!' : 'ไม่สำเร็จ'}
                    </p>
                    <p className="text-[12px] mt-0.5 opacity-80 leading-snug">{result.message}</p>
                  </div>
                  <button type="button" onClick={() => setResult(null)} aria-label="ปิด"
                    className="w-6 h-6 rounded flex items-center justify-center text-current opacity-40 hover:opacity-70 transition-opacity flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Code Input */}
            <div>
              <label className="block text-xs font-bold text-foreground-subtle mb-2">
                โค้ดไอเท็ม <span className="text-error">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none">
                  <Ticket className="w-4 h-4" strokeWidth={2} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setResult(null); }}
                  placeholder="เช่น WELCOME2024"
                  className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-border font-mono font-black text-foreground text-lg tracking-[0.15em] text-center focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-foreground-subtle placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-base bg-surface-hover/50 transition-all"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="โค้ดไอเท็ม"
                />
                {code && (
                  <button type="button" onClick={() => { setCode(''); setResult(null); inputRef.current?.focus(); }} aria-label="ล้างโค้ด"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-surface-hover hover:bg-border flex items-center justify-center text-foreground-subtle hover:text-foreground-muted transition-colors">
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-foreground-subtle mt-1.5 flex items-center gap-1">
                <Info className="w-2.5 h-2.5" strokeWidth={2.25} />
                ตัวอักษรจะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ
              </p>
            </div>

            {/* Server Select */}
            {servers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-foreground-subtle mb-2">
                  เซิร์ฟเวอร์ที่จะรับไอเท็ม
                </label>
                <div className={`grid gap-2 ${servers.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {servers.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServerId(s.id)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                        serverId === s.id
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_2px_0_rgb(var(--color-primary-hover))]'
                          : 'border-border bg-surface text-foreground-subtle hover:border-primary/40 hover:bg-surface-hover'
                      }`}
                      aria-pressed={serverId === s.id}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        serverId === s.id ? 'bg-primary/15' : 'bg-surface-hover'
                      }`}>
                        <Server className={`w-3 h-3 ${serverId === s.id ? 'text-primary' : 'text-foreground-subtle'}`} strokeWidth={2.25} />
                      </div>
                      <span className="truncate">{s.name}</span>
                      {serverId === s.id && (
                        <Check className="w-3 h-3 text-primary ml-auto flex-shrink-0" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-foreground-subtle mt-1.5 flex items-center gap-1">
                  <Info className="w-2.5 h-2.5" strokeWidth={2.25} />
                  สำหรับโค้ดประเภทไอเท็ม คุณต้องออนไลน์ในเซิร์ฟเวอร์ที่เลือก
                </p>
              </div>
            )}

            {servers.length === 0 && (
              <div className="flex items-center gap-2 text-foreground-subtle text-xs py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                กำลังโหลดเซิร์ฟเวอร์...
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[15px] font-black rounded-xl shadow-[0_4px_0_rgb(var(--color-primary-shadow))] hover:brightness-110 transition-all active:shadow-[0_2px_0_rgb(var(--color-primary-shadow))] active:translate-y-[2px]"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> กำลังตรวจสอบโค้ด...</>
              ) : (
                <><Gift className="w-4 h-4" strokeWidth={2.25} /> ใช้โค้ด</>
              )}
            </button>

          </form>
        </div>

        {/* ── Tips Card ── */}
        <div className="bg-surface rounded-2xl shadow-sm border border-border/70 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-surface-hover/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/12 flex items-center justify-center flex-shrink-0">
              <Info className="w-3.5 h-3.5 text-blue-500" strokeWidth={2.25} />
            </div>
            <h3 className="font-bold text-foreground text-sm">วิธีใช้งาน</h3>
          </div>
          <div className="p-5 space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `rgb(${tip.tint} / 0.12)` }}>
                  <tip.Icon className="w-3 h-3" strokeWidth={2.25} style={{ color: `rgb(${tip.tint})` }} />
                </div>
                <p className="text-[12px] text-foreground-subtle leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* "Are you logged in-game?" confirmation modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              className="bg-surface rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-border"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-border-muted flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-amber-500" strokeWidth={2.25} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">ตรวจสอบสถานะการเล่น</h3>
                  <p className="text-[11px] text-foreground-subtle mt-0.5">ก่อนใช้โค้ดประเภทไอเท็ม</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-foreground leading-relaxed">
                  คุณ <b>กำลังออนไลน์ในเซิร์ฟเวอร์ Minecraft</b> ใช่ไหม?
                </p>
                <p className="text-xs text-foreground-muted mt-2 leading-relaxed">
                  หากคุณยังไม่ได้เข้าเกม กรุณาเข้าเกมก่อนแล้วกลับมากดยืนยัน เพื่อให้ระบบส่งไอเท็มถึงตัวคุณได้ทันที
                </p>
              </div>
              <div className="px-6 py-4 bg-surface-hover flex items-center justify-end gap-2 border-t border-border-muted">
                <button onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-surface border border-border text-foreground-muted">
                  ยังไม่ได้เข้าเกม
                </button>
                <button onClick={doRedeem}
                  className="px-5 py-2.5 text-[13px] font-bold rounded-lg bg-amber-500 text-white shadow-[0_3px_0_#b45309] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> ยืนยัน (ออนไลน์อยู่)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
