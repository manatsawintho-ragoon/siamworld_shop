'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import CommandPalette from '@/components/CommandPalette';

const MENU_CATEGORIES = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'ภาพรวมระบบ', icon: 'fa-chart-pie' },
    ]
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/customers', label: 'ร้านค้าทั้งหมด', icon: 'fa-store' },
      { href: '/admin/users', label: 'ผู้ใช้งาน', icon: 'fa-users' },
    ]
  },
  {
    title: 'Finance',
    items: [
      { href: '/admin/payments', label: 'รายการชำระเงิน', icon: 'fa-receipt' },
      { href: '/admin/vouchers', label: 'โค้ดโปรโมชั่น', icon: 'fa-ticket' },
    ]
  },
  {
    title: 'System',
    items: [
      { href: '/admin/support', label: 'แจ้งปัญหา (Tickets)', icon: 'fa-life-ring' },
      { href: '/admin/audit-logs', label: 'บันทึกเหตุการณ์', icon: 'fa-clock-rotate-left' },
      { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: 'fa-sliders' },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
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

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <i className="fas fa-circle-notch fa-spin text-3xl text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <CommandPalette />

      {/* Sidebar */}
      <aside className="w-64 h-screen fixed left-0 top-0 bg-card border-r border-border z-50 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border bg-primary/5">
          <Link href="/" className="flex items-center gap-2 group w-full cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground group-hover:opacity-90 transition-opacity">
              <i className="fas fa-gem text-sm" />
            </div>
            <span className="font-bold text-foreground text-base tracking-tight uppercase">SIAMSITE</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto hide-scrollbar space-y-6">
          {MENU_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                {category.title}
              </h4>
              <div className="space-y-1">
                {category.items.map((item) => {
                  const active = pathname === item.href;
                  const badgeCount = item.href === '/admin/support' ? unread.tickets : item.href === '/admin/payments' ? unread.slips : 0;

                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                      <div className="flex items-center gap-3">
                        <i className={`fas ${item.icon} w-4 text-center text-sm`} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {badgeCount > 0 && (
                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
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
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">ADMIN PANEL v2.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-foreground">แผงควบคุมระบบ</h2>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary cursor-pointer">
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-sm`} />
            </button>

            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border hover:bg-secondary transition-colors cursor-pointer">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                  {user.displayName?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-foreground max-w-[90px] truncate hidden sm:block">
                  {user.displayName}
                </span>
                <i className={`fas fa-chevron-down text-[10px] text-muted-foreground transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card text-card-foreground border border-border rounded-xl shadow-lg z-50 py-1">
                  <div className="px-4 py-3 border-b border-border mb-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Signed in as</p>
                    <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
                  </div>
                  <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors cursor-pointer">
                    <i className="fas fa-gauge-high w-4 text-center text-muted-foreground" />
                    Back to Shop
                  </Link>
                  <div className="border-t border-border mt-1 pt-1">
                    <button onClick={() => logout()} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer">
                      <i className="fas fa-sign-out-alt w-4 text-center" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}