'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AdminAlertProvider } from '@/components/AdminAlert';
import { motion, AnimatePresence } from 'framer-motion';

// Menu Categorization (Verity Style)
const MENU_CATEGORIES = [
  {
    category: null,
    items: [
      { href: '/admin', icon: 'fa-chart-pie', label: 'แดชบอร์ด' },
    ]
  },
  {
    category: 'MANAGEMENT',
    items: [
      { href: '/admin/users', icon: 'fa-users', label: 'ระบบจัดการสมาชิก' },
      { href: '/admin/codes', icon: 'fa-ticket-alt', label: 'จัดการโค้ดไอเท็ม' },
      {
        id: 'shop',
        icon: 'fa-store',
        label: 'ระบบร้านค้า',
        subItems: [
          { href: '/admin/products', icon: 'fa-box-open', label: 'สินค้าปกติ', desc: 'ไอเท็ม / สิทธิ์' },
          { href: '/admin/lootboxes', icon: 'fa-dice', label: 'กล่องสุ่ม', desc: 'Gacha / กล่องสุ่ม' },
        ]
      },
    ]
  },
  {
    category: 'PAGE MANAGER',
    items: [
      { href: '/admin/settings', icon: 'fa-paint-roller', label: 'ตั้งค่าหน้าเว็บไซต์' },
    ]
  },
  {
    category: 'SYSTEM',
    items: [
      { href: '/admin/servers', icon: 'fa-server', label: 'จัดการเซิร์ฟเวอร์' },
      { href: '/admin/purchases', icon: 'fa-wallet', label: 'Audit log' },
      { href: '/admin/setup', icon: 'fa-wand-magic-sparkles', label: 'Setup Wizard' },
    ]
  }
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    'shop': pathname.includes('/admin/products') || pathname.includes('/admin/lootboxes')
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    // Force dark mode context inside the sidebar but light inside the main wrapper visually,
    // though the best approach here is just to hardcode colors for Verity theme.
    // Verity features: #131416 sidebar, #22c55e accent, #f3f4f6 bg.
    // Date timer
    const updateTime = () => {
      setTime(new Date().toLocaleString('th-TH', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSubMenu = (id: string) => {
    setOpenSubMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <i className="fas fa-spinner fa-spin text-3xl text-[#22c55e]"></i>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-shield-halved text-2xl text-red-600"></i>
          </div>
          <h2 className="text-xl font-bold mb-2 text-gray-900">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-500 mb-6">คุณต้องเป็น Admin เพื่อเข้าหน้านี้</p>
          <Link href="/" className="px-6 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold rounded-xl transition-colors">
            <i className="fas fa-home mr-2"></i> กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  // Verity Color Palette References:
  // Sidebar: #18191c / #131416
  // Orange: #16a34a / #22c55e

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex text-gray-800 font-sans selection:bg-[#22c55e] selection:text-white">
      {/* Sidebar (Dark) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#18191c] transform transition-transform duration-300 lg:translate-x-0 lg:relative ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl lg:shadow-none`}>
        {/* Logo Area */}
        <div className="h-[72px] flex items-center px-6 border-b border-gray-800 flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-black text-white text-lg tracking-wide leading-none">SIAMWORLD</span>
              <span className="text-[10px] font-bold text-[#22c55e] tracking-[0.2em] mt-1 -mr-1">ADMIN PANEL</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 custom-scrollbar-dark">
          {MENU_CATEGORIES.map((cat, i) => (
            <div key={i}>
              {cat.category && (
                <h4 className="px-4 text-[10px] font-bold text-gray-500 mb-2 tracking-wider">
                  {cat.category}
                </h4>
              )}
              <ul className="space-y-1">
                {cat.items.map((item: any, j) => {
                  if (item.subItems) {
                    const isOpen = openSubMenus[item.id];
                    const hasActiveChild = item.subItems.some((sub: any) => pathname === sub.href);

                    return (
                      <li key={j}>
                        <button
                          onClick={() => toggleSubMenu(item.id)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                            hasActiveChild
                              ? 'bg-[#16a34a]/15 text-[#22c55e]'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <i className={`fas ${item.icon} w-5 text-center text-[13px]`}></i>
                            <span>{item.label}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${
                            isOpen ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-white/5 text-gray-500'
                          }`}>
                            <i className={`fas fa-chevron-down text-[9px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
                          </div>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden mt-1 px-2 space-y-1 pb-1.5"
                            >
                              {item.subItems.map((sub: any, k: number) => {
                                const active = pathname === sub.href;
                                return (
                                  <li key={k}>
                                    <Link
                                      href={sub.href}
                                      onClick={() => setSidebarOpen(false)}
                                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                                        active
                                          ? 'bg-[#16a34a] shadow-[0_4px_0_#0d6b2e,0_2px_8px_rgba(22,163,74,0.35)]'
                                          : 'hover:bg-white/5'
                                      }`}
                                    >
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                        active ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                                      }`}>
                                        <i className={`fas ${sub.icon} text-xs ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}></i>
                                      </div>
                                      <div className="min-w-0">
                                        <p className={`text-[13px] font-bold leading-tight ${active ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{sub.label}</p>
                                        <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-white/70' : 'text-gray-600 group-hover:text-gray-400'}`}>{sub.desc}</p>
                                      </div>
                                      {active && <i className="fas fa-check text-[10px] text-white/80 ml-auto flex-shrink-0"></i>}
                                    </Link>
                                  </li>
                                );
                              })}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  }

                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                          active
                            ? 'bg-[#16a34a] text-white shadow-[0_4px_0_#0d6b2e,0_2px_8px_rgba(22,163,74,0.35)]'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <i className={`fas ${item.icon} w-5 text-center ${active ? 'text-white' : ''}`}></i>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-5 border-t border-gray-800">
          <p className="text-[10px] text-gray-600 text-center">SIAMWORLD ADMIN PANEL</p>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content Wrap */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header (White) */}
        <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-900 transition-colors"
            >
              <i className="fas fa-bars text-xl"></i>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-gray-500 bg-gray-50 px-4 py-2 rounded-full border border-gray-100 shadow-sm">
              <i className="far fa-clock"></i>
              {time || '...'}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-3 px-2 py-1.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#18191c] flex items-center justify-center shrink-0">
                  <img
                    src={`https://mc-heads.net/avatar/${user.username}/32`}
                    alt={user.username}
                    width={32}
                    height={32}
                    className="w-full h-full"
                    style={{ imageRendering: 'pixelated' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <i className="fas fa-user-shield text-xs text-white hidden" style={{ display: 'none' }}></i>
                </div>
                <div className="pr-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{user.username}</span>
                  <i className={`fas fa-chevron-down text-[10px] text-gray-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}></i>
                </div>
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden z-50"
                    >
                      {/* User info card */}
                      <div className="px-4 pt-4 pb-3">
                        {/* Avatar + name */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative shrink-0">
                            {/* Minecraft skin head */}
                            <img
                              src={`https://mc-heads.net/avatar/${user.username}/40`}
                              alt={user.username}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg"
                              style={{ imageRendering: 'pixelated' }}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                              }}
                            />
                            {/* Fallback icon */}
                            <div className="w-10 h-10 rounded-lg bg-[#18191c] items-center justify-center text-white hidden" style={{ display: 'none' }}>
                              <i className="fas fa-user-shield text-sm"></i>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{user.username}</p>
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white uppercase tracking-wide shadow-[0_2px_0_#c2410c]">
                              <i className="fas fa-star text-[8px]"></i>
                              {user.role}
                            </span>
                          </div>
                        </div>
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">User ID</p>
                            <p className="text-sm font-bold text-gray-800">#{user.id}</p>
                          </div>
                          <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">ยอดเงิน</p>
                            <p className="text-sm font-bold text-gray-800">
                              {user.wallet_balance?.toLocaleString('th-TH') ?? '0'}
                              <span className="text-[10px] font-normal text-gray-400 ml-1">฿</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-gray-100" />

                      <Link
                        href="/"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-150"
                      >
                        <i className="fas fa-arrow-left w-4 text-center text-gray-400"></i>
                        <span className="font-medium">กลับหน้าเว็บไซต์</span>
                      </Link>
                      <div className="h-px bg-gray-100 mx-3" />
                      <button
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors duration-150"
                      >
                        <i className="fas fa-power-off w-4 text-center"></i>
                        <span className="font-medium">ออกจากระบบ</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminAlertProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </AdminAlertProvider>
    </AuthProvider>
  );
}


