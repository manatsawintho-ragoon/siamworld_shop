'use client';
import { useState, useEffect, useRef } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

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

  useEffect(() => {
    api('/public/servers').then(d => {
      const list = (d.servers as Server[]) || [];
      setServers(list);
      if (list.length > 0) setServerId(list[0].id);
    });
  }, []);

  if (!authLoading && !user) { router.push('/'); return null; }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
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

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-ticket-alt text-[#f97316]" /> แลกโค้ด
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">กรอกโค้ดเพื่อรับไอเท็มหรือเครดิตเข้าบัญชีทันที</p>
        </div>

        {/* ── Main Redeem Card ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

          {/* Card Header */}
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-ticket-alt text-amber-500 text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">กรอกโค้ด</h3>
              <p className="text-[11px] text-gray-400">โค้ดแต่ละตัวสามารถใช้ได้ 1 ครั้งต่อบัญชี</p>
            </div>
          </div>

          <form onSubmit={handleRedeem} className="p-5 space-y-5">

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
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-600'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    result.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <i className={`fas text-sm ${result.success ? 'fa-circle-check text-green-600' : 'fa-circle-xmark text-red-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="font-bold text-[13px] leading-tight">
                      {result.success ? 'ใช้โค้ดสำเร็จ!' : 'ไม่สำเร็จ'}
                    </p>
                    <p className="text-[12px] mt-0.5 opacity-80 leading-snug">{result.message}</p>
                  </div>
                  <button type="button" onClick={() => setResult(null)}
                    className="w-6 h-6 rounded flex items-center justify-center text-current opacity-40 hover:opacity-70 transition-opacity flex-shrink-0 mt-0.5">
                    <i className="fas fa-times text-[11px]" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Code Input */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                โค้ดไอเท็ม <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
                  <i className="fas fa-ticket-alt text-base" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setResult(null); }}
                  placeholder="เช่น WELCOME2024"
                  className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-gray-200 font-mono font-black text-gray-800 text-lg tracking-[0.15em] text-center focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-200 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-base bg-gray-50/50 transition-all"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="โค้ดไอเท็ม"
                />
                {code && (
                  <button type="button" onClick={() => { setCode(''); setResult(null); inputRef.current?.focus(); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                    <i className="fas fa-times text-[11px]" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                <i className="fas fa-info-circle" />
                ตัวอักษรจะถูกแปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ
              </p>
            </div>

            {/* Server Select */}
            {servers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
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
                          ? 'border-green-500 bg-green-50 text-green-700 shadow-[0_2px_0_#16a34a]'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      aria-pressed={serverId === s.id}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        serverId === s.id ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <i className={`fas fa-server text-[11px] ${serverId === s.id ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <span className="truncate">{s.name}</span>
                      {serverId === s.id && (
                        <i className="fas fa-check text-green-500 text-[11px] ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                  <i className="fas fa-circle-info" />
                  สำหรับโค้ดประเภทไอเท็ม คุณต้องออนไลน์ในเซิร์ฟเวอร์ที่เลือก
                </p>
              </div>
            )}

            {servers.length === 0 && (
              <div className="flex items-center gap-2 text-gray-400 text-xs py-2">
                <i className="fas fa-spinner fa-spin" />
                กำลังโหลดเซิร์ฟเวอร์...
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[15px] font-black rounded-xl shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]"
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin text-sm" /> กำลังตรวจสอบโค้ด...</>
              ) : (
                <><i className="fas fa-gift text-sm" /> ใช้โค้ด</>
              )}
            </button>

          </form>
        </div>

        {/* ── Tips Card ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-circle-info text-blue-500 text-xs" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">วิธีใช้งาน</h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              { icon: 'fa-gamepad',      color: 'text-green-500',  bg: 'bg-green-50',  text: 'สำหรับโค้ดประเภทไอเท็ม คุณต้องออนไลน์อยู่ในเซิร์ฟเวอร์ที่เลือกก่อนกดใช้โค้ด' },
              { icon: 'fa-coins',        color: 'text-amber-500',  bg: 'bg-amber-50',  text: 'โค้ดประเภทเครดิต จะเพิ่มเงินเข้ากระเป๋าทันที ไม่ต้องออนไลน์ในเกม' },
              { icon: 'fa-ticket-alt',   color: 'text-blue-500',   bg: 'bg-blue-50',   text: 'โค้ดแต่ละตัวสามารถใช้ได้เพียง 1 ครั้งต่อบัญชีเท่านั้น' },
              { icon: 'fa-headset',      color: 'text-purple-500', bg: 'bg-purple-50', text: 'พบปัญหาการใช้โค้ด? ติดต่อทีมงานผ่านช่อง Discord' },
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg ${tip.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <i className={`fas ${tip.icon} ${tip.color} text-[11px]`} />
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
