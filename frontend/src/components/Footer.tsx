'use client';
import { useSettings } from '@/context/SettingsContext';

export default function Footer() {
  const { settings } = useSettings();
  const shopName = settings.shop_name || 'SiamWorld Shop';

  return (
    <footer className="bg-surface border-t border-border mt-auto transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-foreground-muted">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <i className="fas fa-cube text-white text-xs" aria-hidden="true"></i>
            </div>
            <span className="font-semibold text-foreground">{shopName}</span>
          </div>
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <a href="/shop" className="hover:text-primary transition-colors duration-200">ร้านค้า</a>
            <a href="/topup" className="hover:text-primary transition-colors duration-200">เติมเงิน</a>
            <a href="/redeem" className="hover:text-primary transition-colors duration-200">ใช้โค้ด</a>
            {settings.discord_invite && (
              <a
                href={settings.discord_invite}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors duration-200"
              >
                <i className="fab fa-discord mr-1" aria-hidden="true"></i>Discord
              </a>
            )}
          </nav>
          <span className="text-foreground-subtle text-xs">© {new Date().getFullYear()} {shopName}</span>
        </div>
      </div>
    </footer>
  );
}
