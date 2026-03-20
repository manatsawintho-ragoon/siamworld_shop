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

  const newArrivals = [...products].sort((a, b) => b.id - a.id).slice(0, 8);
  const onSale = products.filter(p => p.original_price && p.original_price > p.price).slice(0, 4);
  const topLootboxes = [...lootboxes].slice(0, 4);

  return (
    <MainLayout>
      {/* 1. Website Broadcast */}
      {settings.welcome_message && (
        <div className="bg-primary/20 border-l-4 border-primary rounded-r-lg p-3 text-sm font-bold text-white mb-6 shadow-md animate-fade-in flex items-center">
          <i className="fas fa-bullhorn text-primary mr-3 text-lg" aria-hidden="true"></i>
          {settings.welcome_message}
        </div>
      )}

      {/* 2. Hero Section (Replaces Carousel with classic box style) */}
      <div className="card overflow-hidden mb-6">
        <div className="w-full relative aspect-[21/9] md:aspect-[3/1] bg-[#1e1e1e] border-b border-black/50">
          {slides.length > 0 ? (
            <HeroCarousel slides={slides} />
          ) : (
            <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-[url('https://i.imgur.com/3Q6ZQ6q.png')] bg-cover bg-center">
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="relative z-10 text-center animate-fade-in-up">
                <img src="https://i.imgur.com/G5fG5z6.png" className="max-w-[150px] md:max-w-[200px] mx-auto mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] pixelated" alt="Dirt Block" style={{ imageRendering: 'pixelated' }} />
                <h2 className="text-white text-3xl font-black tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">NEW iMC SERVER</h2>
                <p className="text-primary font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mt-1">Survive • Build • Conquer</p>
              </div>
            </div>
          )}
        </div>
        <div className="bg-black/40 p-3 flex items-center justify-between text-xs text-foreground-muted border-t border-white/5 shadow-inner">
          <div className="font-bold text-white">
            <span className="text-primary">New iMC</span> <span className="font-normal opacity-70">ระบบร้านค้ามายคราฟ</span>
          </div>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-white opacity-50"></span>
            <span className="w-2 h-2 rounded-full bg-white opacity-50"></span>
            <span className="w-2 h-2 rounded-full bg-white"></span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 3. Newest Item Section (Matching Reference iMC) */}
        {newArrivals.length > 0 && (
          <section className="card overflow-hidden">
            <div className="card-header-mc flex items-center justify-between">
              <span><i className="fas fa-cube mr-2"></i>Newest Item สินค้าใหม่ล่าสุด</span>
              <Link href="/shop" className="bg-primary/80 hover:bg-primary text-white text-[10px] px-3 py-1 rounded shadow-sm transition-colors uppercase font-bold border border-white/10">
                เพิ่มเติม <i className="fas fa-angle-double-right ml-1"></i>
              </Link>
            </div>
            <div className="p-4 bg-[#8b8b8b]/10">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {newArrivals.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
              </div>
            </div>
          </section>
        )}

        {/* 4. Sale Products (If any) */}
        {onSale.length > 0 && (
          <section className="card overflow-hidden">
            <div className="card-header-mc flex items-center justify-between bg-error/10 border-error/30 text-error-foreground">
              <span><i className="fas fa-tags mr-2 text-error"></i>Hot Sale สินค้าลดราคาพิเศษ</span>
            </div>
            <div className="p-4 bg-[#8b8b8b]/10">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {onSale.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
              </div>
            </div>
          </section>
        )}

        {/* 5. Crate (Lootbox) New & Popular */}
        {topLootboxes.length > 0 && (
          <section className="card overflow-hidden">
            <div className="card-header-mc flex items-center justify-between">
              <span><i className="fas fa-box-open mr-2 text-warning"></i>Gacha กล่องสุ่ม</span>
              <Link href="/lootbox" className="bg-warning/80 hover:bg-warning text-black text-[10px] px-3 py-1 rounded shadow-sm transition-colors uppercase font-bold border border-black/20">
                สุ่มเลย <i className="fas fa-angle-double-right ml-1"></i>
              </Link>
            </div>
            <div className="p-4 bg-[#8b8b8b]/10">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
                {topLootboxes.map(box => (
                  <Link
                    key={box.id}
                    href={`/lootbox/${box.id}`}
                    className="group relative bg-[#373737] rounded-sm overflow-hidden shadow-[inset_2px_2px_0_rgba(0,0,0,0.8),inset_-2px_-2px_0_rgba(255,255,255,0.2)] hover:bg-[#4a4a4a] transition-all duration-300 border-[3px] border-[#8b8b8b]"
                  >
                    <div className="aspect-square flex items-center justify-center p-6 relative">
                      {box.image ? (
                        <img src={box.image} alt={box.name} className="w-24 h-24 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)] pixelated" style={{ imageRendering: 'pixelated' }} />
                      ) : (
                        <i className="fas fa-box text-5xl text-white/20 group-hover:text-warning/50 transition-colors drop-shadow-md" aria-hidden="true"></i>
                      )}
                      
                      <div className="absolute top-2 right-2 bg-warning text-black text-[10px] font-black px-2 py-0.5 shadow-md border border-neutral-800">
                        {parseFloat(String(box.price)).toLocaleString()} ฿
                      </div>
                    </div>
                    <div className="bg-black/40 p-2 flex flex-col items-center justify-center border-t border-white/10">
                      <p className="text-white font-bold text-xs truncate drop-shadow-md mb-1.5">{box.name}</p>
                      <div className="bg-[#787878] group-hover:bg-[#8b8b8b] text-white text-[10px] font-bold px-3 py-1 rounded-sm border-t-white/50 border-l-white/50 border-b-black/80 border-r-black/80 border w-full text-center transition-all shadow-inner active:border-t-black/80 active:border-l-black/80 active:border-b-white/50 active:border-r-white/50">
                        <i className="fas fa-box-open mr-1"></i> สุ่มไอเทม
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
