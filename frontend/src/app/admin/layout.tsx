'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const MENU = [
  { href: '/admin', icon: 'fa-chart-line', label: 'Dashboard' },
  { href: '/admin/products', icon: 'fa-cube', label: 'สินค้า' },
  { href: '/admin/lootboxes', icon: 'fa-box-open', label: 'กล่องสุ่ม' },
  { href: '/admin/servers', icon: 'fa-server', label: 'เซิร์ฟเวอร์' },
  { href: '/admin/users', icon: 'fa-users', label: 'ผู้ใช้' },
  { href: '/admin/purchases', icon: 'fa-receipt', label: 'ธุรกรรม' },
  { href: '/admin/slides', icon: 'fa-images', label: 'สไลด์' },
  { href: '/admin/settings', icon: 'fa-gear', label: 'ตั้งค่า' },
  { href: '/admin/setup', icon: 'fa-wand-magic-sparkles', label: 'Setup Wizard' },
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <i className="fas fa-spinner fa-spin text-3xl text-brand-500"></i>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-error-50 dark:bg-error-500/10 rounded-2xl flex items-center justify-center">
            <i className="fas fa-shield-halved text-2xl text-error-500"></i>
          </div>
          <h2 className="text-xl font-bold mb-2 dark:text-white">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">คุณต้องเป็น Admin เพื่อเข้าหน้านี้</p>
          <Link href="/" className="btn-primary">
            <i className="fas fa-home"></i> กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-300 lg:translate-x-0 lg:relative ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Link href="/admin" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-theme-sm group-hover:shadow-theme-md transition-all">
                <i className="fas fa-shield-halved text-white text-sm"></i>
              </div>
              <div>
                <span className="font-bold dark:text-white">Admin Panel</span>
                <p className="text-xs text-gray-400 dark:text-gray-500">SiamWorld Shop</p>
              </div>
            </Link>
          </div>

          {/* Nav Menu */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {MENU.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <i className={`fas ${item.icon} w-5 text-center ${active ? 'text-brand-500' : 'text-gray-400 dark:text-gray-500'}`}></i>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
              <i className="fas fa-home w-5 text-center text-gray-400"></i> กลับหน้าเว็บ
            </Link>
            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-600 dark:hover:text-error-400 transition-colors">
              <i className="fas fa-right-from-bracket w-5 text-center"></i> ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Admin Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center justify-between px-4 h-16">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <i className="fas fa-bars"></i>
            </button>
            <div className="flex items-center gap-3 ml-auto">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              >
                {theme === 'light' ? (
                  <i className="fas fa-moon text-sm"></i>
                ) : (
                  <i className="fas fa-sun text-sm text-warning-400"></i>
                )}
              </button>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center">
                  <i className="fas fa-user text-xs text-brand-500"></i>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.username}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
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
