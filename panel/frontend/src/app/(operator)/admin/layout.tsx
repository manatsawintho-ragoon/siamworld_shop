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
  GalleryHorizontalEnd, Flame
} from 'lucide-react';

/* Sidebar groups. Thai labels are the ones people actually read, so they are
   the primary text; the English group headings stay only as quiet separators. */
const MENU_CATEGORIES = [
  {
    title: 'ภาพรวม',
    items: [
      { href: '/admin', label: 'ภาพรวมระบบ', icon: PieChart },
    ]
  },
  {
    title: 'จัดการ',
    items: [
      { href: '/admin/customers', label: 'ร้านค้าทั้งหมด', icon: Store },
      { href: '/admin/users', label: 'ผู้ใช้งาน', icon: Users },
    ]
  },
  {
    title: 'การเงิน',
    items: [
      { href: '/admin/payments', label: 'รายการชำระเงิน', icon: Receipt },
      { href: '/admin/vouchers', label: 'โค้ดโปรโมชั่น', icon: Ticket },
    ]
  },
  {
    title: 'ระบบ',
    items: [
      { href: '/admin/announcements', label: 'ประกาศอัพเดท', icon: Megaphone },
      { href: '/admin/showcase', label: 'ตัวอย่างฟีเจอร์', icon: GalleryHorizontalEnd },
      { href: '/admin/support', label: 'แจ้งปัญหา', icon: LifeBuoy },
      { href: '/admin/activity', label: 'พฤติกรรมการใช้งาน', icon: Flame },
      { href: '/admin/audit-logs', label: 'บันทึกเหตุการณ์', icon: History },
      { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings },
    ]
  }
];

/** Page title shown in the header, so the current location is always stated in
 *  words and not only as a highlighted sidebar row (which is invisible once the
 *  sidebar is closed on a phone). */
const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  MENU_CATEGORIES.flatMap(c => c.items.map(i => [i.href, i.label]))
);

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

  // The drawer covers the page on a phone, so the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const pageTitle = PAGE_TITLES[pathname] || 'แผงควบคุมระบบ';

  return (
    <div className="admin-shell min-h-screen bg-background">
      <CommandPalette />

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────
          Flat list, one accent. The active row is marked by an amber left rule
          plus an amber label, so it is legible in greyscale and does not rely
          on a filled pill that competes with the content area. */}
      <aside
        className={`w-[248px] fixed left-0 top-0 bottom-0 bg-card border-r border-border z-50 flex flex-col md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <Image
              src="/images/logosiamsite-h256.png"
              alt="SIAMSITE logo"
              width={60}
              height={40}
              className="h-7 w-auto object-contain"
            />
            <span className="font-semibold text-foreground text-sm tracking-tight">SIAMSITE</span>
          </Link>
          <button
            className="md:hidden w-9 h-9 -mr-1 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary cursor-pointer"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="ปิดเมนู"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {MENU_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h4 className="text-[12px] font-medium text-muted-foreground mb-1.5 px-3">
                {category.title}
              </h4>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const active = pathname === item.href;
                  const badgeCount = item.href === '/admin/support' ? unread.tickets : item.href === '/admin/payments' ? unread.slips : 0;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between gap-2 pl-3 pr-2.5 py-2 rounded-md border-l-2 cursor-pointer ${
                        active
                          ? 'border-primary bg-primary/8 text-primary font-medium'
                          : 'border-transparent text-secondary-foreground hover:bg-secondary'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon size={16} className={active ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'} />
                        <span className="text-[14px] truncate">{item.label}</span>
                      </span>
                      {badgeCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
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

        <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${systemStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            aria-hidden="true"
          />
          <p className="text-[12px] text-muted-foreground">
            {systemStatus === 'online' ? 'ระบบทำงานปกติ' : 'กำลังตรวจสอบระบบ'}
          </p>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────── */}
      <div className="md:pl-[248px]">
        <header className="sticky top-0 z-30 h-14 bg-background border-b border-border flex items-center justify-between gap-3 px-3 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="md:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary cursor-pointer shrink-0"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="เปิดเมนู"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-[15px] font-semibold text-foreground truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleDark}
              aria-label={isDark ? 'ใช้ธีมสว่าง' : 'ใช้ธีมมืด'}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary cursor-pointer"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-lg border border-border hover:bg-secondary cursor-pointer"
              >
                <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-semibold text-[12px] shrink-0">
                  {user.displayName?.charAt(0).toUpperCase()}
                </span>
                <span className="text-[13px] font-medium text-foreground max-w-[110px] truncate hidden sm:block">
                  {user.displayName}
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-card border border-border rounded-lg shadow-lg z-50 py-1.5">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-[12px] text-muted-foreground">เข้าสู่ระบบเป็น</p>
                    <p className="text-[13px] font-medium text-foreground truncate">{user.email}</p>
                  </div>
                  <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 text-[14px] text-secondary-foreground hover:bg-secondary cursor-pointer">
                    <LayoutDashboard size={15} className="text-muted-foreground" />
                    กลับไปหน้าร้านค้า
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] font-medium text-destructive hover:bg-destructive/8 text-left cursor-pointer"
                  >
                    <LogOut size={15} />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-5 lg:p-6 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  );
}
