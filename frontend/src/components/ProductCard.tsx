'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url?: string;
  image?: string;
  category_name?: string;
}

interface Server {
  id: number;
  name: string;
}

export default function ProductCard({ product, servers }: { product: Product; servers: Server[] }) {
  const { user, refresh } = useAuth();
  const [buying, setBuying] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number>(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (servers.length > 0 && selectedServer === 0) {
      setSelectedServer(servers[0].id);
    }
  }, [servers]);

  const imgSrc = product.image_url || product.image;
  const discount = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const handleBuy = async () => {
    if (!user || selectedServer === 0) return;
    setBuying(true);
    setResult(null);
    try {
      const data = await api('/shop/buy', {
        method: 'POST',
        token: getToken()!,
        body: { productId: product.id, serverId: selectedServer, idempotencyKey: crypto.randomUUID() },
      });
      setResult({ success: true, message: (data.message as string) || 'ซื้อสำเร็จ! ไอเทมถูกส่งเข้าเกมแล้ว' });
      await refresh();
      setTimeout(() => setShowBuy(false), 2000);
    } catch (err: unknown) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setBuying(false);
    }
  };

  return (
    <>
      <article onClick={() => setShowBuy(true)} className="group relative block cursor-pointer transition-transform hover:-translate-y-1">
        {/* Minecraft Slot Style Box */}
        <div className="bg-[#8b8b8b] p-1 rounded-sm shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.5),inset_2px_2px_0_rgba(255,255,255,0.5)]">
          <div className="bg-[#373737] relative aspect-square shadow-[inset_2px_2px_0_rgba(0,0,0,0.8),inset_-2px_-2px_0_rgba(255,255,255,0.2)] overflow-hidden flex flex-col justify-between group-hover:bg-[#4a4a4a] transition-colors">
            
            {/* Image Center */}
            <div className="flex-1 flex items-center justify-center p-4">
              {imgSrc ? (
                <img src={imgSrc} alt={product.name} className="w-20 h-20 object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform pixelated" style={{ imageRendering: 'pixelated' }} />
              ) : (
                <i className="fas fa-cube text-4xl text-white/30 drop-shadow-md" aria-hidden="true"></i>
              )}
            </div>

            {/* Bottom Info Bar inside slot */}
            <div className="bg-black/40 px-2 py-1 flex items-center justify-between text-[10px] text-white font-bold font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <span className="truncate mr-1 drop-shadow-md">{product.name}</span>
              <span className="text-warning drop-shadow-md whitespace-nowrap">
                {product.price.toLocaleString()} ฿
              </span>
            </div>

            {discount > 0 && (
              <span className="absolute top-1 right-1 bg-error text-white px-1.5 py-0.5 text-[9px] font-black shadow-md border border-red-800">
                -{discount}%
              </span>
            )}
          </div>
        </div>
      </article>

      {/* Buy Confirmation Modal - Classic Window Style */}
      <AnimatePresence>
        {showBuy && (
          <div className="modal-overlay" onClick={() => !buying && setShowBuy(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-[#c6c6c6] border-[3px] border-white border-b-[#555] border-r-[#555] p-1 font-mono"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-xs font-bold font-sans">
                <span>ยืนยันการทำรายการ</span>
                <button onClick={() => !buying && setShowBuy(false)} className="bg-[#c6c6c6] text-black w-4 h-4 flex items-center justify-center border-t-white border-l-white border-b-[#555] border-r-[#555] border active:border-t-[#555] active:border-l-[#555] active:border-b-white active:border-r-white font-bold leading-none pb-0.5 focus:outline-none">
                  x
                </button>
              </div>

              <div className="p-4 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#373737] p-2 flex items-center justify-center shadow-[inset_2px_2px_0_rgba(0,0,0,0.8),inset_-2px_-2px_0_rgba(255,255,255,0.2)] mb-3">
                  {imgSrc ? (
                    <img src={imgSrc} alt="item" className="w-12 h-12 object-contain pixelated" style={{ imageRendering: 'pixelated' }} />
                  ) : <i className="fas fa-cube text-white/30 text-2xl"></i>}
                </div>
                
                <h3 className="font-bold text-black text-sm mb-1">{product.name}</h3>
                <p className="text-xs text-black/70 mb-3">{product.description}</p>
                <div className="text-sm font-black text-amber-700 bg-white/50 px-3 py-1 border border-black/10 shadow-inner mb-4">
                  ราคา {product.price.toLocaleString()} ฿
                </div>

                {!user ? (
                  <div className="text-xs text-red-600 font-bold mb-4">คุณต้องเข้าสู่ระบบก่อนทำรายการ</div>
                ) : (
                  <>
                    {servers.length > 0 && (
                      <div className="w-full mb-3 text-left">
                        <label className="block text-[10px] font-bold text-black mb-1">เลือกเซิร์ฟเวอร์ปลายทาง:</label>
                        <select 
                          value={selectedServer} 
                          onChange={(e) => setSelectedServer(Number(e.target.value))} 
                          className="w-full p-1.5 text-xs bg-white border-t-[#555] border-l-[#555] border-b-white border-r-white border text-black focus:outline-none"
                        >
                          {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="text-[10px] text-red-600 font-bold mb-4 text-left w-full border border-red-300 bg-red-50 p-1.5">
                      ⚠️ แจ้งเตือน: กรุณาออนไลน์ในเซิร์ฟเวอร์ก่อนกดซื้อ
                    </div>
                  </>
                )}

                {result && (
                  <div className={`w-full text-xs font-bold p-2 mb-3 border ${result.success ? 'bg-green-100 text-green-800 border-green-400' : 'bg-red-100 text-red-800 border-red-400'}`}>
                    {result.message}
                  </div>
                )}

                <div className="flex gap-2 w-full justify-center">
                  {user && (
                    <button 
                      onClick={handleBuy} 
                      disabled={buying} 
                      className="px-6 py-1.5 bg-[#c6c6c6] text-black text-xs font-bold border-t-white border-l-white border-b-[#555] border-r-[#555] border-[2px] active:border-t-[#555] active:border-l-[#555] active:border-b-white active:border-r-white outline-none focus:outline-none"
                    >
                      {buying ? 'กำลังส่งข้อมูล...' : 'ซื้อไอเทม'}
                    </button>
                  )}
                  <button 
                    onClick={() => setShowBuy(false)} 
                    disabled={buying} 
                    className="px-6 py-1.5 bg-[#c6c6c6] text-black text-xs font-bold border-t-white border-l-white border-b-[#555] border-r-[#555] border-[2px] active:border-t-[#555] active:border-l-[#555] active:border-b-white active:border-r-white outline-none focus:outline-none"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
