'use client';
import { useSettings } from '@/context/SettingsContext';

export default function Footer() {
  const { settings } = useSettings();
  const shopName = settings.shop_name || 'SiamWorld Shop';

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto dark:bg-gray-900 dark:border-gray-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-cube text-white text-xs"></i>
            </div>
            <span className="font-semibold text-gray-700 dark:text-gray-200">{shopName}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/shop" className="hover:text-brand-500 transition-colors duration-200">ร้านค้า</a>
            <a href="/topup" className="hover:text-brand-500 transition-colors duration-200">เติมเงิน</a>
            {settings.discord_invite && (
              <a href={settings.discord_invite} target="_blank" rel="noopener noreferrer" className="hover:text-brand-500 transition-colors duration-200">
                <i className="fab fa-discord mr-1"></i>Discord
              </a>
            )}
          </div>
          <span className="text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} {shopName}</span>
        </div>
      </div>
    </footer>
  );
}
