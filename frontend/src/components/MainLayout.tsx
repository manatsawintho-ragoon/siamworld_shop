'use client';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import RankingWidget from '@/components/RankingWidget';
import OnlinePlayersWidget from '@/components/OnlinePlayersWidget';
import SidebarLogin from '@/components/SidebarLogin';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading, isAdmin } = useAuth();
  
  return (
    <div className="flex flex-col min-h-screen transition-colors duration-200">
      <Navbar />
      
      {/* Boxed Content Layout (Classic MC style) */}
      <main className="flex-1 max-w-[1280px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6 relative z-10">
        
        {/* Left Content Area (75%) */}
        <div className="flex-1 min-w-0 flex flex-col animate-fade-in order-2 lg:order-1">
          {children}
        </div>

        {/* Right Sidebar (25% / 320px) */}
        <aside className="w-full lg:w-[320px] flex-shrink-0 space-y-6 animate-fade-in order-1 lg:order-2">
          
          {/* User Profile / Member Login Card */}
          <div className="card overflow-hidden">
            <div className="card-header-mc flex items-center justify-between">
              <span><i className="fas fa-users mr-2 text-primary"></i>Member ระบบสมาชิก</span>
              <span className="text-[10px] text-foreground-subtle">Status</span>
            </div>
            <div className="p-5 relative">
              {/* Subtle background glow for user area */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10"></div>
              
              {loading ? (
                <div className="space-y-4 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto animate-pulse" />
                  <div className="h-4 w-1/2 mx-auto skeleton" />
                  <div className="h-8 w-full skeleton" />
                </div>
              ) : user ? (
                <div className="text-center group">
                  <div className="relative inline-block mb-3">
                    <img 
                      src={`https://mc-heads.net/avatar/${user.username}/64`} 
                      alt={user.username}
                      className="relative w-16 h-16 mx-auto rounded-lg border border-white/10 shadow-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/64';
                      }}
                    />
                    {isAdmin && (
                      <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black border border-white/20 shadow-md pointer-events-none uppercase tracking-wider" title="Admin">
                        Admin
                      </div>
                    )}
                  </div>

                  <h3 className="font-black text-lg text-white truncate drop-shadow-md tracking-wide mt-1">{user.username}</h3>
                  
                  <div className="mt-4 bg-black/30 rounded-lg p-3 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">ยอดเงินคงเหลือ</span>
                      <i className="fas fa-coins text-warning text-xs drop-shadow-md" aria-hidden="true"></i>
                    </div>
                    <div className="text-left font-black text-warning tabular-nums text-xl drop-shadow-sm">
                      {user.wallet_balance?.toLocaleString()} <span className="text-sm">฿</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href="/topup" className="btn-success text-xs py-2 shadow-lg">
                      <i className="fas fa-credit-card"></i> เติมเงิน
                    </Link>
                    <Link href="/profile" className="btn-primary text-xs py-2 shadow-lg">
                      <i className="fas fa-user-circle"></i> โปรไฟล์
                    </Link>
                  </div>
                  
                  <button 
                    onClick={logout} 
                    className="mt-3 w-full btn-danger text-xs py-2 shadow-lg group-hover:opacity-100 opacity-90 transition-opacity"
                  >
                    <i className="fas fa-sign-out-alt"></i> ออกจากระบบ
                  </button>
                </div>
              ) : (
                <SidebarLogin />
              )}
            </div>
          </div>

          {/* Quick Menu (New iMC เมนู) */}
          <div className="card overflow-hidden hidden lg:block">
            <div className="card-header-mc flex items-center justify-between">
              <span><i className="fas fa-bars mr-2 text-primary"></i>Menu เมนูหลัก</span>
            </div>
            <div className="p-2 space-y-1">
              <Link href="/register" className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-bold text-foreground-muted hover:bg-white/5 hover:text-white transition-colors border-l-2 border-transparent hover:border-primary">
                <i className="fas fa-user-plus w-4 text-center text-primary/70"></i> สมัครสมาชิก
              </Link>
              <Link href="/topup" className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-bold text-foreground-muted hover:bg-white/5 hover:text-white transition-colors border-l-2 border-transparent hover:border-primary">
                <i className="fas fa-coins w-4 text-center text-warning/70"></i> เติมเงิน
              </Link>
              <Link href="/shop" className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-bold text-foreground-muted hover:bg-white/5 hover:text-white transition-colors border-l-2 border-transparent hover:border-primary">
                <i className="fas fa-shopping-cart w-4 text-center text-primary/70"></i> ไอเท็มชอป
              </Link>
              <Link href="/download" className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-bold text-foreground-muted hover:bg-white/5 hover:text-white transition-colors border-l-2 border-transparent hover:border-primary">
                <i className="fas fa-download w-4 text-center text-success/70"></i> ดาวน์โหลดเกมส์
              </Link>
              <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded text-sm font-bold text-foreground-muted hover:bg-white/5 hover:text-white transition-colors border-l-2 border-transparent hover:border-primary">
                <i className="fas fa-info-circle w-4 text-center text-primary/70"></i> แนะนำผู้เล่นใหม่
              </Link>
            </div>
          </div>

          <OnlinePlayersWidget />
          <RankingWidget />
        </aside>
      </main>

      <Footer />
    </div>
  );
}
