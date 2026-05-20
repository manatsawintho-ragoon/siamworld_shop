'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';

export default function Navbar() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
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
                  <img src={logoUrl} alt={shopName} className="h-32 md:h-48 lg:h-56 w-auto object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]" />
                </div>
              ) : (
                <div className="logo-float flex flex-col items-center transition-all duration-300">
                  <div className="text-5xl lg:text-7xl font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.6)] text-center">
                    {shopName}
                  </div>
                  <div className="text-base lg:text-lg font-bold mt-2 tracking-[0.3em] uppercase text-center w-full"
                    style={{ color: 'rgb(var(--color-primary-light))' }}>{shopSubtitle}</div>
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Horizontal Navigation Bar — sticky, no gap */}
      <div ref={navRef}
        className={`w-full relative sticky top-0 z-50 transition-shadow duration-300 ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}
        style={{ background: 'rgb(var(--color-surface))', borderBottom: '1px solid rgb(var(--color-border))' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center">

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center w-full justify-center">
              <NavLink href="/"         icon="fa-home"          label="Home"      subLabel="หน้าแรก"       pathname={pathname} />
              <NavLink href="/shop"     icon="fa-shopping-cart" label="Itemshop"  subLabel="ร้านค้าไอเท็ม" pathname={pathname} />
              {showLootbox  && <NavLink href="/lootbox"  icon="fa-box-open"      label="Gacha"     subLabel="กล่องสุ่ม"     pathname={pathname} />}
              <NavLink href="/topup"    icon="fa-coins"         label="Topup"     subLabel="เติมเงิน"       pathname={pathname} />
              {showDownload && <NavLink href="/download" icon="fa-download"      label="Download"  subLabel="ดาวน์โหลด"     pathname={pathname} />}
            </nav>

            {/* Mobile Toggle */}
            <div className="md:hidden flex w-full justify-between items-center py-3">
              <span className="font-bold text-sm tracking-wide uppercase" style={{ color: 'rgb(var(--color-primary))' }}>เมนูหลัก</span>
              <button onClick={() => setMobileOpen(!mobileOpen)}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                style={{ backgroundColor: 'rgb(var(--color-surface-hover))', color: 'rgb(var(--color-foreground-muted))', border: '1px solid rgb(var(--color-border))' }}>
                <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`} />
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown — absolute overlay below nav bar */}
        {mobileOpen && (
          <div className="md:hidden absolute left-0 right-0 top-full z-50 shadow-xl"
            style={{ background: 'rgb(var(--color-surface))', borderTop: '1px solid rgb(var(--color-border))' }}>
            <div className="max-w-7xl mx-auto px-3 py-4 space-y-4 max-h-[80vh] overflow-y-auto">

              {/* User Info in Mobile Menu */}
              {user && (
                <div className="px-4 py-3 rounded-2xl mx-1 border shadow-sm"
                  style={{ backgroundColor: 'rgb(var(--color-surface-hover))', borderColor: 'rgb(var(--color-border-muted))' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg border-2 overflow-hidden shadow-sm"
                      style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}>
                      <img
                        src={`https://mc-heads.net/avatar/${user.username}/40`}
                        alt={user.username}
                        className="w-full h-full"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate leading-none" style={{ color: 'rgb(var(--color-foreground))' }}>{user.username}</p>
                      <p className="font-bold text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'rgb(var(--color-primary))' }}>ยินดีต้อนรับ</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-1" style={{ color: 'rgb(var(--color-foreground-subtle))' }}>ยอดเงิน</p>
                      <p className="font-black text-sm tabular-nums" style={{ color: 'rgb(var(--color-primary))' }}>
                        {user.wallet_balance?.toLocaleString('th-TH')} <span className="text-[10px]">฿</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/topup" onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-[10px] font-black"
                      style={{ backgroundColor: 'rgb(var(--color-primary))', boxShadow: '0 2px 0 rgb(var(--color-primary-hover))' }}>
                      <i className="fas fa-plus-circle" /> เติมเงิน
                    </Link>
                    <Link href="/profile" onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black border"
                      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-foreground-muted))', boxShadow: '0 2px 0 rgb(var(--color-border))' }}>
                      <i className="fas fa-user" /> โปรไฟล์
                    </Link>
                  </div>
                </div>
              )}

              <div className="space-y-1 pb-2">
                <MobileLink href="/"         icon="fa-home"          pathname={pathname}>หน้าแรก</MobileLink>
                <MobileLink href="/shop"     icon="fa-shopping-cart" pathname={pathname}>ไอเท็มชอป</MobileLink>
                {showLootbox  && <MobileLink href="/lootbox"  icon="fa-box-open"      pathname={pathname}>กล่องสุ่ม</MobileLink>}
                <MobileLink href="/topup"    icon="fa-coins"         pathname={pathname}>เติมเงิน</MobileLink>
                {showDownload && <MobileLink href="/download" icon="fa-download"      pathname={pathname}>ดาวน์โหลด</MobileLink>}
                {user && <MobileLink href="/inventory" icon="fa-box-open"    pathname={pathname}>คลังไอเท็ม</MobileLink>}
                {user && <MobileLink href="/profile"   icon="fa-user-circle" pathname={pathname}>จัดการโปรไฟล์</MobileLink>}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-surface/95 backdrop-blur-md border-t border-border px-2 py-2 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <MobileBottomLink href="/" icon="fa-home" label="หน้าแรก" active={pathname === '/'} />
        <MobileBottomLink href="/shop" icon="fa-shopping-cart" label="ร้านค้า" active={pathname.startsWith('/shop')} />
        {showLootbox && <MobileBottomLink href="/lootbox" icon="fa-box-open" label="กล่องสุ่ม" active={pathname.startsWith('/lootbox')} />}
        <MobileBottomLink href="/topup" icon="fa-coins" label="เติมเงิน" active={pathname.startsWith('/topup')} />
        <MobileBottomLink href={user ? "/profile" : "/"} icon="fa-user" label={user ? "โปรไฟล์" : "ล็อกอิน"} active={pathname.startsWith('/profile')} />
      </nav>
    </header>
  );
}

function MobileBottomLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all">
      <div
        className="w-11 h-8 rounded-full flex items-center justify-center transition-all"
        style={active
          ? { backgroundColor: 'rgb(var(--color-primary))', color: 'rgb(var(--color-primary-foreground))', boxShadow: '0 2px 10px rgb(var(--color-primary) / 0.45), 0 1px 0 rgb(var(--color-primary-shadow) / 0.4)' }
          : { color: 'rgb(var(--color-foreground-muted))' }
        }
      >
        <i className={`fas ${icon} text-sm`} />
      </div>
      <span
        className="text-[10px] font-black tracking-wide"
        style={{ color: active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-foreground-muted))' }}
      >
        {label}
      </span>
    </Link>
  );
}

function NavLink({ href, icon, label, subLabel, pathname }: { href: string; icon: string; label: string; subLabel: string; pathname: string }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`mc-nav-link flex flex-col items-center justify-center min-w-[120px] group ${isActive ? 'active' : ''}`}
      style={isActive ? { backgroundColor: 'rgb(var(--color-primary) / 0.12)' } : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <i className={`fas ${icon} text-sm`} />
        <span className="font-black text-[15px]">{label}</span>
      </div>
      <span className="text-[10px] font-bold opacity-80">{subLabel}</span>
    </Link>
  );
}

function MobileLink({ href, icon, pathname, children }: { href: string; icon: string; pathname: string; children: React.ReactNode }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  const accentStyle = { color: 'rgb(var(--color-primary))' };
  const activeBgStyle = { backgroundColor: 'rgb(var(--color-primary) / 0.1)', color: 'rgb(var(--color-primary))' };
  const defaultStyle = { color: 'rgb(var(--color-foreground-muted))' };
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${isActive ? '' : 'hover:bg-gray-50'}`}
      style={isActive ? activeBgStyle : defaultStyle}
    >
      <i className={`fas ${icon} w-5 text-center`} style={accentStyle} />
      {children}
    </Link>
  );
}
