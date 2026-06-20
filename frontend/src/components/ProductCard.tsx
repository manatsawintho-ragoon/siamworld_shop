'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url?: string;
  image?: string;
  image2?: string;
  image3?: string;
  category_name?: string;
  sold_count?: number;
}

interface Server {
  id: number;
  name: string;
}

export default function ProductCard({ product, servers }: { product: Product; servers: Server[] }) {
  const { user, refresh } = useAuth();
  const { toast } = useAdminAlert();
  const [showBuy, setShowBuy] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selectedServer, setSelectedServer] = useState<number>(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isGift, setIsGift] = useState(false);
  const [giftUsername, setGiftUsername] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (servers.length > 0 && selectedServer === 0) setSelectedServer(servers[0].id);
  }, [servers]);

  const imgSrc = product.image_url || product.image;
  const images = [imgSrc, product.image2, product.image3].filter((u): u is string => typeof u === 'string' && u.length > 0);
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % images.length), 3000);
    return () => clearInterval(t);
  }, [images.length]);
  const productPrice = Number(product.price);
  const originalPrice = product.original_price ? Number(product.original_price) : 0;

  const discount =
    originalPrice > productPrice
      ? Math.round(((originalPrice - productPrice) / originalPrice) * 100)
      : 0;

  const totalPrice = productPrice * quantity;

  const resetModal = () => {
    setShowBuy(false);
    setResult(null);
    setQuantity(1);
    setIsGift(false);
    setGiftUsername('');
  };

  const handleBuy = async () => {
    if (!user || selectedServer === 0) return;
    if (isGift && !giftUsername.trim()) {
      setResult({ success: false, message: 'กรุณาใส่ชื่อเพื่อนในเกมที่จะส่งของขวัญ' });
      return;
    }
    setBuying(true);
    setResult(null);
    try {
      // One order delivers the whole quantity in a single request (no per-item cooldown wait).
      const res = await api('/shop/buy', {
        method: 'POST',
        token: getToken()!,
        body: {
          productId: product.id,
          serverId: selectedServer,
          quantity,
          idempotencyKey: crypto.randomUUID(),
          ...(isGift && giftUsername.trim() ? { giftToUsername: giftUsername.trim() } : {}),
        },
      });
      await refresh();

      if (res?.status === 'partial') {
        // Some units couldn't be delivered; the undelivered remainder was already refunded.
        const delivered = res.deliveredUnits ?? 0;
        const requested = res.requestedUnits ?? quantity;
        setResult({
          success: false,
          message: `ส่งได้ ${delivered}/${requested} ชิ้น คืนเงินส่วนที่เหลือแล้ว (กรุณาออนไลน์แล้วลองอีกครั้ง)`,
        });
      } else {
        const msg = isGift
          ? `ส่งของขวัญให้ ${giftUsername} สำเร็จ! (${quantity} ชิ้น)`
          : quantity > 1
            ? `ซื้อสำเร็จ ${quantity} ชิ้น! ไอเท็มถูกส่งเข้าเกมแล้ว`
            : 'ไอเท็มถูกส่งเข้าเกมแล้ว';
        toast({ type: 'success', title: isGift ? 'ส่งของขวัญสำเร็จ!' : 'ซื้อสำเร็จ!', message: msg });
        resetModal();
      }
    } catch (err: unknown) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setBuying(false);
    }
  };

  return (
    <>
      {/* Card */}
      <motion.article 
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="group relative flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-amber-300 transition-all duration-200 hover:shadow-xl"
      >

        {/* Image area */}
        <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">

          {/* Category badge — top left (on image) */}
          {product.category_name && (
            <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-surface/90 backdrop-blur-sm text-foreground-muted text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-border/80">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgb(var(--color-primary))' }} />
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

          {/* Image / Carousel */}
          {images.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-amber-50">
              <i className="fas fa-cube text-5xl text-amber-200 group-hover:text-amber-300 transition-colors" aria-hidden="true" />
            </div>
          ) : images.length === 1 ? (
            <img
              src={images[0]}
              alt={product.name}
              className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 ease-out"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="product-carousel">
              {images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`product-carousel-slide${i === slideIdx ? ' is-active' : ''}`}
                  aria-hidden={i !== slideIdx}
                >
                  <img
                    src={src}
                    alt={product.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 ease-out"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              ))}
              <div className="product-carousel-dots" aria-hidden="true">
                {images.map((_, i) => (
                  <span key={i} className={`product-carousel-dot${i === slideIdx ? ' is-active' : ''}`} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom price overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 py-6 flex items-end justify-between gap-2">
            {discount > 0 && product.original_price ? (
              <span className="text-white/80 text-xs font-medium line-through tabular-nums leading-none drop-shadow-md">
                {product.original_price.toLocaleString()} ฿
              </span>
            ) : <span />}
            <span className="theme-price-badge text-sm font-black px-3 py-2 rounded-lg shadow-xl tabular-nums leading-none flex-shrink-0 transform group-hover:scale-110 transition-transform duration-300">
              {product.price.toLocaleString()} ฿
            </span>
          </div>
        </div>

        {/* Info below image — flex-1 so button always pins to bottom */}
        <div className="p-3 flex flex-col flex-1 bg-white relative z-10">
          <p className="text-gray-900 font-bold text-sm leading-tight line-clamp-1 group-hover:text-amber-600 transition-colors">{product.name}</p>

          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 w-fit">
            <i className="fas fa-fire text-orange-500 text-[10px]" />
            <span className="text-[11px] font-bold text-orange-700">
              ขายแล้ว <span className="tabular-nums font-black">{(product.sold_count ?? 0).toLocaleString()}</span> ชิ้น
            </span>
          </div>

          {/* Always render so every card keeps the same height, with or without a description. */}
          <button
            onClick={() => setShowDesc(true)}
            className="inline-flex items-center gap-1 mt-1.5 mb-1 text-[10px] font-bold transition-colors hover:brightness-110"
            style={{ color: 'rgb(var(--color-primary))' }}
          >
            <i className="fas fa-info-circle text-[9px]" /> ดูคำอธิบายสินค้า
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBuy(true)}
            className="btn-buy w-full mt-auto pt-3 pb-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 min-h-[40px] shadow-lg hover:shadow-xl transition-all"
          >
            <i className="fas fa-shopping-cart text-[11px]" /> ซื้อเลย!
          </motion.button>
        </div>
      </motion.article>

      {/* Description Popup */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div data-theme-portal="">
        <AnimatePresence>
          {showDesc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDesc(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.15 }}
                className="theme-card w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                  {imgSrc ? (
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                      <img src={imgSrc} alt={product.name} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-cube text-amber-300 text-lg" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{product.name}</h3>
                    {product.category_name && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{product.category_name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowDesc(false)}
                    className="btn-close"
                  >
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 min-h-0">
                  <div className="flex items-center gap-1.5 mb-3">
                    <i className="fas fa-align-left text-[12px]" style={{ color: 'rgb(var(--color-primary))' }} />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">คำอธิบายสินค้า</span>
                  </div>
                  {product.description ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-6 text-gray-400">
                      <i className="fas fa-circle-info text-2xl mb-2 opacity-40" />
                      <p className="text-sm font-medium">ยังไม่มีคำอธิบายเพิ่มเติมสำหรับสินค้านี้</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 flex-shrink-0">
                  <button
                    onClick={() => setShowDesc(false)}
                    className="btn-primary w-full py-2.5 text-[13px]"
                  >
                    <i className="fas fa-check text-[11px] mr-1.5" /> ปิด
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>,
        document.body
      )}

      {/* Buy Modal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div data-theme-portal="">
        <AnimatePresence>
          {showBuy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => { if (!buying) resetModal(); }}
            >
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="theme-card w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--color-primary), 0.1)', color: 'rgb(var(--color-primary))' }}>
                    <i className="fas fa-shopping-cart text-xs" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm leading-none">ยืนยันการซื้อสินค้า</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">ตรวจสอบรายละเอียดก่อนยืนยัน</p>
                  </div>
                  <button
                    onClick={() => { if (!buying) resetModal(); }}
                    className="btn-close"
                  >
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0">

                  {/* Product block */}
                  <div className="flex items-start gap-3 bg-gray-50/50 rounded-xl p-3 border border-gray-100">
                    {imgSrc ? (
                      <div className="w-14 h-14 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                        <img src={imgSrc} alt={product.name} className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} />
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
                      <button
                        onClick={() => setShowDesc(true)}
                        className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold transition-colors"
                        style={{ color: 'rgb(var(--color-primary))' }}
                      >
                        <i className="fas fa-info-circle text-[9px]" /> ดูคำอธิบายสินค้า
                      </button>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {discount > 0 && product.original_price && (
                          <span className="text-gray-400 text-xs line-through tabular-nums">{product.original_price.toLocaleString()} ฿</span>
                        )}
                        <span className="font-black text-base tabular-nums leading-none theme-price-text">{product.price.toLocaleString()} ฿</span>
                        {discount > 0 && (
                          <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">-{discount}%</span>
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

                  {/* Balance indicator */}
                  {user && (() => {
                    const bal = user.wallet_balance ?? 0;
                    const enough = bal >= totalPrice;
                    return (
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${enough ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <span className={enough ? 'text-green-600' : 'text-red-500'}>
                          <i className={`fas fa-wallet mr-1.5 text-[10px]`} />
                          ยอดเงินคงเหลือ
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-black tabular-nums ${enough ? 'text-green-700' : 'text-red-600'}`}>
                            {bal.toLocaleString()} ฿
                          </span>
                          {!enough && (
                            <span className="text-[10px] font-bold text-red-400 bg-red-100 px-1.5 py-0.5 rounded">
                              ไม่พอ -{(totalPrice - bal).toLocaleString()} ฿
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Server select + options */}
                  {user && (
                    <>
                      {servers.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                            <i className="fas fa-server text-[10px] mr-1" style={{ color: 'rgb(var(--color-primary))' }} />
                            เลือกเซิร์ฟเวอร์ปลายทาง
                          </label>
                          <select
                            value={selectedServer}
                            onChange={e => setSelectedServer(Number(e.target.value))}
                            disabled={buying}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:border-primary bg-surface text-foreground transition-all shadow-sm"
                            style={{ '--tw-ring-color': 'rgba(var(--color-primary), 0.3)' } as React.CSSProperties}
                          >
                            {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Quantity */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                          <i className="fas fa-layer-group text-[10px] mr-1" style={{ color: 'rgb(var(--color-primary))' }} />
                          จำนวนที่ต้องการซื้อ
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={buying || quantity <= 1}
                            className="w-10 h-10 rounded-lg border border-border bg-surface text-foreground font-bold text-lg flex items-center justify-center hover:bg-surface-hover disabled:opacity-40 transition-all shadow-sm"
                          >
                            <i className="fas fa-minus text-[11px]" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                            disabled={buying}
                            className="flex-1 text-center px-3 py-2.5 rounded-lg border border-border bg-surface text-foreground text-sm font-bold focus:outline-none focus:ring-2 focus:border-primary shadow-sm transition-all"
                            style={{ '--tw-ring-color': 'rgba(var(--color-primary), 0.3)' } as React.CSSProperties}
                          />
                          <button
                            onClick={() => setQuantity(q => Math.min(99, q + 1))}
                            disabled={buying || quantity >= 99}
                            className="w-10 h-10 rounded-lg border border-border bg-surface text-foreground font-bold text-lg flex items-center justify-center hover:bg-surface-hover disabled:opacity-40 transition-all shadow-sm"
                          >
                            <i className="fas fa-plus text-[11px]" />
                          </button>
                          {quantity > 1 && (
                            <span className="theme-price-text font-black text-sm tabular-nums whitespace-nowrap ml-1">
                              = {totalPrice.toLocaleString()} ฿
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Gift toggle */}
                      <div>
                        <button
                          onClick={() => { setIsGift(g => !g); setGiftUsername(''); setResult(null); }}
                          disabled={buying}
                          className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg border text-sm font-bold transition-all shadow-sm ${
                            isGift
                              ? 'bg-pink-50 border-pink-300 text-pink-600'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-pink-300 hover:text-pink-500'
                          }`}
                        >
                          <i className={`fas fa-gift text-[12px] ${isGift ? 'text-pink-500' : 'text-gray-400'}`} />
                          <span>{isGift ? 'ส่งของขวัญให้เพื่อน' : 'ส่งเป็นของขวัญ'}</span>
                          <div className={`ml-auto w-8 h-4 rounded-full transition-colors ${isGift ? 'bg-pink-500' : 'bg-gray-200'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow mt-0.5 transition-transform ${isGift ? 'translate-x-4.5 ml-0.5' : 'ml-0.5'}`} style={{ transform: isGift ? 'translateX(18px)' : 'translateX(2px)' }} />
                          </div>
                        </button>

                        <AnimatePresence>
                          {isGift && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }} 
                              animate={{ opacity: 1, height: 'auto' }} 
                              exit={{ opacity: 0, height: 0 }} 
                              className="mt-2 overflow-hidden"
                            >
                              <input
                                type="text"
                                placeholder="ชื่อเพื่อนในเกม (Minecraft username)"
                                value={giftUsername}
                                onChange={e => setGiftUsername(e.target.value)}
                                disabled={buying}
                                maxLength={64}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-pink-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/30 focus:border-pink-400 bg-white shadow-sm transition-all"
                              />
                              <p className="text-[10px] text-pink-500 mt-1 flex items-center gap-1 font-medium">
                                <i className="fas fa-info-circle text-[9px]" />
                                เพื่อนต้องออนไลน์อยู่ในเซิร์ฟเวอร์เดียวกัน
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                        <i className="fas fa-exclamation-triangle text-amber-500 text-sm mt-0.5 flex-shrink-0" />
                        <span className="text-[11px] text-amber-700 font-medium leading-relaxed">
                          {isGift
                            ? 'ทั้งคุณและผู้รับต้องออนไลน์อยู่ในเกม และอยู่ในเซิร์ฟเวอร์ก่อนกดยืนยัน'
                            : 'กรุณาออนไลน์ในเกม และอยู่ในเซิร์ฟเวอร์ก่อนกดซื้อ เพื่อรับไอเท็มทันที'}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Result message */}
                  <AnimatePresence>
                    {result && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: 5 }}
                        className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs font-bold ${
                          result.success
                            ? 'bg-green-50 border-green-200 text-green-700 shadow-[0_2px_0_#bbf7d0]'
                            : 'bg-red-50 border-red-200 text-red-600 shadow-[0_2px_0_#fecaca]'
                        }`}
                      >
                        <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'} mt-0.5 flex-shrink-0 text-sm`} />
                        <span className="leading-relaxed">{result.message}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/30 flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { if (!buying) resetModal(); }}
                    disabled={buying}
                    className="flex-1 btn-ghost py-2.5 text-[13px]"
                  >
                    <i className="fas fa-times text-[11px] mr-1.5" /> ยกเลิก
                  </button>
                  {user && (
                    <button
                      onClick={result?.success ? () => setResult(null) : handleBuy}
                      disabled={buying || (user.wallet_balance ?? 0) < totalPrice}
                      className={`flex-[2] py-2.5 text-[13px] rounded-lg font-bold transition-all ${
                        result?.success ? 'btn-primary' : isGift ? 'btn px-4 bg-pink-500 text-white shadow-[0_4px_0_#be185d] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#be185d]' : 'btn-buy'
                      }`}
                    >
                      {buying
                        ? <><i className="fas fa-spinner fa-spin text-[12px] mr-1.5" /> กำลังดำเนินการ...</>
                        : result?.success
                          ? <><i className="fas fa-redo text-[12px] mr-1.5" /> ซื้ออีกครั้ง</>
                          : isGift
                            ? <><i className="fas fa-gift text-[12px] mr-1.5" /> ยืนยันส่งของขวัญ</>
                            : <><i className="fas fa-shopping-cart text-[12px] mr-1.5" /> ยืนยันซื้อ {quantity > 1 ? `(${quantity})` : ''}</>}
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>,
        document.body
      )}
    </>
  );
}
