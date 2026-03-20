'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
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
      // Sub-menu for Shop
      { 
        id: 'shop',
        icon: 'fa-store', 
        label: 'ระบบร้านค้า',
        subItems: [
          { href: '/admin/products', label: 'สินค้าปกติ' },
          { href: '/admin/lootboxes', label: 'กล่องสุ่ม' },
        ]
      },
      { href: '/admin/codes', icon: 'fa-ticket-alt', label: 'จัดการโค้ดไอเทม' },
    ]
  },
  {
    category: 'PAGE MANAGER',
    items: [
      { href: '/admin/settings', icon: 'fa-paint-roller', label: 'ตั้งค่าหน้าเว็บ' },
      { href: '/admin/slides', icon: 'fa-images', label: 'ตั้งค่าสไลด์' },
    ]
  },
  {
    category: 'SYSTEM',
    items: [
      { href: '/admin/purchases', icon: 'fa-wallet', label: 'ระบบเติมเงิน / ธุรกรรม' },
      { href: '/admin/servers', icon: 'fa-server', label: 'จัดการเซิร์ฟเวอร์' },
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
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    // Force dark mode context inside the sidebar but light inside the main wrapper visually,
    // though the best approach here is just to hardcode colors for Verity theme.
    // Verity features: #131416 sidebar, #f97316 accent, #f3f4f6 bg.
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
        <i className="fas fa-spinner fa-spin text-3xl text-[#f97316]"></i>
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
          <Link href="/" className="px-6 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold rounded-xl transition-colors">
            <i className="fas fa-home mr-2"></i> กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  // Verity Color Palette References:
  // Sidebar: #18191c / #131416
  // Orange: #ea580c / #f97316

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex text-gray-800 font-sans selection:bg-[#f97316] selection:text-white">
      {/* Sidebar (Dark) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#18191c] transform transition-transform duration-300 lg:translate-x-0 lg:relative ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl lg:shadow-none`}>
        {/* Logo Area */}
        <div className="h-[72px] flex items-center px-6 border-b border-gray-800 flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black flex flex-col items-center justify-center font-black rounded-lg text-xs leading-none">
              <span className="mb-[1px]">V</span>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-white text-lg tracking-wide leading-none">VERITY</span>
              <span className="text-[10px] font-bold text-[#f97316] tracking-[0.2em] mt-1 -mr-1">ADMIN PANEL</span>
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
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                            hasActiveChild ? 'text-[#f97316]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <i className={`fas ${item.icon} w-5 text-center`}></i>
                            {item.label}
                          </div>
                          <i className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></i>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-black/20 rounded-xl mt-1 space-y-0.5 relative"
                            >
                              <div className="absolute left-[22px] top-0 bottom-0 w-[1px] bg-gray-800"></div>
                              {item.subItems.map((sub: any, k: number) => {
                                const active = pathname === sub.href;
                                return (
                                  <li key={k}>
                                    <Link
                                      href={sub.href}
                                      onClick={() => setSidebarOpen(false)}
                                      className={`block py-2.5 pl-12 pr-4 text-sm font-medium transition-colors relative ${
                                        active ? 'text-[#f97316]' : 'text-gray-400 hover:text-white'
                                      }`}
                                    >
                                      {active && (
                                        <div className="absolute left-[21px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-[#f97316]"></div>
                                      )}
                                      {sub.label}
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
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium relative overflow-hidden group ${
                          active
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {active && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#f97316] rounded-r-md"></div>
                        )}
                        {active && (
                          <div className="absolute inset-0 bg-gradient-to-r from-[#f97316]/20 to-transparent"></div>
                        )}
                        <i className={`fas ${item.icon} w-5 text-center ${active ? 'text-[#f97316]' : 'group-hover:text-white'}`}></i>
                        <span className="relative z-10">{item.label}</span>
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
          <Link href="/" className="flex items-center gap-3 text-gray-400 hover:text-white mb-4 text-sm font-medium transition-colors p-2 -mx-2 rounded-lg hover:bg-white/5">
            <i className="fas fa-arrow-left"></i> กลับหน้าเว็บไซต์
          </Link>
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
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-[#18191c] flex items-center justify-center text-white">
                <i className="fas fa-user-shield text-xs"></i>
              </div>
              <div className="pr-1 flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">{user.username}</span>
                <i className="fas fa-chevron-down text-[10px] text-gray-400 group-hover:text-gray-600 transition-colors"></i>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors border border-red-100"
              title="ออกจากระบบ"
            >
              <i className="fas fa-power-off"></i>
            </button>
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
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AuthProvider>
  );
}
