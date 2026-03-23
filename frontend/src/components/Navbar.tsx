'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';

export default function Navbar() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  const shopName     = settings.shop_name    || 'SiamWorld';
  const shopSubtitle = settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ';
  const bannerUrl    = settings.website_bg_url;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="relative w-full z-40">
      {/* Green Minecraft Branding Banner */}
      <div className="relative bg-gradient-to-b from-green-900 to-green-700 overflow-hidden">
        {bannerUrl && (
          <>
            <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
            <div className="absolute inset-0 bg-black/70" />
          </>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
          <div className="flex flex-col items-center justify-center">
            {/* Center: Big Logo */}
            <Link href="/" className="group relative flex flex-col items-center">
              <div className="logo-float flex flex-col items-center group-hover:drop-shadow-[0_0_30px_rgba(34,197,94,0.9)] transition-all duration-300">
                <div className="text-4xl lg:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] text-center">
                  {shopName}
                </div>
                <div className="text-sm font-medium text-green-400 mt-1 tracking-widest uppercase text-center w-full">{shopSubtitle}</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Horizontal Navigation Bar */}
      <div className={`w-full transition-all duration-300 ${isScrolled ? 'fixed top-0 bg-white border-b border-green-200 shadow-lg' : 'bg-white border-y border-green-100 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center">

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center w-full justify-center">
              <NavLink href="/"         icon="fa-home"          label="Home"      subLabel="หน้าแรก"       pathname={pathname} />
              <NavLink href="/shop"     icon="fa-shopping-cart" label="Itemshop"  subLabel="ร้านค้าไอเท็ม" pathname={pathname} />
              <NavLink href="/lootbox"  icon="fa-box-open"      label="Gacha"     subLabel="กล่องสุ่ม"     pathname={pathname} />
              <NavLink href="/topup"    icon="fa-coins"         label="Topup"     subLabel="เติมเงิน"       pathname={pathname} />
              <NavLink href="/download" icon="fa-download"      label="Download"  subLabel="ดาวน์โหลด"     pathname={pathname} />
            </nav>

            {/* Mobile Toggle */}
            <div className="md:hidden flex w-full justify-between items-center py-3">
              <span className="font-bold text-green-600">เมนูหลัก</span>
              <button onClick={() => setMobileOpen(!mobileOpen)}
                className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
                <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`} />
              </button>
            </div>

          </div>

          {/* Mobile Dropdown */}
          {mobileOpen && (
            <div className="md:hidden py-4 border-t border-gray-100 space-y-1">
              <MobileLink href="/"         icon="fa-home"          pathname={pathname}>หน้าแรก</MobileLink>
              <MobileLink href="/shop"     icon="fa-shopping-cart" pathname={pathname}>ไอเท็มชอป</MobileLink>
              <MobileLink href="/lootbox"  icon="fa-box-open"      pathname={pathname}>กล่องสุ่ม</MobileLink>
              <MobileLink href="/topup" icon="fa-coins" pathname={pathname}>เติมเงิน</MobileLink>
              <MobileLink href="/download" icon="fa-download"      pathname={pathname}>ดาวน์โหลด</MobileLink>
              {user && <MobileLink href="/inventory" icon="fa-box"  pathname={pathname}>คลังไอเท็ม</MobileLink>}
              {user && <MobileLink href="/profile"   icon="fa-user" pathname={pathname}>โปรไฟล์</MobileLink>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, icon, label, subLabel, pathname }: { href: string; icon: string; label: string; subLabel: string; pathname: string }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className={`mc-nav-link flex flex-col items-center justify-center min-w-[120px] group ${isActive ? 'active' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <i className={`fas ${icon} ${isActive ? 'text-green-600' : 'text-green-500/60 group-hover:text-green-600'} transition-colors text-xs`} />
        <span className={`font-black ${isActive ? 'text-green-600' : 'text-gray-700 group-hover:text-green-600'} transition-colors text-[15px]`}>{label}</span>
      </div>
      <span className={`text-[10px] font-medium ${isActive ? 'text-green-500/70' : 'text-gray-400 group-hover:text-green-500/60'} transition-colors`}>{subLabel}</span>
    </Link>
  );
}

function MobileLink({ href, icon, pathname, children }: { href: string; icon: string; pathname: string; children: React.ReactNode }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${isActive ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-green-50/50 hover:text-green-600'}`}>
      <i className={`fas ${icon} text-green-500 w-5 text-center`} />
      {children}
    </Link>
  );
}

