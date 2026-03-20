'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import HeroCarousel from '@/components/HeroCarousel';
import ProductCard from '@/components/ProductCard';
import OnlinePlayersWidget from '@/components/OnlinePlayersWidget';
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

export default function HomePage() {
  const [slides, setSlides] = useState([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const { settings } = useSettings();

  useEffect(() => {
    Promise.all([
      api('/public/slides').then(d => setSlides((d.slides as never[]) || [])).catch(() => {}),
      api('/public/products/featured').then(d => setFeatured((d.products as Product[]) || [])).catch(() => {}),
      api('/public/products').then(d => setProducts((d.products as Product[]) || [])).catch(() => {}),
      api('/public/servers').then(d => setServers((d.servers as Server[]) || [])).catch(() => {}),
    ]);
  }, []);

  const newArrivals = [...products].sort((a, b) => b.id - a.id).slice(0, 4);
  const onSale = products.filter(p => p.original_price && p.original_price > p.price).slice(0, 4);

  return (
    <MainLayout>
      <HeroCarousel slides={slides} />

      {settings.welcome_message && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
          <div className="bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 rounded-xl p-4 text-center">
            <p className="text-gray-700 dark:text-gray-300">
              <i className="fas fa-bullhorn text-brand-500 mr-2"></i>
              {settings.welcome_message}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="fa-cube" label="สินค้า" value={`${products.length}+`} color="brand" />
          <StatCard icon="fa-server" label="เซิร์ฟเวอร์" value={`${servers.length}`} color="blue" />
          <StatCard icon="fa-bolt" label="ส่งอัตโนมัติ" value="ทันที" color="warning" />
          <StatCard icon="fa-shield-halved" label="ปลอดภัย" value="100%" color="success" />
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section>
            <SectionHeader icon="fa-star" title="สินค้าแนะนำ" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featured.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
            </div>
          </section>
        )}

        {/* Main grid with sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-10">
            {newArrivals.length > 0 && (
              <section>
                <SectionHeader icon="fa-clock" title="สินค้ามาใหม่" />
                <div className="grid grid-cols-2 gap-4">
                  {newArrivals.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
                </div>
              </section>
            )}

            {onSale.length > 0 && (
              <section>
                <SectionHeader icon="fa-tags" title="สินค้าลดราคา" badge="SALE" />
                <div className="grid grid-cols-2 gap-4">
                  {onSale.map(p => <ProductCard key={p.id} product={p} servers={servers} />)}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <OnlinePlayersWidget />

            <div className="card p-5">
              <h3 className="font-semibold text-lg mb-3 dark:text-white">
                <i className="fas fa-link mr-2 text-brand-400"></i>ลิงก์ด่วน
              </h3>
              <div className="space-y-2">
                <QuickLink href="/shop" icon="fa-store" label="ร้านค้าทั้งหมด" />
                <QuickLink href="/topup" icon="fa-wallet" label="เติมเงิน" />
                {settings.discord_invite && (
                  <QuickLink href={settings.discord_invite} icon="fa-brands fa-discord" label="Discord" external />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a href="/shop" className="btn-primary text-base py-3 px-10 shadow-theme-md hover:shadow-theme-lg transition-all duration-300">
            <i className="fas fa-store"></i> ดูสินค้าทั้งหมด
          </a>
        </div>
      </div>
    </MainLayout>
  );
}

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 bg-brand-50 dark:bg-brand-500/10 rounded-lg flex items-center justify-center">
        <i className={`fas ${icon} text-brand-500 text-sm`}></i>
      </div>
      <h2 className="text-xl font-bold dark:text-white">{title}</h2>
      {badge && (
        <span className="bg-error-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-500 dark:bg-brand-500/10',
    blue: 'bg-blue-50 text-blue-500 dark:bg-blue-500/10',
    warning: 'bg-warning-50 text-warning-500 dark:bg-warning-500/10',
    success: 'bg-success-50 text-success-500 dark:bg-success-500/10',
  };
  return (
    <div className="card p-4 text-center hover:shadow-theme-md transition-all duration-300 group">
      <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3 ${colorMap[color]} transition-transform duration-300 group-hover:scale-110`}>
        <i className={`fas ${icon} text-xl`}></i>
      </div>
      <div className="text-xl font-bold dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function QuickLink({ href, icon, label, external }: { href: string; icon: string; label: string; external?: boolean }) {
  const Tag = external ? 'a' : 'a';
  const extraProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a
      href={href}
      {...extraProps}
      className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-brand-50 dark:bg-gray-700/50 dark:hover:bg-brand-500/10 transition-colors duration-200 group"
    >
      <i className={`fas ${icon} text-gray-400 group-hover:text-brand-500 w-5 text-center transition-colors`}></i>
      <span className="text-sm dark:text-gray-300">{label}</span>
      <i className="fas fa-chevron-right text-xs text-gray-300 dark:text-gray-600 ml-auto group-hover:text-brand-400 transition-colors"></i>
    </a>
  );
}
