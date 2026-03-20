'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const shopName = settings.shop_name || 'NEW iMC';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="relative w-full z-40">
      {/* Top Banner Area (MC Prison Style) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Left: Server IP / Players */}
          <div className="flex items-center gap-4 bg-surface/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/5 shadow-lg hidden md:flex">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <i className="fas fa-play"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">PLAY.SIAMWORLD.NET</div>
              <div className="text-sm font-medium text-foreground-muted">27,094 PLAYERS ONLINE</div>
            </div>
          </div>

          {/* Center: Big Logo */}
          <Link href="/" className="group relative flex flex-col items-center">
            <div className="text-4xl lg:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(14,165,233,0.5)] group-hover:drop-shadow-[0_0_25px_rgba(14,165,233,0.8)] transition-all duration-300">
              {shopName}
            </div>
            <div className="text-sm font-medium text-primary mt-1 tracking-widest uppercase">ระบบร้านค้ามายคราฟ</div>
          </Link>

          {/* Right: Discord */}
          <a href="#" className="flex items-center gap-4 bg-surface/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/5 shadow-lg hidden md:flex hover:bg-surface/80 transition-colors">
            <div className="text-right">
              <div className="text-xs font-bold text-[#5865F2] uppercase tracking-wider mb-0.5">DISCORD.GG/SIAMWORLD</div>
              <div className="text-sm font-medium text-foreground-muted">2,113 USERS ONLINE</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
              <i className="fab fa-discord text-xl"></i>
            </div>
          </a>
          
        </div>
      </div>

      {/* Horizontal Navigation Bar (iMC Style) */}
      <div className={`w-full transition-all duration-300 ${isScrolled ? 'fixed top-0 bg-background/95 backdrop-blur-xl border-b border-white/5 shadow-xl' : 'bg-surface/60 backdrop-blur-lg border-y border-white/5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center">
            
            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center w-full justify-center">
              <NavLink href="/" icon="fa-home" label="Home" subLabel="หน้าแรก" />
              <NavLink href="/register" icon="fa-user-plus" label="Register ID" subLabel="สมัครสมาชิก" />
              <NavLink href="/download" icon="fa-download" label="Download" subLabel="ดาวน์โหลดเกมส์" />
              <NavLink href="/shop" icon="fa-shopping-cart" label="Itemshop" subLabel="ไอเท็มชอป" />
              <NavLink href="/lootbox" icon="fa-box-open" label="Gacha" subLabel="กล่องสุ่ม" />
              {user && <NavLink href="/topup" icon="fa-credit-card" label="Refill" subLabel="เติมเงิน" />}
              {user && <NavLink href="/inventory" icon="fa-box" label="Inventory" subLabel="คลังไอเทม" />}
              {isAdmin && <NavLink href="/admin" icon="fa-cogs" label="Admin" subLabel="จัดการระบบ" />}
            </nav>

            {/* Mobile Toggle */}
            <div className="md:hidden flex w-full justify-between items-center py-3">
              <span className="font-bold text-primary">เมนูหลัก</span>
              <button 
                onClick={() => setMobileOpen(!mobileOpen)}
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white"
              >
                <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
              </button>
            </div>

          </div>

          {/* Mobile Dropdown */}
          {mobileOpen && (
            <div className="md:hidden py-4 border-t border-white/10 space-y-1">
              <MobileLink href="/" icon="fa-home">หน้าแรก</MobileLink>
              <MobileLink href="/shop" icon="fa-shopping-cart">ร้านค้า</MobileLink>
              <MobileLink href="/lootbox" icon="fa-box-open">กล่องสุ่ม</MobileLink>
              {user && <MobileLink href="/topup" icon="fa-credit-card">เติมเงิน</MobileLink>}
              {user && <MobileLink href="/inventory" icon="fa-box">คลังไอเทม</MobileLink>}
              {user && <MobileLink href="/profile" icon="fa-user">โปรไฟล์</MobileLink>}
              {isAdmin && <MobileLink href="/admin" icon="fa-cogs">จัดการระบบ</MobileLink>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, icon, label, subLabel }: { href: string; icon: string; label: string; subLabel: string }) {
  return (
    <Link href={href} className="mc-nav-link flex flex-col items-center justify-center min-w-[120px] group">
      <div className="flex items-center gap-2 mb-1">
        <i className={`fas ${icon} text-primary/70 group-hover:text-primary transition-colors text-xs`}></i>
        <span className="font-black text-white text-[15px]">{label}</span>
      </div>
      <span className="text-[10px] text-foreground-subtle font-medium">{subLabel}</span>
    </Link>
  );
}

function MobileLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-foreground-muted hover:bg-white/5 hover:text-white transition-colors">
      <i className={`fas ${icon} text-primary w-5 text-center`}></i>
      {children}
    </Link>
  );
}
