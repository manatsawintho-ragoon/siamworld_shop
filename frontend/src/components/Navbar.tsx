'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useTheme } from '@/context/ThemeContext';
import LoginModal from './LoginModal';

export default function Navbar() {
  const { user, logout, isAdmin, loading } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shopName = settings.shop_name || 'SiamWorld';

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 dark:bg-gray-900/80 dark:border-gray-700/60 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center shadow-theme-sm group-hover:shadow-theme-md transition-all duration-200">
                <i className="fas fa-cube text-white text-sm"></i>
              </div>
              <span className="text-lg font-bold hidden sm:block dark:text-white">{shopName}</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              <NavLink href="/">หน้าแรก</NavLink>
              <NavLink href="/shop">ร้านค้า</NavLink>
              <NavLink href="/lootbox">
                <i className="fas fa-box-open mr-1 text-warning-500"></i>กล่องสุ่ม
              </NavLink>
              {user && <NavLink href="/topup">เติมเงิน</NavLink>}
              {user && <NavLink href="/inventory">คลัง</NavLink>}
              {isAdmin && <NavLink href="/admin">จัดการ</NavLink>}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-all duration-200"
                title={theme === 'light' ? 'เปลี่ยนเป็น Dark Mode' : 'เปลี่ยนเป็น Light Mode'}
              >
                {theme === 'light' ? (
                  <i className="fas fa-moon text-sm"></i>
                ) : (
                  <i className="fas fa-sun text-sm text-warning-400"></i>
                )}
              </button>

              {loading ? (
                <div className="w-24 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ) : user ? (
                <div className="flex items-center gap-2">
                  <Link href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-sm transition-colors duration-200">
                    <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center">
                      <i className="fas fa-user text-xs text-brand-500"></i>
                    </div>
                    <span className="hidden sm:inline font-medium dark:text-gray-200">{user.username}</span>
                    <span className="font-bold text-success-600 dark:text-success-400">{user.wallet_balance?.toLocaleString()} ฿</span>
                  </Link>
                  <button onClick={logout} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-all duration-200" title="ออกจากระบบ">
                    <i className="fas fa-right-from-bracket text-sm"></i>
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowLogin(true)} className="btn-primary text-sm">
                  <i className="fas fa-sign-in-alt"></i> เข้าสู่ระบบ
                </button>
              )}

              {/* Mobile toggle */}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileOpen && (
            <div className="md:hidden pb-4 border-t border-gray-100 dark:border-gray-700/50 mt-1 pt-3 space-y-1">
              <MobileLink href="/" onClick={() => setMobileOpen(false)}>หน้าแรก</MobileLink>
              <MobileLink href="/shop" onClick={() => setMobileOpen(false)}>ร้านค้า</MobileLink>
              <MobileLink href="/lootbox" onClick={() => setMobileOpen(false)}>
                <i className="fas fa-box-open mr-1 text-warning-500"></i>กล่องสุ่ม
              </MobileLink>
              {user && <MobileLink href="/topup" onClick={() => setMobileOpen(false)}>เติมเงิน</MobileLink>}
              {user && <MobileLink href="/inventory" onClick={() => setMobileOpen(false)}>คลัง</MobileLink>}
              {user && <MobileLink href="/profile" onClick={() => setMobileOpen(false)}>โปรไฟล์</MobileLink>}
              {isAdmin && <MobileLink href="/admin" onClick={() => setMobileOpen(false)}>จัดการ</MobileLink>}
            </div>
          )}
        </div>
      </nav>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-brand-600 hover:bg-brand-50 dark:text-gray-300 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-all duration-200">
      {children}
    </Link>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors">
      {children}
    </Link>
  );
}
