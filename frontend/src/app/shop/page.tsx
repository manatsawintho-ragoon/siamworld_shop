'use client';
import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import ProductCard from '@/components/ProductCard';
import { api } from '@/lib/api';

interface Product {
  id: number; name: string; description: string;
  price: number; original_price?: number;
  image_url?: string; image?: string;
  category_name?: string; category_id?: number;
}
interface Category { id: number; name: string; icon?: string; }
interface Server   { id: number; name: string; }

export default function ShopPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [servers,    setServers]    = useState<Server[]>([]);
  const [catId,      setCatId]      = useState<number | null>(null);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api('/public/products').then(d   => setProducts((d.products as Product[]) || [])),
      api('/public/categories').then(d => setCategories((d.categories as Category[]) || [])),
      api('/public/servers').then(d    => setServers((d.servers as Server[]) || [])),
    ]).finally(() => setLoading(false));
  }, []);

  // Sort: discount-first, then by id desc
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aDisc = a.original_price && a.original_price > a.price ? 1 : 0;
      const bDisc = b.original_price && b.original_price > b.price ? 1 : 0;
      if (bDisc !== aDisc) return bDisc - aDisc;
      return b.id - a.id;
    });
  }, [products]);

  const filtered = useMemo(() => {
    return sortedProducts.filter(p => {
      if (catId && p.category_id !== catId) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [sortedProducts, catId, search]);

  const tabs = useMemo(() => [
    { id: null, name: 'ทั้งหมด', icon: 'fa-layer-group' as const, count: products.length },
    ...categories.map(c => ({
      id: c.id, name: c.name, icon: (c.icon || 'fa-box') as string,
      count: products.filter(p => p.category_id === c.id).length,
    })),
  ], [products, categories]);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <i className="fas fa-store text-green-600 text-lg" />
            ITEMSHOP
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">ร้านค้าไอเท็มและยศ</p>
        </div>

        {/* ── Main card ── */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">

          {/* ── Row 1: Category filters + search ── */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            {tabs.map(t => (
              <button
                key={String(t.id)}
                onClick={() => { setCatId(t.id); setSearch(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all active:translate-y-[1px] ${
                  catId === t.id
                    ? 'bg-green-500 shadow-[0_3px_0_#15803d] text-white'
                    : 'bg-white border border-gray-200 text-green-600 hover:border-gray-300'
                }`}
              >
                <i className={`fas ${t.icon} text-[10px]`} />
                {t.name}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  catId === t.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {loading ? '…' : t.count}
                </span>
              </button>
            ))}

            {/* Search */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <div className="relative">
                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาสินค้า..."
                  className="pl-7 pr-7 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/20 transition-all placeholder:text-gray-300 w-36 sm:w-44"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    <i className="fas fa-times text-[10px]" />
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400 font-bold flex-shrink-0">
                {loading ? '…' : `${filtered.length} ชิ้น`}
              </span>
            </div>
          </div>

          {/* ── Grid body ── */}
          <div className="p-3 overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {[...Array(15)].map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <i className="fas fa-box-open text-2xl text-gray-300" />
                </div>
                <p className="text-gray-600 font-bold text-sm">ไม่พบสินค้า</p>
                <p className="text-gray-400 text-xs mt-1">ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อีกครั้ง</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filtered.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
              </div>
            )}
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
