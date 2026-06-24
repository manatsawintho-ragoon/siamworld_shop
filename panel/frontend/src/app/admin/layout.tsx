'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import CommandPalette from '@/components/CommandPalette';
import { 
  PieChart, Store, Users, Receipt, Ticket,
  LifeBuoy, History, Settings, Sun, Moon, Megaphone,
  ChevronDown, LogOut, LayoutDashboard, Menu, X, Loader2,
  GalleryHorizontalEnd
} from 'lucide-react';

const MENU_CATEGORIES = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'ภาพรวมระบบ', icon: PieChart },
    ]
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/customers', label: 'ร้านค้าทั้งหมด', icon: Store },
      { href: '/admin/users', label: 'ผู้ใช้งาน', icon: Users },
    ]
  },
  {
    title: 'Finance',
    items: [
      { href: '/admin/payments', label: 'รายการชำระเงิน', icon: Receipt },
      { href: '/admin/vouchers', label: 'โค้ดโปรโมชั่น', icon: Ticket },
    ]
  },
  {
    title: 'System',
    items: [
      { href: '/admin/announcements', label: 'ประกาศอัพเดท', icon: Megaphone },
      { href: '/admin/showcase', label: 'ตัวอย่างฟีเจอร์', icon: GalleryHorizontalEnd },
      { href: '/admin/support', label: 'แจ้งปัญหา (Tickets)', icon: LifeBuoy },
      { href: '/admin/audit-logs', label: 'บันทึกเหตุการณ์', icon: History },
      { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'online' | 'checking'>('checking');
  const [isDark, setIsDark] = useState(false);
  const [unread, setUnread] = useState({ tickets: 0, slips: 0, total: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (saved === 'dark' || (!saved && prefersDark)) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
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

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/notifications/unread');
      setUnread(data);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  }, []);

  useEffect(() => {
    const check = () => {
      api.get('/api/health').then(() => setSystemStatus('online')).catch(() => setSystemStatus('checking'));
      if (user?.role === 'admin') fetchUnread();
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [user, fetchUnread]);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      <CommandPalette />

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 h-full fixed left-0 top-0 bg-card border-r border-border z-50 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border bg-primary/5 shrink-0 justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <Image
              src="/images/logosiamsite-h256.png"
              alt="SIAMSITE logo"
              width={60}
              height={40}
              className="h-8 w-auto object-contain"
            />
            <span className="font-black text-foreground text-sm tracking-tight uppercase">SIAMSITE</span>
          </Link>
          <button 
            className="md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar space-y-6">
          {MENU_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-2">
                {category.title}
              </h4>
              <div className="space-y-1">
                {category.items.map((item) => {
                  const active = pathname === item.href;
                  const badgeCount = item.href === '/admin/support' ? unread.tickets : item.href === '/admin/payments' ? unread.slips : 0;
                  const Icon = item.icon;

                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground font-medium'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? 'text-primary' : 'opacity-70'} />
                        <span className="text-[13px]">{item.label}</span>
                      </div>
                      {badgeCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-border shrink-0 bg-card">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className={`w-2 h-2 rounded-full ${systemStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-orange-500'}`} />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ADMIN PANEL v2.0</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 shrink-0 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary cursor-pointer transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm sm:text-lg font-bold text-foreground">แผงควบคุมระบบ</h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary cursor-pointer">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors cursor-pointer bg-card shadow-sm">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-inner">
                  {user.displayName?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-foreground max-w-[90px] truncate hidden sm:block">
                  {user.displayName}
                </span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card text-card-foreground border border-border rounded-2xl shadow-xl z-50 py-2 backdrop-blur-xl">
                  <div className="px-4 py-3 border-b border-border mb-1 bg-secondary/50 mx-2 rounded-xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Signed in as</p>
                    <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
                  </div>
                  <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
                    <LayoutDashboard size={16} />
                    Back to Shop
                  </Link>
                  <div className="border-t border-border mt-1 pt-1">
                    <button onClick={() => logout()} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer">
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}