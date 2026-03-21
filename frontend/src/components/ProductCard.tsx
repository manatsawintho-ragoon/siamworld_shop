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
  const [showBuy, setShowBuy] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number>(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (servers.length > 0 && selectedServer === 0) setSelectedServer(servers[0].id);
  }, [servers]);

  const imgSrc = product.image_url || product.image;
  const discount =
    product.original_price && product.original_price > product.price
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
      {/* Card */}
      <article className="group relative flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]">
        {/* Image area */}
        <div className="relative aspect-square bg-gray-50 flex items-center justify-center p-4 overflow-hidden">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <i className="fas fa-cube text-4xl text-primary/20 group-hover:text-primary/40 transition-colors" aria-hidden="true"></i>
          )}
          {discount > 0 && (
            <span className="absolute top-2 left-2 bg-error text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg">
              -{discount}%
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col gap-1.5 flex-1">
          <p className="text-gray-900 font-bold text-sm leading-tight line-clamp-2">{product.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {discount > 0 && product.original_price && (
              <span className="text-foreground-subtle text-[10px] line-through">
                {product.original_price.toLocaleString()} ฿
              </span>
            )}
            <span className="text-warning font-black text-sm">
              {product.price.toLocaleString()} ฿
            </span>
          </div>
          <div className="flex gap-1.5 mt-auto pt-1">
            <button
              onClick={() => setShowDetail(true)}
              className="flex-1 py-2.5 px-2 text-xs font-bold rounded-lg border border-gray-200 bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-primary transition-colors min-h-[44px]"
            >
              <i className="fas fa-info-circle mr-1"></i>รายละเอียด
            </button>
            <button
              onClick={() => setShowBuy(true)}
              className="flex-[2] py-2.5 px-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary/80 text-white transition-colors shadow-[0_0_10px_rgba(34,197,94,0.3)] min-h-[44px]"
            >
              <i className="fas fa-shopping-cart mr-1"></i>ซื้อเลย
            </button>
          </div>
        </div>
      </article>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <div className="modal-overlay" onClick={() => setShowDetail(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="modal-content max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-black text-gray-900 text-base leading-tight flex-1 pr-3">{product.name}</h3>
                  <button onClick={() => setShowDetail(false)} className="w-7 h-7 rounded-md bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors text-xs">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                {imgSrc && (
                  <div className="w-24 h-24 mx-auto mb-4 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                    <img src={imgSrc} alt={product.name} className="w-20 h-20 object-contain" />
                  </div>
                )}
                {product.description && (
                  <p className="text-foreground-muted text-xs leading-relaxed mb-4">{product.description}</p>
                )}
                {product.category_name && (
                  <div className="text-[10px] text-foreground-subtle mb-3">
                    <i className="fas fa-tag mr-1"></i>หมวดหมู่: <span className="text-foreground-muted">{product.category_name}</span>
                  </div>
                )}
                <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-4">
                  {discount > 0 && product.original_price ? (
                    <div className="flex items-center gap-3">
                      <span className="text-error text-sm font-black">-{discount}%</span>
                      <div>
                        <div className="text-foreground-subtle text-xs line-through">{product.original_price.toLocaleString()} ฿</div>
                        <div className="text-warning font-black text-lg">{product.price.toLocaleString()} ฿</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-warning font-black text-lg">{product.price.toLocaleString()} ฿</div>
                  )}
                </div>
                <button onClick={() => { setShowDetail(false); setShowBuy(true); }} className="btn-primary w-full justify-center py-2.5">
                  <i className="fas fa-shopping-cart mr-2"></i>ซื้อสินค้า
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Buy Modal */}
      <AnimatePresence>
        {showBuy && (
          <div className="modal-overlay" onClick={() => !buying && setShowBuy(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="modal-content max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-black text-white text-sm">ยืนยันการซื้อสินค้า</h3>
                  <button onClick={() => !buying && setShowBuy(false)} className="w-7 h-7 rounded-md bg-white/5 hover:bg-error/20 text-foreground-muted hover:text-error-foreground flex items-center justify-center transition-colors text-xs">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="flex items-center gap-3 bg-black/30 rounded-lg p-3 border border-white/5 mb-4">
                  {imgSrc ? (
                    <img src={imgSrc} alt={product.name} className="w-12 h-12 object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 flex-shrink-0 bg-primary/10 rounded-md flex items-center justify-center">
                      <i className="fas fa-cube text-primary text-xl"></i>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {discount > 0 && product.original_price && (
                        <span className="text-foreground-subtle text-xs line-through">{product.original_price.toLocaleString()} ฿</span>
                      )}
                      <span className="text-warning font-black">{product.price.toLocaleString()} ฿</span>
                      {discount > 0 && <span className="bg-error text-white text-[9px] font-black px-1 rounded">-{discount}%</span>}
                    </div>
                  </div>
                </div>
                {!user ? (
                  <div className="text-xs text-error-foreground font-bold bg-error/10 border border-error/20 rounded-lg px-3 py-2 mb-4 text-center">
                    กรุณาเข้าสู่ระบบก่อนทำรายการ
                  </div>
                ) : (
                  <>
                    {servers.length > 0 && (
                      <div className="mb-3">
                        <label className="block text-[11px] font-bold text-foreground-muted mb-1.5">เลือกเซิร์ฟเวอร์ปลายทาง</label>
                        <select value={selectedServer} onChange={e => setSelectedServer(Number(e.target.value))} className="input text-xs py-2" disabled={buying}>
                          {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="text-[10px] text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1.5 mb-4 flex items-start gap-1.5">
                      <i className="fas fa-exclamation-triangle mt-0.5 flex-shrink-0"></i>
                      <span>กรุณาออนไลน์ในเซิร์ฟเวอร์ก่อนกดซื้อ เพื่อรับไอเทมทันที</span>
                    </div>
                  </>
                )}
                {result && (
                  <div className={`text-xs font-bold p-2.5 rounded-lg mb-3 border flex items-start gap-2 ${result.success ? 'bg-primary/10 text-primary border-primary/30' : 'bg-error/10 text-error-foreground border-error/30'}`}>
                    <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'} flex-shrink-0 mt-0.5`}></i>
                    {result.message}
                  </div>
                )}
                <div className="flex gap-2">
                  {user && !result?.success && (
                    <button onClick={handleBuy} disabled={buying} className="btn-primary flex-1 justify-center py-2.5 text-xs">
                      {buying ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-shopping-cart mr-1"></i>ยืนยันซื้อ</>}
                    </button>
                  )}
                  <button onClick={() => setShowBuy(false)} disabled={buying} className="btn-ghost flex-1 justify-center py-2.5 text-xs">
                    ยกเลิก
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
