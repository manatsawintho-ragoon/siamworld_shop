'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface InventoryItem {
  id: number; loot_box_id: number; loot_box_item_id: number;
  item_name: string; item_image?: string; item_rarity: string;
  status: 'PENDING' | 'REDEEMED'; box_name: string; won_at: string; redeemed_at?: string;
}
interface Server { id: number; name: string; }

const RARITY_CONFIG: Record<string, { label: string; color: string }> = {
  legendary: { label: 'Legendary', color: '#FFD700' },
  epic: { label: 'Epic', color: '#9B59B6' },
  rare: { label: 'Rare', color: '#3498DB' },
  uncommon: { label: 'Uncommon', color: '#2ECC71' },
  common: { label: 'Common', color: '#95A5A6' },
};
const PAGE_SIZE = 12;

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REDEEMED'>('ALL');
  const [page, setPage] = useState(1);
  const [redeemModal, setRedeemModal] = useState<InventoryItem | null>(null);
  const [selectedServer, setSelectedServer] = useState<number>(0);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemAllModal, setRedeemAllModal] = useState(false);
  const [redeemAllServer, setRedeemAllServer] = useState<number>(0);
  const [redeemAllLoading, setRedeemAllLoading] = useState(false);
  const [redeemAllError, setRedeemAllError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const load = () => {
    if (!getToken()) return;
    api('/user/inventory', { token: getToken()! })
      .then(d => setItems((d.items as InventoryItem[]) || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !user) { router.push('/'); return; }
    if (!authLoading && user) {
      load();
      api('/public/servers').then(d => {
        const srvs = (d.servers as Server[]) || [];
        setServers(srvs);
        if (srvs.length > 0) { setSelectedServer(srvs[0].id); setRedeemAllServer(srvs[0].id); }
      });
    }
  }, [authLoading, user]);

  useEffect(() => { setPage(1); }, [filter]);

  const handleRedeem = async () => {
    if (!redeemModal || selectedServer === 0) return;
    setRedeemLoading(true); setRedeemError('');
    try {
      const result = await api(`/user/inventory/${redeemModal.id}/redeem`, { method: 'POST', token: getToken()!, body: { serverId: selectedServer } });
      showToast(`ส่ง "${(result as any).itemName || redeemModal.item_name}" เข้าเกมสำเร็จ!`);
      setRedeemModal(null); load();
    } catch (err: any) { setRedeemError(err?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    setRedeemLoading(false);
  };

  const handleRedeemAll = async () => {
    if (redeemAllServer === 0) return;
    setRedeemAllLoading(true); setRedeemAllError('');
    try {
      const result = await api('/user/inventory/redeem-all', { method: 'POST', token: getToken()!, body: { serverId: redeemAllServer } }) as any;
      setRedeemAllModal(false); load();
      if (result.successCount > 0) showToast(`ส่งเข้าเกมสำเร็จ ${result.successCount} ชิ้น${result.failCount > 0 ? ` (ล้มเหลว ${result.failCount} ชิ้น)` : '!'}`);
      else showToast('ไม่มีไอเทมที่ส่งสำเร็จ');
    } catch (err: any) { setRedeemAllError(err?.message || 'เกิดข้อผิดพลาด'); }
    setRedeemAllLoading(false);
  };

  const filtered = items.filter(i => filter === 'ALL' || i.status === filter);
  const pendingCount = items.filter(i => i.status === 'PENDING').length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <MainLayout>
      <div className="w-full">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <i className="fas fa-box text-primary" aria-hidden="true"></i>คลังของรางวัล
              {pendingCount > 0 && <span className="bg-warning text-black text-xs font-black px-2.5 py-0.5 rounded-full tabular-nums">{pendingCount} รอรับ</span>}
            </h1>
            <p className="text-foreground-muted text-sm mt-1">ไอเทมที่คุณสุ่มได้ กดรับเพื่อส่งเข้าเกม Minecraft ของคุณ</p>
          </div>
          {pendingCount > 0 && (
            <button onClick={() => { setRedeemAllError(''); setRedeemAllModal(true); }}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-primary hover:bg-primary-hover text-white shadow-theme-sm transition-all active:scale-95 min-h-[44px]">
              <i className="fas fa-gamepad" aria-hidden="true"></i> รับทั้งหมด <span className="tabular-nums">({pendingCount})</span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="bg-success-light border border-success/20 text-success-foreground px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              <i className="fas fa-check-circle" aria-hidden="true"></i><span>{toast}</span>
              <button onClick={() => setToast('')} className="ml-auto text-success hover:opacity-70" aria-label="ปิด"><i className="fas fa-times" aria-hidden="true"></i></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-1 mb-6 bg-surface-hover p-1 rounded-xl w-fit">
          {(['ALL', 'PENDING', 'REDEEMED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 min-h-[40px] ${filter === f ? 'bg-surface shadow-theme-xs text-foreground' : 'text-foreground-muted hover:text-foreground'}`}>
              {f === 'ALL' ? `ทั้งหมด (${items.length})` : f === 'PENDING' ? `รอรับ (${pendingCount})` : `รับแล้ว (${items.length - pendingCount})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="rounded-2xl h-52 skeleton" />)}
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-hover rounded-2xl flex items-center justify-center">
              <i className="fas fa-box-open text-2xl text-foreground-subtle" aria-hidden="true"></i>
            </div>
            <p className="text-lg font-medium text-foreground-muted">{filter === 'PENDING' ? 'ไม่มีไอเทมรอรับ' : 'คลังว่างเปล่า'}</p>
            <p className="text-sm mt-1 text-foreground-subtle">{filter !== 'REDEEMED' && <a href="/lootbox" className="text-primary hover:underline">ลองเปิดกล่องสุ่มไหม?</a>}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {paginated.map(item => {
                const rc = RARITY_CONFIG[item.item_rarity] || RARITY_CONFIG.common;
                const isPending = item.status === 'PENDING';
                return (
                  <div key={item.id} className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-theme-md hover:-translate-y-0.5 ${isPending ? '' : 'border-border bg-surface-hover'}`}
                    style={isPending ? { borderColor: rc.color + '44', background: 'linear-gradient(135deg, #1a1a2e, #16213e)' } : {}}>
                    <div className={`absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5 rounded-full ${isPending ? 'bg-warning text-black' : 'bg-surface text-foreground-muted'}`}>
                      {isPending ? '⏳ รอรับ' : '✓ รับแล้ว'}
                    </div>
                    <div className="aspect-square flex items-center justify-center p-4">
                      {item.item_image ? (
                        <img src={item.item_image} alt={item.item_name} className={`w-20 h-20 object-contain drop-shadow-lg ${!isPending ? 'opacity-40 grayscale' : ''}`}
                          style={isPending ? { filter: `drop-shadow(0 0 10px ${rc.color}66)` } : {}} />
                      ) : (<i className="fas fa-cube text-5xl" style={{ color: isPending ? rc.color : '#9ca3af' }} aria-hidden="true"></i>)}
                    </div>
                    <div className="px-3 pb-3">
                      <div className="text-xs font-bold px-1.5 py-0.5 rounded-md mb-1 inline-block" style={{ color: rc.color, backgroundColor: rc.color + '22' }}>{rc.label}</div>
                      <p className={`font-bold text-sm leading-tight line-clamp-2 ${isPending ? 'text-white' : 'text-foreground-muted'}`}>{item.item_name}</p>
                      <p className="text-xs mt-0.5 truncate text-foreground-subtle">{item.box_name}</p>
                      <p className="text-xs text-foreground-subtle mt-0.5 tabular-nums">{new Date(item.won_at).toLocaleDateString('th-TH')}</p>
                      {isPending && (
                        <button onClick={() => { setRedeemModal(item); setRedeemError(''); }}
                          className="mt-2 w-full py-2 rounded-xl text-xs font-bold text-white transition-all shadow-theme-xs hover:shadow-theme-sm active:scale-95 min-h-[36px]"
                          style={{ background: `linear-gradient(135deg, ${rc.color}, ${rc.color}bb)` }}>
                          <i className="fas fa-gamepad mr-1" aria-hidden="true"></i>ส่งเข้าเกม
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Pagination">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Previous">
                  <i className="fas fa-chevron-left text-xs" aria-hidden="true"></i>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                  if ((p === page - 2 && page > 3) || (p === page + 2 && page < totalPages - 2)) return <span key={p} className="text-foreground-subtle px-1">…</span>;
                  if (!show) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined}
                      className={`w-10 h-10 rounded-xl border text-sm font-medium transition-all duration-200 ${p === page ? 'bg-primary text-white border-primary shadow-theme-xs' : 'border-border text-foreground-muted hover:bg-surface-hover'}`}>{p}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Next">
                  <i className="fas fa-chevron-right text-xs" aria-hidden="true"></i>
                </button>
                <span className="text-xs text-foreground-subtle ml-2 tabular-nums">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length} ชิ้น</span>
              </nav>
            )}
          </>
        )}
      </div>

      {/* Single Redeem Modal */}
      <AnimatePresence>
        {redeemModal && (
          <div className="modal-overlay" onClick={() => setRedeemModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }} className="modal-content max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-[#1e1e1e] px-6 py-4">
                {(() => { const rc = RARITY_CONFIG[redeemModal.item_rarity] || RARITY_CONFIG.common; return (
                  <div className="flex items-center gap-3">
                    {redeemModal.item_image ? <img src={redeemModal.item_image} alt={redeemModal.item_name} className="w-14 h-14 object-contain drop-shadow-lg" style={{ filter: `drop-shadow(0 0 8px ${rc.color})` }} />
                      : <i className="fas fa-cube text-3xl" style={{ color: rc.color }} aria-hidden="true"></i>}
                    <div><div className="text-xs font-bold mb-0.5" style={{ color: rc.color }}>{rc.label}</div>
                      <h3 className="text-white font-bold text-base leading-tight">{redeemModal.item_name}</h3>
                      <p className="text-gray-400 text-xs">{redeemModal.box_name}</p></div>
                  </div>); })()}
              </div>
              <div className="p-5">
                <p className="text-sm text-foreground font-medium mb-1">เลือกเซิร์ฟเวอร์ที่คุณออนไลน์อยู่</p>
                <p className="text-xs text-foreground-subtle mb-3"><i className="fas fa-exclamation-triangle text-warning mr-1" aria-hidden="true"></i>คุณต้องออนไลน์อยู่ในเกมก่อนกดรับ</p>
                <select value={selectedServer} onChange={e => setSelectedServer(Number(e.target.value))} className="input mb-3" aria-label="เลือกเซิร์ฟเวอร์">
                  <option value={0} disabled>— เลือกเซิร์ฟเวอร์ —</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {redeemError && <div className="bg-error-light border border-error/20 text-error text-xs px-3 py-2 rounded-xl mb-3 flex items-start gap-2"><i className="fas fa-times-circle mt-0.5 flex-shrink-0" aria-hidden="true"></i><span>{redeemError}</span></div>}
                <div className="flex gap-2">
                  <button onClick={() => setRedeemModal(null)} className="btn-ghost flex-1 justify-center">ยกเลิก</button>
                  <button onClick={handleRedeem} disabled={redeemLoading || selectedServer === 0}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-success text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 min-h-[44px]">
                    {redeemLoading ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : <i className="fas fa-gamepad" aria-hidden="true"></i>}
                    {redeemLoading ? 'กำลังส่ง...' : 'ส่งเข้าเกม'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Redeem All Modal */}
      <AnimatePresence>
        {redeemAllModal && (
          <div className="modal-overlay" onClick={() => !redeemAllLoading && setRedeemAllModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }} className="modal-content max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-[#1e1e1e] px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><i className="fas fa-gamepad text-primary text-lg" aria-hidden="true"></i></div>
                <div><h3 className="text-white font-bold">รับทั้งหมด</h3><p className="text-gray-400 text-xs tabular-nums">{pendingCount} ไอเทมรอการรับ</p></div>
              </div>
              <div className="p-5">
                <p className="text-sm text-foreground font-medium mb-1">เลือกเซิร์ฟเวอร์ที่คุณออนไลน์อยู่</p>
                <p className="text-xs text-foreground-subtle mb-3"><i className="fas fa-exclamation-triangle text-warning mr-1" aria-hidden="true"></i>คุณต้องออนไลน์อยู่ในเกมก่อนรับของ ระบบจะส่งทุกไอเทมเข้าเกมทีเดียว</p>
                <select value={redeemAllServer} onChange={e => setRedeemAllServer(Number(e.target.value))} className="input mb-3" aria-label="เลือกเซิร์ฟเวอร์">
                  <option value={0} disabled>— เลือกเซิร์ฟเวอร์ —</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {redeemAllError && <div className="bg-error-light border border-error/20 text-error text-xs px-3 py-2 rounded-xl mb-3 flex items-start gap-2"><i className="fas fa-times-circle mt-0.5 flex-shrink-0" aria-hidden="true"></i><span>{redeemAllError}</span></div>}
                <div className="flex gap-2">
                  <button onClick={() => setRedeemAllModal(false)} disabled={redeemAllLoading} className="btn-ghost flex-1 justify-center">ยกเลิก</button>
                  <button onClick={handleRedeemAll} disabled={redeemAllLoading || redeemAllServer === 0}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95 min-h-[44px]">
                    {redeemAllLoading ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : <i className="fas fa-gamepad" aria-hidden="true"></i>}
                    {redeemAllLoading ? 'กำลังส่ง...' : 'ส่งทั้งหมด'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
