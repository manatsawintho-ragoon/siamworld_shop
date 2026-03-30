'use client';
import { useSettings } from '@/context/SettingsContext';

// HARDCODED — ห้ามย้ายออกจาก component นี้ และห้ามรับค่าจาก settings
const SIAMSITESTORE_URL = 'https://www.facebook.com/siamsitestore/';

export default function Footer() {
  const { settings } = useSettings();
  const shopName = settings.shop_name || 'SIAMSITE Shop';
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surface border-t border-border mt-auto transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Row 1 — Shop identity + copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-cube text-white text-[10px]" aria-hidden="true" />
            </div>
            <span className="font-bold text-foreground text-sm">{shopName}</span>
          </div>
          <span className="text-xs text-foreground-subtle">
            © {year} {shopName} · All rights reserved.
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-border-muted my-4" />

        {/* Row 2 — Disclaimer + Branding */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

          {/* Mojang disclaimer — hardcoded, non-editable */}
          <p className="text-[11px] text-foreground-subtle text-center sm:text-left leading-relaxed">
            <i className="fas fa-circle-info mr-1 opacity-60" />
            เราไม่มีส่วนเกี่ยวข้องกับ Mojang AB.
          </p>

          {/* SIAMSITE branding — hardcoded, non-editable, always visible */}
          <a
            href={SIAMSITESTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-muted hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 flex-shrink-0"
          >
            <i className="fab fa-facebook text-[#1877f2] text-xs flex-shrink-0" />
            <span className="text-[11px] font-bold text-foreground-subtle group-hover:text-primary transition-colors duration-200 whitespace-nowrap">
              Developed and Powered by{' '}
              <span className="text-foreground group-hover:text-primary font-black transition-colors duration-200">
                SIAMSITE
              </span>
            </span>
            <i className="fas fa-arrow-up-right-from-square text-[9px] text-foreground-subtle/50 group-hover:text-primary/70 transition-colors duration-200" />
          </a>
        </div>

      </div>
    </footer>
  );
}
