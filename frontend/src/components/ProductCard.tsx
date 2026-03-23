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
      setResult({ success: true, message: (data.message as string) || 'ซื้อสำเร็จ! ไอเท็มถูกส่งเข้าเกมแล้ว' });
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
      <article className="group relative flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-amber-300 transition-all duration-200 hover:shadow-md">

        {/* Image area */}
        <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">

          {/* Category badge — top left (on image) */}
          {product.category_name && (
            <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-700 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-gray-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              {product.category_name}
            </span>
          )}

          {/* Discount badge — top right (on image) */}
          {discount > 0 && (
            <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-lg">
              <i className="fas fa-tag text-[9px]" />
              -{discount}%
            </span>
          )}

          {/* Image */}
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-amber-50">
              <i className="fas fa-cube text-5xl text-amber-200 group-hover:text-amber-300 transition-colors" aria-hidden="true" />
            </div>
          )}

          {/* Bottom price overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent px-3 py-5 flex items-end justify-between gap-2">
            {discount > 0 && product.original_price ? (
              <span className="text-white/75 text-xs font-medium line-through tabular-nums leading-none drop-shadow">
                {product.original_price.toLocaleString()} ฿
              </span>
            ) : <span />}
            <span className="bg-amber-500 text-white text-sm font-black px-3 py-1.5 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)] tabular-nums leading-none flex-shrink-0">
              {product.price.toLocaleString()} ฿
            </span>
          </div>
        </div>

        {/* Info below image — flex-1 so button always pins to bottom */}
        <div className="p-3 flex flex-col flex-1">
          <p className="text-gray-900 font-bold text-sm leading-tight line-clamp-1">{product.name}</p>

          {product.description && (
            <p className="text-gray-400 text-[10px] leading-snug line-clamp-1 mt-1.5 mb-1">
              {product.description}
            </p>
          )}

          <button
            onClick={() => setShowBuy(true)}
            className="w-full mt-auto pt-3 pb-2.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-white transition-all flex items-center justify-center gap-1.5 min-h-[40px] shadow-[0_3px_0_#b45309] hover:shadow-[0_1px_0_#b45309] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px]"
          >
            <i className="fas fa-shopping-cart text-[11px]" /> ซื้อเลย!
          </button>
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
              {/* Image header */}
              {imgSrc && (
                <div className="relative h-48 bg-gray-100 overflow-hidden rounded-t-xl">
                  <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {discount > 0 && (
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg">
                      -{discount}%
                    </span>
                  )}
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <h3 className="font-black text-white text-base leading-tight flex-1 pr-3 drop-shadow">{product.name}</h3>
                    <button onClick={() => setShowDetail(false)} className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500/80 text-white flex items-center justify-center transition-colors text-xs flex-shrink-0">
                      <i className="fas fa-times" />
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4">
                {!imgSrc && (
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-black text-gray-900 text-base leading-tight flex-1 pr-3">{product.name}</h3>
                    <button onClick={() => setShowDetail(false)} className="w-7 h-7 rounded-md bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors text-xs">
                      <i className="fas fa-times" />
                    </button>
                  </div>
                )}

                {product.category_name && (
                  <div className="flex items-center gap-1.5 text-gray-500 text-[11px] mb-3">
                    <i className="fas fa-tag text-green-500 text-[10px]" />
                    <span>{product.category_name}</span>
                  </div>
                )}

                {product.description && (
                  <p className="text-gray-500 text-xs leading-relaxed mb-4">{product.description}</p>
                )}

                {/* Price block */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-4">
                  {discount > 0 && product.original_price ? (
                    <div className="flex items-center gap-3">
                      <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-md">-{discount}%</span>
                      <div>
                        <div className="text-gray-400 text-xs line-through tabular-nums">{product.original_price.toLocaleString()} ฿</div>
                        <div className="text-green-600 font-black text-xl tabular-nums">{product.price.toLocaleString()} ฿</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-green-600 font-black text-xl tabular-nums">{product.price.toLocaleString()} ฿</div>
                  )}
                </div>

                <button
                  onClick={() => { setShowDetail(false); setShowBuy(true); }}
                  className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_3px_0_#15803d] hover:shadow-[0_1px_0_#15803d] hover:translate-y-[2px] transition-all min-h-[48px]"
                >
                  <i className="fas fa-shopping-cart" /> ซื้อสินค้า
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Buy Modal */}
      <AnimatePresence>
        {showBuy && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !buying && setShowBuy(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.18)] w-full max-w-sm overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-shopping-cart text-amber-500 text-xs" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-sm leading-none">ยืนยันการซื้อสินค้า</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">ตรวจสอบรายละเอียดก่อนยืนยัน</p>
                </div>
                <button
                  onClick={() => !buying && setShowBuy(false)}
                  className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b91c1c] active:translate-y-[1px] flex-shrink-0"
                >
                  <i className="fas fa-times text-xs" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">

                {/* Product block */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {imgSrc ? (
                    <div className="w-14 h-14 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                      <img src={imgSrc} alt={product.name} className="w-12 h-12 object-contain" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-cube text-amber-300 text-xl" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-tight truncate">{product.name}</p>
                    {product.category_name && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{product.category_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {discount > 0 && product.original_price && (
                        <span className="text-gray-400 text-xs line-through tabular-nums">{product.original_price.toLocaleString()} ฿</span>
                      )}
                      <span className="text-amber-500 font-black text-base tabular-nums leading-none">{product.price.toLocaleString()} ฿</span>
                      {discount > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">-{discount}%</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Not logged in */}
                {!user && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <i className="fas fa-lock text-red-400 text-sm flex-shrink-0" />
                    <span className="text-xs font-bold text-red-500">กรุณาเข้าสู่ระบบก่อนทำรายการ</span>
                  </div>
                )}

                {/* Server select + warning */}
                {user && (
                  <>
                    {servers.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                          <i className="fas fa-server text-[10px] mr-1 text-gray-400" />
                          เลือกเซิร์ฟเวอร์ปลายทาง
                        </label>
                        <select
                          value={selectedServer}
                          onChange={e => setSelectedServer(Number(e.target.value))}
                          disabled={buying}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 bg-white text-gray-800"
                        >
                          {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                      <i className="fas fa-exclamation-triangle text-amber-400 text-sm mt-0.5 flex-shrink-0" />
                      <span className="text-[11px] text-amber-700 font-medium">กรุณาออนไลน์ในเซิร์ฟเวอร์ก่อนกดซื้อ เพื่อรับไอเท็มทันที</span>
                    </div>
                  </>
                )}

                {/* Result message */}
                {result && (
                  <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs font-bold ${
                    result.success
                      ? 'bg-green-50 border-green-100 text-green-700'
                      : 'bg-red-50 border-red-100 text-red-600'
                  }`}>
                    <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'} mt-0.5 flex-shrink-0`} />
                    {result.message}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center gap-2">
                <button
                  onClick={() => !buying && setShowBuy(false)}
                  disabled={buying}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-[0_1px_0_#d1d5db] active:translate-y-[1px] disabled:opacity-50"
                >
                  <i className="fas fa-times text-[11px]" /> ยกเลิก
                </button>
                {user && !result?.success && (
                  <button
                    onClick={handleBuy}
                    disabled={buying}
                    className="flex-[2] flex items-center justify-center gap-2 px-5 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px] disabled:opacity-50"
                  >
                    {buying
                      ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังซื้อ...</>
                      : <><i className="fas fa-shopping-cart text-[12px]" /> ยืนยันซื้อ</>}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
