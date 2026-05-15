'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import AuthModal from './AuthModal';
import { Button } from './ui/button';

function NavbarContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: 'login' | 'register' }>({ open: false, tab: 'login' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDark = localStorage.getItem('theme') === 'dark';
      setIsDark(savedDark);
      if (savedDark) document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const auth = searchParams.get('auth');
    if (!user && (auth === 'login' || auth === 'register')) {
      setAuthModal({ open: true, tab: auth });
    } else if (user || !auth) {
      if (authModal.open) setAuthModal({ open: false, tab: 'login' });
    }
  }, [searchParams, user]);

  const [activeSection, setActiveSection] = useState('/');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      
      const features = document.getElementById('features');
      const pricing = document.getElementById('pricing');
      
      let current = '/';
      if (pricing && window.scrollY >= pricing.offsetTop - 200) {
        current = '/#pricing';
      } else if (features && window.scrollY >= features.offsetTop - 200) {
        current = '/#features';
      }
      
      if (pathname !== '/') current = pathname;
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // init
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openAuth = (tab: 'login' | 'register') => {
    setAuthModal({ open: true, tab });
    setMobileOpen(false);
  };

  const closeAuth = () => {
    setAuthModal({ ...authModal, open: false });
    const params = new URLSearchParams(window.location.search);
    params.delete('auth');
    const qs = params.toString();
    router.replace(pathname + (qs ? `?${qs}` : ''));
  };

  const handleLogout = () => {
    logout();
    router.push('/');
    setProfileOpen(false);
    setMobileOpen(false);
  };

  const navLink = (href: string, label: string) => {
    const active = activeSection === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`text-sm font-semibold transition-colors cursor-pointer ${
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav className={`sticky top-0 z-[100] transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-md shadow-sm border-b border-border py-3' : 'bg-background py-4 border-b border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group cursor-pointer">
              <Image
                src="/images/logosiamsite-h256.png"
                alt="SIAMSITE logo"
                width={84}
                height={56}
                priority
                className="h-14 w-auto object-contain group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-xl leading-none tracking-tight">SIAMSITE</span>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-widest mt-1">Manager</span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-6 border-l border-border pl-6">
              {navLink('/', 'หน้าแรก')}
              {navLink('/#features', 'ฟีเจอร์เด่น')}
              {navLink('/#pricing', 'ราคาแพ็กเกจ')}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary cursor-pointer">
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-sm`} />
            </button>
            
            {user ? (
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" asChild className="gap-2 rounded-full h-8 cursor-pointer">
                  <Link href="/dashboard/topup">
                    <i className="fas fa-wallet text-primary text-xs" />
                    <span className="font-semibold text-xs">฿{Number(user.walletBalance).toLocaleString()}</span>
                  </Link>
                </Button>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                      {user.displayName?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-foreground max-w-[90px] truncate hidden sm:block">
                      {user.displayName}
                    </span>
                    <i className={`fas fa-chevron-down text-[10px] text-muted-foreground transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-card text-card-foreground border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm font-semibold truncate">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link href="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors cursor-pointer">
                          <i className="fas fa-gauge-high w-4 text-center text-muted-foreground" />
                          แดชบอร์ด
                        </Link>
                        <Link href="/dashboard/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors cursor-pointer">
                          <i className="fas fa-user w-4 text-center text-muted-foreground" />
                          โปรไฟล์ส่วนตัว
                        </Link>
                        {user.role === 'admin' && (
                          <Link href="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer">
                            <i className="fas fa-shield-halved w-4 text-center" />
                            แผงควบคุมแอดมิน
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-border py-1">
                        <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer">
                          <i className="fas fa-sign-out-alt w-4 text-center" />
                          ออกจากระบบ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => openAuth('login')} className="font-semibold text-sm cursor-pointer">
                  เข้าสู่ระบบ
                </Button>
                <Button onClick={() => openAuth('register')} className="font-semibold text-sm rounded-full cursor-pointer">
                  สมัครสมาชิก
                </Button>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center gap-3">
            <button onClick={toggleDark} className="text-muted-foreground w-8 h-8 flex items-center justify-center cursor-pointer">
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-sm`} />
            </button>
            <button className="w-8 h-8 text-foreground cursor-pointer" onClick={() => setMobileOpen(!mobileOpen)}>
              <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'} text-lg`} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 border-b border-border bg-background px-6 py-4 shadow-lg animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-3 mb-2 p-3 bg-secondary rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {user.displayName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm font-semibold py-2 cursor-pointer">แดชบอร์ด</Link>
                  <Link href="/dashboard/topup" onClick={() => setMobileOpen(false)} className="text-sm font-semibold py-2 cursor-pointer">เติมเงิน</Link>
                  {user.role === 'admin' && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)} className="text-sm font-semibold py-2 text-primary cursor-pointer">แผงควบคุมแอดมิน</Link>
                  )}
                  <button onClick={handleLogout} className="text-sm font-semibold py-2 text-destructive text-left cursor-pointer">ออกจากระบบ</button>
                </>
              ) : (
                <div className="grid gap-3 pt-2">
                  <Button variant="outline" className="w-full justify-center cursor-pointer" onClick={() => openAuth('login')}>
                    เข้าสู่ระบบ
                  </Button>
                  <Button className="w-full justify-center cursor-pointer" onClick={() => openAuth('register')}>
                    สมัครสมาชิก
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal 
        isOpen={authModal.open} 
        initialTab={authModal.tab} 
        onClose={closeAuth} 
      />
    </>
  );
}

export default function Navbar() {
  return (
    <Suspense>
      <NavbarContent />
    </Suspense>
  );
}