'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { totalOnline, servers } = useOnlinePlayers();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  
  const shopName = settings.shop_name || 'SiamWorld';
  const shopSubtitle = settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ';
  const discordInvite = settings.discord_invite || '#';
  const bannerUrl = settings.website_bg_url;

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
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Left: Server Status (real data) */}
          <div className="bg-black/25 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 shadow-lg hidden md:flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <i className="fas fa-server text-sm"></i>
              </div>
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">PLAY.SIAMWORLD.NET</div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-sm font-bold text-white">{totalOnline} <span className="font-normal text-foreground-muted text-xs">ONLINE</span></span>
                </div>
              </div>
            </div>
            {servers.length > 0 && (
              <div className="space-y-1">
                {servers.map((s) => (
                  <div key={s.serverId} className="flex items-center gap-2">
                    <span className="text-[10px] text-foreground-muted truncate flex-1">{s.serverName}</span>
                    <span className="text-[10px] font-bold text-primary">{s.count}</span>
                    <div className="w-16 h-1 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((s.count / (s.maxPlayers || 100)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center: Big Logo with float animation */}
          <Link href="/" className="group relative flex flex-col items-center">
            <div className="logo-float text-4xl lg:text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,197,94,0.6)] group-hover:drop-shadow-[0_0_30px_rgba(34,197,94,0.9)] transition-all duration-300">
              {shopName}
            </div>
            <div className="text-sm font-medium text-primary mt-1 tracking-widest uppercase">{shopSubtitle}</div>
          </Link>

          {/* Right: Discord */}
          <a href={discordInvite} target="_blank" rel="noopener noreferrer" className="hidden md:flex items-center gap-4 bg-black/25 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 shadow-lg hover:bg-black/35 transition-colors">
            <div className="text-right">
              <div className="text-xs font-bold text-[#5865F2] uppercase tracking-wider mb-0.5">DISCORD.GG/SIAMWORLD</div>
              <div className="text-sm font-medium text-white/70">2,113 USERS ONLINE</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
              <i className="fab fa-discord text-xl"></i>
            </div>
          </a>
        </div>
      </div>
      </div>

      {/* Horizontal Navigation Bar */}
      <div className={`w-full transition-all duration-300 ${isScrolled ? 'fixed top-0 bg-white border-b border-primary/20 shadow-lg' : 'bg-white border-y border-primary/15 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center">
            
            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center w-full justify-center">
              <NavLink href="/" icon="fa-home" label="Home" subLabel="หน้าแรก" pathname={pathname} />
              <NavLink href="/shop" icon="fa-shopping-cart" label="Itemshop" subLabel="ร้านค้าไอเทม" pathname={pathname} />
              <NavLink href="/lootbox" icon="fa-box-open" label="Gacha" subLabel="กล่องสุ่ม" pathname={pathname} />
              <NavLink href="/topup" icon="fa-coins" label="Topup" subLabel="เติมเงิน" pathname={pathname} />
              <NavLink href="/download" icon="fa-download" label="Download" subLabel="ดาวน์โหลด" pathname={pathname} />
            </nav>

            {/* Mobile Toggle */}
            <div className="md:hidden flex w-full justify-between items-center py-3">
              <span className="font-bold text-primary">เมนูหลัก</span>
              <button 
                onClick={() => setMobileOpen(!mobileOpen)}
                className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700"
              >
                <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'}`}></i>
              </button>
            </div>

          </div>

            {/* Mobile Dropdown */}
          {mobileOpen && (
            <div className="md:hidden py-4 border-t border-gray-100 space-y-1">
              <MobileLink href="/" icon="fa-home" pathname={pathname}>หน้าแรก</MobileLink>
              <MobileLink href="/shop" icon="fa-shopping-cart" pathname={pathname}>ไอเท็มชอป</MobileLink>
              <MobileLink href="/lootbox" icon="fa-box-open" pathname={pathname}>กล่องสุ่ม</MobileLink>
              <MobileLink href="/topup" icon="fa-coins" pathname={pathname}>เติมเครดิต</MobileLink>
              <MobileLink href="/download" icon="fa-download" pathname={pathname}>ดาวน์โหลด</MobileLink>
              {user && <MobileLink href="/inventory" icon="fa-box" pathname={pathname}>คลังไอเทม</MobileLink>}
              {user && <MobileLink href="/profile" icon="fa-user" pathname={pathname}>โปรไฟล์</MobileLink>}
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
        <i className={`fas ${icon} ${isActive ? 'text-primary' : 'text-primary/60 group-hover:text-primary'} transition-colors text-xs`}></i>
        <span className={`font-black ${isActive ? 'text-primary' : 'text-gray-700 group-hover:text-primary'} transition-colors text-[15px]`}>{label}</span>
      </div>
      <span className={`text-[10px] font-medium ${isActive ? 'text-primary/70' : 'text-gray-400 group-hover:text-primary/60'} transition-colors`}>{subLabel}</span>
    </Link>
  );
}

function MobileLink({ href, icon, pathname, children }: { href: string; icon: string; pathname: string; children: React.ReactNode }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-primary/5 hover:text-primary'}`}>
      <i className={`fas ${icon} ${isActive ? 'text-primary' : 'text-primary'} w-5 text-center`}></i>
      {children}
    </Link>
  );
}
