'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';
import {
  Tag, Box, Flame, Info, ShoppingCart, AlignLeft, X, Check, Lock,
  Wallet, Server, Layers, Minus, Plus, Gift, AlertTriangle,
  CheckCircle2, AlertCircle, Loader2, RotateCcw,
} from 'lucide-react';
import { proxyImage, onProxyError } from '@/lib/imageProxy';
import { useIdempotencyKey, isNetworkError } from '@/lib/idempotency';

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

  const idem = useIdempotencyKey();

  const resetModal = () => {
    setShowBuy(false);
    setResult(null);
    setQuantity(1);
    setIsGift(false);
    setGiftUsername('');
    idem.clear();
  };

  const handleBuy = async () => {
    if (!user || selectedServer === 0) return;
    if (isGift && !giftUsername.trim()) {
      setResult({ success: false, message: 'กรุณาใส่ชื่อเพื่อนในเกมที่จะส่งของขวัญ' });
      return;
    }
    // Stable across retries of THIS order, new when any order field changes, so a
    // retry after a dropped connection is collapsed server-side instead of charged twice.
    const idempotencyKey = idem.take(
      `${product.id}|${selectedServer}|${quantity}|${isGift ? giftUsername.trim() : ''}`
    );
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
          idempotencyKey,
          ...(isGift && giftUsername.trim() ? { giftToUsername: giftUsername.trim() } : {}),
        },
      });
      await refresh();

      // The server answered, so the order is settled either way — the next click
      // is a new order and must not reuse this key.
      idem.clear();

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
      // A network drop leaves it unknown whether the order landed, so keep the key
      // and let the retry dedup. Anything the server actually answered is settled.
      if (!isNetworkError(err)) idem.clear();
      setResult({ success: false, message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setBuying(false);
    }
  };

  return (
    <>
      {/* Card */}
      {/* The lift and press were framer-motion's whileHover/whileTap. As CSS they
          are the same two transforms on the compositor, and `hover:` is scoped to
          devices that actually hover so a phone does not stick in the lifted
          state after a tap. */}
      <article
        className="group relative flex flex-col bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all duration-200 hover:shadow-theme-lg motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] active:scale-[0.99]"
      >

        {/* Image area */}
        <div className="relative aspect-[3/4] bg-surface-hover overflow-hidden">

          {/* Category badge — top left (on image) */}
          {product.category_name && (
            <span className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-surface/90 backdrop-blur-sm text-foreground-muted text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-border/80">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgb(var(--color-primary))' }} />
              {product.category_name}
            </span>
          )}

          {/* Discount badge — top right (on image) */}
          {discount > 0 && (
            <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-error text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-lg">
              <Tag className="w-2.5 h-2.5" strokeWidth={2.5} />
              -{discount}%
            </span>
          )}

          {/* Image / Carousel */}
          {images.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-surface-hover">
              <Box className="w-12 h-12 text-foreground-subtle/40 group-hover:text-primary/40 transition-colors" strokeWidth={1.5} aria-hidden="true" />
            </div>
          ) : images.length === 1 ? (
            <img
              src={proxyImage(images[0], 192)}
              alt={product.name}
              className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 ease-out"
              style={{ imageRendering: 'pixelated' }} onError={onProxyError} loading="lazy" fetchPriority="low" />
          ) : (
            <div className="product-carousel">
              {images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className={`product-carousel-slide${i === slideIdx ? ' is-active' : ''}`}
                  aria-hidden={i !== slideIdx}
                >
                  <img
                    src={proxyImage(src, 192)}
                    alt={product.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500 ease-out"
                    style={{ imageRendering: 'pixelated' }} onError={onProxyError} loading="lazy" fetchPriority="low" />
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
        <div className="p-3 flex flex-col flex-1 bg-surface relative z-10">
          <p className="text-foreground font-bold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">{product.name}</p>

          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 w-fit">
            <Flame className="w-2.5 h-2.5 text-orange-500" strokeWidth={2.25} />
            <span className="text-[11px] font-bold text-orange-700">
              ขายแล้ว <span className="tabular-nums font-black">{(product.sold_count ?? 0).toLocaleString()}</span> ชิ้น
            </span>
          </div>

          {/* Always render so every card keeps the same height, with or without a description. */}
          <button
            onClick={() => setShowDesc(true)}
            className="inline-flex items-center gap-1 mt-1.5 mb-1 py-1 -my-0.5 text-[10px] font-bold transition-colors hover:brightness-110 self-start"
            style={{ color: 'rgb(var(--color-primary-text))' }}
          >
            <Info className="w-2.5 h-2.5" strokeWidth={2.25} /> ดูคำอธิบายสินค้า
          </button>

          <button
            onClick={() => setShowBuy(true)}
            className="btn-buy w-full mt-auto pt-3 pb-2.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 min-h-[40px] shadow-lg hover:shadow-xl transition-all motion-safe:hover:scale-[1.02] active:scale-95"
          >
            <ShoppingCart className="w-3 h-3" strokeWidth={2.5} /> ซื้อเลย!
          </button>
        </div>
      </article>

      {/* Description Popup */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div data-theme-portal="">
        {showDesc && (
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overlay-in"
              onClick={() => setShowDesc(false)}
            >
              <div
                className="theme-card w-full max-w-sm max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl dialog-in"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border-muted flex items-center gap-3 flex-shrink-0">
                  {imgSrc ? (
                    <div className="w-10 h-10 rounded-lg bg-surface border border-border-muted flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                      <img src={proxyImage(imgSrc, 36)} alt={product.name} className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} onError={onProxyError} loading="lazy" fetchPriority="low" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-hover border border-border-muted flex items-center justify-center flex-shrink-0">
                      <Box className="w-5 h-5 text-foreground-subtle/50" strokeWidth={1.75} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground text-sm leading-tight truncate">{product.name}</h3>
                    {product.category_name && (
                      <p className="text-[10px] text-foreground-subtle mt-0.5">{product.category_name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowDesc(false)}
                    className="btn-close"
                    aria-label="ปิด"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">
                  <div className="flex items-center gap-1.5 mb-3">
                    <AlignLeft className="w-3 h-3" strokeWidth={2.25} style={{ color: 'rgb(var(--color-primary))' }} />
                    <span className="text-xs font-bold text-foreground-muted uppercase tracking-wide">คำอธิบายสินค้า</span>
                  </div>
                  {product.description ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-6 text-foreground-subtle">
                      <Info className="w-7 h-7 mb-2 opacity-40" strokeWidth={1.75} />
                      <p className="text-sm font-medium">ยังไม่มีคำอธิบายเพิ่มเติมสำหรับสินค้านี้</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-border-muted bg-surface-hover/40 flex-shrink-0">
                  <button
                    onClick={() => setShowDesc(false)}
                    className="btn-primary w-full py-2.5 text-[13px] flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3 h-3" strokeWidth={2.5} /> ปิด
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Buy Modal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div data-theme-portal="">
        {showBuy && (
            <div
              className="fixed inset-0 z-[99998] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overlay-in"
              onClick={() => { if (!buying) resetModal(); }}
            >
              <div
                className="theme-card w-full max-w-sm max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl dialog-in"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border-muted flex items-center gap-3 flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--color-primary), 0.1)', color: 'rgb(var(--color-primary))' }}>
                    <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-sm leading-none">ยืนยันการซื้อสินค้า</h3>
                    <p className="text-[11px] text-foreground-subtle mt-0.5">ตรวจสอบรายละเอียดก่อนยืนยัน</p>
                  </div>
                  <button
                    onClick={() => { if (!buying) resetModal(); }}
                    className="btn-close"
                    aria-label="ปิด"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 min-h-0">

                  {/* Product block */}
                  <div className="flex items-start gap-3 bg-surface-hover/60 rounded-xl p-3 border border-border-muted">
                    {imgSrc ? (
                      <div className="w-14 h-14 rounded-lg bg-surface border border-border-muted flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                        <img src={proxyImage(imgSrc, 48)} alt={product.name} className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} onError={onProxyError} loading="lazy" fetchPriority="low" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-surface-hover border border-border-muted flex items-center justify-center flex-shrink-0">
                        <Box className="w-6 h-6 text-foreground-subtle/50" strokeWidth={1.75} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm leading-tight truncate">{product.name}</p>
                      {product.category_name && (
                        <p className="text-[10px] text-foreground-subtle mt-0.5">{product.category_name}</p>
                      )}
                      <button
                        onClick={() => setShowDesc(true)}
                        className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold transition-colors"
                        style={{ color: 'rgb(var(--color-primary-text))' }}
                      >
                        <Info className="w-2.5 h-2.5" strokeWidth={2.25} /> ดูคำอธิบายสินค้า
                      </button>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {discount > 0 && product.original_price && (
                          <span className="text-foreground-subtle text-xs line-through tabular-nums">{product.original_price.toLocaleString()} ฿</span>
                        )}
                        <span className="font-black text-base tabular-nums leading-none theme-price-text">{product.price.toLocaleString()} ฿</span>
                        {discount > 0 && (
                          <span className="bg-error text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">-{discount}%</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Not logged in */}
                  {!user && (
                    <div className="flex items-center gap-2 bg-error/10 border border-error/20 rounded-xl px-3 py-2.5">
                      <Lock className="w-4 h-4 text-error flex-shrink-0" strokeWidth={2.25} />
                      <span className="text-xs font-bold text-error">กรุณาเข้าสู่ระบบก่อนทำรายการ</span>
                    </div>
                  )}

                  {/* Balance indicator */}
                  {user && (() => {
                    const bal = user.wallet_balance ?? 0;
                    const enough = bal >= totalPrice;
                    return (
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${enough ? 'bg-success/10 border-success/25' : 'bg-error/10 border-error/25'}`}>
                        <span className={`flex items-center gap-1.5 ${enough ? 'text-success' : 'text-error'}`}>
                          <Wallet className="w-3 h-3" strokeWidth={2.25} />
                          ยอดเงินคงเหลือ
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-black tabular-nums ${enough ? 'text-success' : 'text-error'}`}>
                            {bal.toLocaleString()} ฿
                          </span>
                          {!enough && (
                            <span className="text-[10px] font-bold text-error bg-error/15 px-1.5 py-0.5 rounded">
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
                          <label className="flex items-center gap-1 text-[11px] font-bold text-foreground-muted mb-1.5 uppercase tracking-wide">
                            <Server className="w-2.5 h-2.5" strokeWidth={2.25} style={{ color: 'rgb(var(--color-primary))' }} />
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
                        <label className="flex items-center gap-1 text-[11px] font-bold text-foreground-muted mb-1.5 uppercase tracking-wide">
                          <Layers className="w-2.5 h-2.5" strokeWidth={2.25} style={{ color: 'rgb(var(--color-primary))' }} />
                          จำนวนที่ต้องการซื้อ
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={buying || quantity <= 1}
                            aria-label="ลดจำนวน"
                            className="w-10 h-10 rounded-lg border border-border bg-surface text-foreground flex items-center justify-center hover:bg-surface-hover disabled:opacity-40 transition-all shadow-sm"
                          >
                            <Minus className="w-3 h-3" strokeWidth={2.5} />
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
                            aria-label="เพิ่มจำนวน"
                            className="w-10 h-10 rounded-lg border border-border bg-surface text-foreground flex items-center justify-center hover:bg-surface-hover disabled:opacity-40 transition-all shadow-sm"
                          >
                            <Plus className="w-3 h-3" strokeWidth={2.5} />
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
                              ? 'bg-pink-500/10 border-pink-500/40 text-pink-700'
                              : 'bg-surface border-border text-foreground-muted hover:border-pink-500/40 hover:text-pink-700'
                          }`}
                        >
                          <Gift className={`w-3.5 h-3.5 ${isGift ? 'text-pink-500' : 'text-foreground-subtle'}`} strokeWidth={2.25} />
                          <span>{isGift ? 'ส่งของขวัญให้เพื่อน' : 'ส่งเป็นของขวัญ'}</span>
                          <div className={`ml-auto w-8 h-4 rounded-full transition-colors ${isGift ? 'bg-pink-500' : 'bg-border'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow mt-0.5 transition-transform`} style={{ transform: isGift ? 'translateX(18px)' : 'translateX(2px)' }} />
                          </div>
                        </button>

                        {isGift && (
                            <div
                              className="mt-2 overflow-hidden dialog-in"
                            >
                              <input
                                type="text"
                                placeholder="ชื่อเพื่อนในเกม (Minecraft username)"
                                value={giftUsername}
                                onChange={e => setGiftUsername(e.target.value)}
                                disabled={buying}
                                maxLength={64}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-pink-500/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pink-400/30 focus:border-pink-400 bg-surface shadow-sm transition-all"
                              />
                              <p className="text-[10px] text-pink-700 mt-1 flex items-center gap-1 font-medium">
                                <Info className="w-2.5 h-2.5" strokeWidth={2.25} />
                                เพื่อนต้องออนไลน์อยู่ในเซิร์ฟเวอร์เดียวกัน
                              </p>
                            </div>
                          )}
                      </div>

                      <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-xl px-3 py-2.5">
                        <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" strokeWidth={2.25} />
                        <span className="text-[11px] text-foreground-muted font-medium leading-relaxed">
                          {isGift
                            ? 'ทั้งคุณและผู้รับต้องออนไลน์อยู่ในเกม และอยู่ในเซิร์ฟเวอร์ก่อนกดยืนยัน'
                            : 'กรุณาออนไลน์ในเกม และอยู่ในเซิร์ฟเวอร์ก่อนกดซื้อ เพื่อรับไอเท็มทันที'}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Result message */}
                  {result && (
                      <div
                        className={`flex items-start gap-2 rounded-xl px-3 py-2.5 border text-xs font-bold ${
                          result.success
                            ? 'bg-success/10 border-success/25 text-success'
                            : 'bg-error/10 border-error/25 text-error'
                        } dialog-in`}
                      >
                        {result.success
                          ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.25} />
                          : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.25} />}
                        <span className="leading-relaxed">{result.message}</span>
                      </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 sm:px-5 py-3.5 border-t border-border-muted bg-surface-hover/40 flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { if (!buying) resetModal(); }}
                    disabled={buying}
                    className="flex-1 btn-ghost py-3 min-h-[44px] text-[13px] flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} /> ยกเลิก
                  </button>
                  {user && (
                    <button
                      onClick={result?.success ? () => setResult(null) : handleBuy}
                      disabled={buying || (user.wallet_balance ?? 0) < totalPrice}
                      className={`flex-[2] py-3 min-h-[44px] text-[13px] rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                        result?.success ? 'btn-primary' : isGift ? 'btn px-4 bg-pink-500 text-white shadow-[0_4px_0_#be185d] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#be185d]' : 'btn-buy'
                      }`}
                    >
                      {buying
                        ? <><Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} /> กำลังดำเนินการ...</>
                        : result?.success
                          ? <><RotateCcw className="w-3 h-3" strokeWidth={2.5} /> ซื้ออีกครั้ง</>
                          : isGift
                            ? <><Gift className="w-3 h-3" strokeWidth={2.5} /> ยืนยันส่งของขวัญ</>
                            : <><ShoppingCart className="w-3 h-3" strokeWidth={2.5} /> ยืนยันซื้อ {quantity > 1 ? `(${quantity})` : ''}</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
