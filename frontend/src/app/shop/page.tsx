'use client';
import { useEffect, useState } from 'react';
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

  const filtered = products.filter(p => {
    if (catId && p.category_id !== catId) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id: null, name: 'All Items', icon: 'fa-layer-group', count: products.length },
    ...categories.map(c => ({
      id: c.id, name: c.name, icon: c.icon || 'fa-box',
      count: products.filter(p => p.category_id === c.id).length,
    })),
  ];

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <i className="fas fa-store text-green-600 text-lg" />
              ITEMSHOP
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">ร้านค้าไอเท็มและยศ</p>
          </div>
          <div className="relative w-52">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้า..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:border-green-400 transition-colors placeholder:text-gray-300 shadow-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                <i className="fas fa-times text-xs" />
              </button>
            )}
          </div>
        </div>

        {/* Card with tabs + grid */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">

          {/* Category tabs */}
          <div className="overflow-x-auto no-scrollbar border-b border-gray-100">
            <div className="flex min-w-max">
              {tabs.map(t => (
                <button key={String(t.id)} onClick={() => setCatId(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                    catId === t.id
                      ? 'border-green-500 text-green-600 bg-green-50/60'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                  <i className={`fas ${t.icon} text-[11px]`} />
                  {t.name}
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${catId === t.id ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="p-4 min-h-[300px]">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-xl bg-gray-100 animate-pulse" />
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
