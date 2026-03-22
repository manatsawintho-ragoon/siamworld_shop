'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import HeroCarousel from '@/components/HeroCarousel';
import ProductCard from '@/components/ProductCard';
import { useSettings } from '@/context/SettingsContext';
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
}

interface Server {
  id: number;
  name: string;
}

interface LootBox {
  id: number;
  name: string;
  description?: string;
  image?: string;
  price: number;
}

export default function HomePage() {
  const [slides, setSlides] = useState([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [lootboxes, setLootboxes] = useState<LootBox[]>([]);
  const { settings } = useSettings();

  useEffect(() => {
    Promise.all([
      api('/public/slides').then(d => setSlides((d.slides as never[]) || [])).catch(() => {}),
      api('/public/products/featured').then(d => setFeatured((d.products as Product[]) || [])).catch(() => {}),
      api('/public/products').then(d => setProducts((d.products as Product[]) || [])).catch(() => {}),
      api('/public/servers').then(d => setServers((d.servers as Server[]) || [])).catch(() => {}),
      api('/shop/lootboxes').then(d => setLootboxes((d.boxes as LootBox[]) || [])).catch(() => {}),
    ]);
  }, []);

  const allFeatured = [
    // On-sale products first, then rest sorted newest first — deduplicated
    ...products.filter(p => p.original_price && p.original_price > p.price),
    ...products.filter(p => !(p.original_price && p.original_price > p.price)).sort((a, b) => b.id - a.id),
  ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, 12);
  const topLootboxes = [...lootboxes].slice(0, 4);

  return (
    <MainLayout>
      {/* 1. Website Broadcast */}
      {settings.welcome_message && (
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg mb-6 shadow-sm overflow-hidden relative">
          <div className="flex items-center">
            <div className="bg-green-800 px-4 py-2.5 flex items-center gap-2 z-10 flex-shrink-0 border-r border-green-500/30">
              <i className="fas fa-bullhorn text-white text-sm" aria-hidden="true"></i>
              <span className="text-white text-xs font-bold uppercase tracking-wider">ประกาศ</span>
            </div>
            <div className="flex-1 overflow-hidden py-2.5">
              <div className="marquee-track">
                <span className="text-white text-sm font-bold px-8">{settings.welcome_message}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Hero Section */}
      <div className="overflow-hidden mb-6">
        <div className="w-full relative aspect-[21/9] md:aspect-[3/1] bg-gray-800">
          {slides.length > 0 ? (
            <HeroCarousel slides={slides} />
          ) : (
            <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-900">
              <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgb(var(--color-primary)) 0%, transparent 60%)' }} />
              <div className="relative z-10 text-center logo-float">
                <div className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] mb-2">
                  {settings.shop_name || 'SiamWorld'}
                </div>
                <p className="text-primary font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mt-1">
                  {settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* 3. All Items Section (Newest + Sale merged) */}
        {allFeatured.length > 0 && (
          <section className="card overflow-hidden">
            <div className="card-header-mc flex items-center justify-between">
              <span><i className="fas fa-store mr-2 text-primary"></i>Items สินค้าทั้งหมด</span>
              <Link href="/shop" className="bg-primary/80 hover:bg-primary text-white text-[10px] px-3 py-1 rounded shadow-sm transition-colors uppercase font-bold border border-white/10">
                ดูทั้งหมด <i className="fas fa-angle-double-right ml-1"></i>
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {allFeatured.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
              </div>
            </div>
          </section>
        )}

        {/* 4. Gacha / Lootboxes */}
        {topLootboxes.length > 0 && (
          <section className="card overflow-hidden">
            <div className="card-header-mc flex items-center justify-between">
              <span><i className="fas fa-box-open mr-2 text-warning"></i>Gacha กล่องสุ่ม</span>
              <Link href="/lootbox" className="bg-warning/80 hover:bg-warning text-black text-[10px] px-3 py-1 rounded shadow-sm transition-colors uppercase font-bold border border-black/20">
                สุ่มเลย <i className="fas fa-angle-double-right ml-1"></i>
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
                {topLootboxes.map(box => (
                  <Link key={box.id} href={`/lootbox/${box.id}`}
                    className="group relative bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="aspect-square flex items-center justify-center p-6 relative">
                      {box.image ? (
                        <img src={box.image} alt={box.name} className="w-20 h-20 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-lg" />
                      ) : (
                        <i className="fas fa-box text-5xl text-primary/30 group-hover:text-primary/60 transition-colors" aria-hidden="true"></i>
                      )}
                      <div className="absolute top-2 right-2 bg-warning text-black text-[10px] font-black px-2 py-0.5 rounded shadow-md">
                        {parseFloat(String(box.price)).toLocaleString()} ฿
                      </div>
                    </div>
                    <div className="bg-green-50 p-2.5 border-t border-green-100">
                      <p className="text-gray-900 font-bold text-xs truncate mb-1.5">{box.name}</p>
                      <div className="btn-primary text-[10px] py-1 w-full text-center rounded">
                        <i className="fas fa-box-open mr-1"></i> สุ่มไอเท็ม
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
