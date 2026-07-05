'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuthModal } from '@/components/AuthModal';
import {
  Home, ShoppingCart, PackageOpen, Coins, Download,
  User, LogIn, type LucideIcon,
} from 'lucide-react';

export default function Navbar() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { open: openAuth } = useAuthModal();
  const [isScrolled, setIsScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const shopName     = settings.shop_name    || 'Siamsite';
  const shopSubtitle = settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ';
  const bannerUrl    = settings.website_bg_url;
  const logoUrl      = settings.website_logo_url;
  // Default to shown ('1') so existing installs aren't surprised after the upgrade.
  const showLootbox  = (settings.show_lootbox_nav  ?? '1') === '1';
  const showDownload = (settings.show_download_nav ?? '1') === '1';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="relative w-full z-40">
      {/* Branding Banner — uses theme CSS vars */}
      <div className="relative theme-navbar-banner overflow-hidden">
        {bannerUrl && (
          <>
            <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden="true" />
            <div className="absolute inset-0 bg-black/70" />
          </>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
          <div className="flex flex-col items-center justify-center">
            {/* Center: Big Logo or Text */}
            <Link href="/" className="group relative flex flex-col items-center max-w-full">
              {logoUrl ? (
                <div className="logo-float transition-all duration-500 transform group-hover:scale-110">
                  <img src={logoUrl} alt={shopName} className="h-28 sm:h-32 md:h-48 lg:h-56 w-auto object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]" />
                </div>
              ) : (
                <div className="logo-float flex flex-col items-center transition-all duration-300">
                  <div className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.6)] text-center">
                    {shopName}
                  </div>
                  <div className="text-sm sm:text-base lg:text-lg font-bold mt-2 tracking-[0.3em] uppercase text-center w-full"
                    style={{ color: 'rgb(var(--color-primary-light))' }}>{shopSubtitle}</div>
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop Navigation Bar — sticky. Hidden on mobile (bottom nav takes over). */}
      <div ref={navRef}
        className={`hidden md:block w-full relative sticky top-0 z-50 transition-shadow duration-300 ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}
        style={{ background: 'rgb(var(--color-surface))', borderBottom: '1px solid rgb(var(--color-border))' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center w-full justify-center">
            <NavLink href="/"         Icon={Home}          label="Home"      subLabel="หน้าแรก"       pathname={pathname} />
            <NavLink href="/shop"     Icon={ShoppingCart}  label="Itemshop"  subLabel="ร้านค้าไอเท็ม" pathname={pathname} />
            {showLootbox  && <NavLink href="/lootbox"  Icon={PackageOpen} label="Gacha"     subLabel="กล่องสุ่ม"     pathname={pathname} />}
            <NavLink href="/topup"    Icon={Coins}         label="Topup"     subLabel="เติมเงิน"       pathname={pathname} />
            {showDownload && <NavLink href="/download" Icon={Download}     label="Download"  subLabel="ดาวน์โหลด"     pathname={pathname} />}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar — thumb-reachable primary nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-surface/95 backdrop-blur-md border-t border-border px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <MobileBottomLink href="/" Icon={Home} label="หน้าแรก" active={pathname === '/'} />
        <MobileBottomLink href="/shop" Icon={ShoppingCart} label="ร้านค้า" active={pathname.startsWith('/shop')} />
        {showLootbox && <MobileBottomLink href="/lootbox" Icon={PackageOpen} label="กล่องสุ่ม" active={pathname.startsWith('/lootbox')} />}
        <MobileBottomLink href="/topup" Icon={Coins} label="เติมเงิน" active={pathname.startsWith('/topup')} />
        {user
          ? <MobileBottomLink href="/profile" Icon={User} label="โปรไฟล์" active={pathname.startsWith('/profile')} />
          : <MobileBottomLink onClick={openAuth} Icon={LogIn} label="ล็อกอิน" active={false} />}
      </nav>
    </header>
  );
}

function MobileBottomLink({ href, onClick, Icon, label, active }: { href?: string; onClick?: () => void; Icon: LucideIcon; label: string; active: boolean }) {
  const inner = (
    <>
      <div
        className="w-11 h-8 rounded-full flex items-center justify-center transition-all"
        style={active
          ? { backgroundColor: 'rgb(var(--color-primary))', color: 'rgb(var(--color-primary-foreground))', boxShadow: '0 2px 10px rgb(var(--color-primary) / 0.45), 0 1px 0 rgb(var(--color-primary-shadow) / 0.4)' }
          : { color: 'rgb(var(--color-foreground-muted))' }
        }
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.5 : 2} />
      </div>
      <span
        className="text-[10px] font-black tracking-wide"
        style={{ color: active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-foreground-muted))' }}
      >
        {label}
      </span>
    </>
  );
  const cls = 'flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] transition-all';
  if (onClick) {
    return <button onClick={onClick} className={cls} aria-label={label}>{inner}</button>;
  }
  return <Link href={href!} className={cls}>{inner}</Link>;
}

function NavLink({ href, Icon, label, subLabel, pathname }: { href: string; Icon: LucideIcon; label: string; subLabel: string; pathname: string }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`mc-nav-link flex flex-col items-center justify-center min-w-[120px] group ${isActive ? 'active' : ''}`}
      style={isActive ? { backgroundColor: 'rgb(var(--color-primary) / 0.12)' } : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
        <span className="font-black text-[15px]">{label}</span>
      </div>
      <span className="text-[10px] font-bold opacity-80">{subLabel}</span>
    </Link>
  );
}
