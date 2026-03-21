'use client';
import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Server { id: number; name: string; }

export default function RedeemCodePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [servers, setServers] = useState<Server[]>([]);
  const [serverId, setServerId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
    } catch (err: any) { setResult({ success: false, message: err?.message || 'เกิดข้อผิดพลาด' }); }
    setLoading(false);
  };

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2 mb-2">
          <i className="fas fa-ticket-alt text-primary" aria-hidden="true"></i>ใช้โค้ดไอเทม
        </h1>
        <p className="text-foreground-muted text-sm mb-6">กรอกโค้ดเพื่อรับไอเทมเข้าเกม ต้องออนไลน์ในเซิร์ฟเวอร์</p>

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

        {/* Redeem Form */}
        <div className="card p-5 animate-fade-in">
          <h2 className="font-bold text-foreground mb-1">กรอกโค้ด</h2>
          <p className="text-xs text-foreground-muted mb-4">ใส่โค้ดที่ได้รับมาเพื่อรับไอเทมไปยังตัวละครของคุณ</p>
          <form onSubmit={handleRedeem} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1.5">โค้ดไอเทม</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="เช่น WELCOME2024"
                className="input font-mono text-center tracking-widest text-lg"
                required
                aria-label="โค้ดไอเทม"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1.5">เซิร์ฟเวอร์ที่จะรับไอเทม</label>
              {servers.length === 0 ? (
                <p className="text-xs text-foreground-muted">กำลังโหลดเซิร์ฟเวอร์...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {servers.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServerId(s.id)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${serverId === s.id
                        ? 'bg-primary text-white shadow-theme-xs'
                        : 'bg-surface-hover text-foreground-muted hover:bg-border'}`}
                    >
                      <i className="fas fa-server mr-1.5 text-xs" aria-hidden="true"></i>{s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || !code.trim()} className="btn-success w-full justify-center py-2.5 min-h-[44px]">
              {loading ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> กำลังตรวจสอบ...</> : <><i className="fas fa-gift" aria-hidden="true"></i> ใช้โค้ด</>}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="mt-6 bg-primary/5 border border-primary/10 rounded-xl p-4 text-xs text-foreground-muted space-y-1">
          <p><i className="fas fa-info-circle text-primary mr-1" aria-hidden="true"></i>คุณต้องออนไลน์อยู่ในเซิร์ฟเวอร์ที่เลือกเพื่อรับไอเทม</p>
          <p><i className="fas fa-ticket-alt text-primary mr-1" aria-hidden="true"></i>โค้ดแต่ละตัวสามารถใช้ได้ 1 ครั้งต่อบัญชี</p>
          <p><i className="fas fa-headset text-primary mr-1" aria-hidden="true"></i>พบปัญหา? ติดต่อเราผ่าน Discord</p>
        </div>
      </div>
    </MainLayout>
  );
}
