'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import ProductCard from '@/components/ProductCard';
import OnlinePlayersWidget from '@/components/OnlinePlayersWidget';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 dark:text-white">
            <i className="fas fa-store mr-2 text-brand-500"></i>ร้านค้า
          </h1>
          <p className="text-gray-500 dark:text-gray-400">เลือกซื้อไอเทม แรงค์ และสิทธิพิเศษสำหรับเซิร์ฟเวอร์ Minecraft</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Search */}
            <div className="card p-4">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm"></i>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-9"
                  placeholder="ค้นหาสินค้า..."
                />
              </div>
            </div>

            {/* Categories */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                <i className="fas fa-tags mr-1.5 text-brand-400"></i>หมวดหมู่
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    !selectedCategory
                      ? 'bg-brand-500 text-white shadow-theme-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  ทั้งหมด ({products.length})
                </button>
                {categories.map(c => {
                  const count = products.filter(p => p.category_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex justify-between transition-all duration-200 ${
                        selectedCategory === c.id
                          ? 'bg-brand-500 text-white shadow-theme-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span>{c.icon ? `${c.icon} ` : ''}{c.name}</span>
                      <span className="text-xs opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <OnlinePlayersWidget />
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card h-64 animate-pulse">
                    <div className="h-36 bg-gray-100 dark:bg-gray-700 rounded-t-xl"></div>
                    <div className="p-3.5 space-y-2">
                      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                  <i className="fas fa-box-open text-2xl text-gray-300 dark:text-gray-600"></i>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">ไม่พบสินค้า</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">ลองค้นด้วยคำอื่น</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    พบ <span className="font-semibold text-gray-700 dark:text-gray-200">{filtered.length}</span> รายการ
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filtered.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
