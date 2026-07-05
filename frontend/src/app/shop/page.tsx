'use client';
import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import ProductCard from '@/components/ProductCard';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Search, X, PackageOpen } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

interface Product {
  id: number; name: string; description: string;
  price: number; original_price?: number;
  image_url?: string; image?: string;
  category_name?: string; category_id?: number;
  sold_count?: number;
}
interface Category { id: number; name: string; icon?: string; }
interface Server   { id: number; name: string; }

export default function ShopPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [servers,    setServers]    = useState<Server[]>([]);
  const [catId,      setCatId]      = useState<number | null>(null);
  const [search,     setSearch]     = useState('');
  const [sort,       setSort]       = useState<'default' | 'price_asc' | 'price_desc' | 'newest'>('default');
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api('/public/products').then(d   => setProducts((d.products as Product[]) || [])),
      api('/public/categories').then(d => setCategories((d.categories as Category[]) || [])),
      api('/public/servers').then(d    => setServers((d.servers as Server[]) || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const list = products.filter(p => {
      if (catId && p.category_id !== catId) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sort === 'price_asc')  return [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') return [...list].sort((a, b) => b.price - a.price);
    if (sort === 'newest')     return [...list].sort((a, b) => b.id - a.id);
    return list;
  }, [products, catId, search, sort]);

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
          <h1 className="text-xl font-black text-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" strokeWidth={2.25} />
            ITEMSHOP
          </h1>
          <p className="text-foreground-subtle text-xs mt-0.5">ร้านค้าไอเท็มและยศ</p>
        </div>

        {/* ── Main card ── */}
        <div className="bg-surface rounded-2xl shadow-md border border-border overflow-hidden">

          {/* ── Row 1: Category filters + search ── */}
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 flex-wrap">
            {tabs.map(t => (
              <button
                key={String(t.id)}
                onClick={() => { setCatId(t.id); setSearch(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all active:translate-y-[1px] ${
                  catId === t.id
                    ? 'text-primary-foreground'
                    : 'bg-surface border border-border text-primary hover:border-primary/40'
                }`}
                style={catId === t.id ? {
                  backgroundColor: 'rgb(var(--color-primary))',
                  boxShadow: '0 3px 0 rgb(var(--color-primary-hover))',
                } : undefined}
              >
                <i className={`fas ${t.icon} text-[10px]`} />
                {t.name}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  catId === t.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-surface-hover text-foreground-subtle'
                }`}>
                  {loading ? '…' : t.count
                }</span>
              </button>
            ))}

            {/* Sort + Search */}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <select
                value={sort}
                onChange={e => setSort(e.target.value as typeof sort)}
                className="py-1.5 pl-2.5 pr-7 rounded-lg border border-border bg-surface text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="default">เรียงปกติ</option>
                <option value="price_asc">ราคา น้อย→มาก</option>
                <option value="price_desc">ราคา มาก→น้อย</option>
                <option value="newest">ใหม่ล่าสุด</option>
              </select>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle" strokeWidth={2.5} />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาสินค้า..."
                  className="pl-7 pr-7 py-1.5 rounded-lg border border-border bg-surface text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-foreground-subtle w-36 sm:w-44"
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="ล้างการค้นหา" className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground-muted transition-colors">
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <span className="text-xs text-foreground-subtle font-bold flex-shrink-0">
                {loading ? '…' : `${filtered.length} ชิ้น`}
              </span>
            </div>
          </div>

          {/* ── Grid body ── */}
          <div className="p-4 sm:p-6">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <motion.div 
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
                >
                  {[...Array(18)].map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-xl bg-surface-hover animate-pulse" />
                  ))}
                </motion.div>
              ) : filtered.length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-16 h-16 rounded-3xl bg-surface-hover border border-border-muted flex items-center justify-center mb-4">
                    <PackageOpen className="w-8 h-8 text-foreground-subtle/50" strokeWidth={1.75} />
                  </div>
                  <p className="text-foreground font-black text-lg">ไม่พบสินค้า</p>
                  <p className="text-foreground-subtle text-sm mt-1">ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อีกครั้ง</p>
                </motion.div>
              ) : (
                <motion.div 
                  key={`${catId}-${search}-${sort}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
                >
                  {filtered.map(p => (
                    <motion.div key={p.id} variants={itemVariants}>
                      <ProductCard product={p} servers={servers} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
