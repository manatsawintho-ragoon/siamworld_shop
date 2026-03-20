'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';

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
    } catch (err: unknown) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setBuying(false);
    }
  };

  return (
    <>
      <div className="card overflow-hidden group hover:shadow-theme-md transition-all duration-300 hover:-translate-y-0.5">
        <div className="relative h-36 bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {imgSrc ? (
            <img src={imgSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-500">
              <i className="fas fa-cube text-3xl"></i>
            </div>
          )}
          {discount > 0 && (
            <span className="absolute top-2 right-2 bg-error-500 text-white px-2 py-0.5 rounded-lg text-xs font-bold shadow-sm">
              -{discount}%
            </span>
          )}
          {product.category_name && (
            <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-lg text-xs font-medium">
              {product.category_name}
            </span>
          )}
        </div>
        <div className="p-3.5">
          <h3 className="font-semibold text-sm mb-1 truncate dark:text-white">{product.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{product.description}</p>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-gray-900 dark:text-white">{product.price.toLocaleString()} ฿</span>
              {discount > 0 && (
                <span className="text-xs text-gray-400 line-through ml-1.5">{product.original_price?.toLocaleString()}</span>
              )}
            </div>
            <button
              onClick={() => user ? setShowBuy(true) : undefined}
              disabled={!user}
              className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                user
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-theme-xs hover:shadow-theme-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
              }`}
            >
              ซื้อ
            </button>
          </div>
        </div>
      </div>

      {showBuy && (
        <div className="modal-overlay" onClick={() => !buying && setShowBuy(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-400 rounded-t-2xl"></div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold dark:text-white">ยืนยันการซื้อ</h3>
                <button onClick={() => !buying && setShowBuy(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors">
                  <i className="fas fa-xmark"></i>
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 mb-4">
                <p className="font-semibold text-sm dark:text-white">{product.name}</p>
                <p className="font-bold text-brand-600 dark:text-brand-400">{product.price.toLocaleString()} ฿</p>
              </div>

              {servers.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">เลือกเซิร์ฟเวอร์</label>
                  <select value={selectedServer} onChange={(e) => setSelectedServer(Number(e.target.value))} className="input">
                    {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div className="bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/20 rounded-lg p-3 mb-4 text-xs text-warning-700 dark:text-warning-400">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                คุณต้องออนไลน์อยู่ในเกมขณะซื้อ ไม่งั้นจะไม่สามารถส่งของได้
              </div>

              {result && (
                <div className={`rounded-lg p-3 mb-4 text-sm flex items-center gap-2 ${
                  result.success
                    ? 'bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-success-700 dark:text-success-400'
                    : 'bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-error-700 dark:text-error-400'
                }`}>
                  <i className={`fas ${result.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                  {result.message}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setShowBuy(false)} disabled={buying} className="btn-ghost flex-1 justify-center">ยกเลิก</button>
                <button onClick={handleBuy} disabled={buying} className="btn-primary flex-1 justify-center">
                  {buying ? 'กำลังซื้อ...' : 'ยืนยันซื้อ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
