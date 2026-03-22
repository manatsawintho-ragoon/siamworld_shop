'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import ProductCard from '@/components/ProductCard';
import { api } from '@/lib/api';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url?: string;
  image?: string;
  category_name?: string;
  category_id?: number;
}

interface Category {
  id: number;
  name: string;
  icon?: string;
}

interface Server {
  id: number;
  name: string;
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/public/products').then(d => setProducts((d.products as Product[]) || [])),
      api('/public/categories').then(d => setCategories((d.categories as Category[]) || [])),
      api('/public/servers').then(d => setServers((d.servers as Server[]) || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(p => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <MainLayout>
      <div className="w-full space-y-6">
        
        {/* Header & Search */}
        <div className="card overflow-hidden">
          <div className="card-header-mc flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <i className="fas fa-store text-primary text-xl" aria-hidden="true"></i>
              <span className="text-lg">Itemshop <span className="text-xs text-foreground-subtle ml-1 font-normal">ร้านค้าไอเท็มและยศ</span></span>
            </div>
            
            <div className="relative w-full md:w-64 flex-shrink-0">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" aria-hidden="true"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 text-gray-900 text-sm py-2.5 pl-8 pr-8 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder:text-gray-400 min-h-[44px]"
                placeholder="ค้นหาสินค้า..."
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="ล้างการค้นหา"
                >
                  <i className="fas fa-times text-xs" aria-hidden="true"></i>
                </button>
              )}
            </div>
          </div>

          {/* Categories Tab Bar */}
          <div className="relative">
            <div className="bg-gray-50 border-y border-gray-200 overflow-x-auto no-scrollbar flex">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`flex-shrink-0 px-6 py-3 text-sm font-bold transition-colors border-b-[3px] flex items-center gap-2 ${
                  !selectedCategory
                    ? 'bg-green-50 text-primary border-primary'
                    : 'text-gray-500 border-transparent hover:bg-green-50 hover:text-primary'
                }`}
              >
                <i className="fas fa-layer-group"></i> All Items 
                <span className="opacity-50 font-normal">({products.length})</span>
              </button>
              {categories.map(c => {
                const count = products.filter(p => p.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`flex-shrink-0 px-6 py-3 text-sm font-bold transition-colors border-b-[3px] flex items-center gap-2 ${
                      selectedCategory === c.id
                        ? 'bg-green-50 text-primary border-primary'
                        : 'text-gray-500 border-transparent hover:bg-green-50 hover:text-primary'
                    }`}
                  >
                    {c.icon ? <i className={c.icon}></i> : <i className="fas fa-box"></i>} {c.name}
                    <span className="opacity-50 font-normal">({count})</span>
                  </button>
                );
              })}
            </div>
            {/* Scroll fade indicators */}
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
          </div>

          {/* Products Grid */}
          <div className="p-4 bg-gray-50 min-h-[400px]">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-green-100 p-1 rounded-sm opacity-60 animate-pulse">
                    <div className="bg-green-200 aspect-square rounded-sm"></div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <i className="fas fa-box-open text-4xl text-gray-300 mb-4" aria-hidden="true"></i>
                <p className="text-gray-700 font-bold text-lg mb-1">ไม่พบสินค้าในหมวดหมู่นี้</p>
                <p className="text-xs text-foreground-subtle">กรุณาลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อีกครั้ง</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {filtered.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
