'use client';
import { useSettings } from '@/context/SettingsContext';
import { Box, Info, ExternalLink } from 'lucide-react';

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

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
              <Box className="w-3 h-3 text-white" strokeWidth={2.25} aria-hidden="true" />
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
          <p className="text-[11px] text-foreground-subtle text-center sm:text-left leading-relaxed inline-flex items-center gap-1">
            <Info className="w-3 h-3 opacity-60 flex-shrink-0" strokeWidth={2} />
            เราไม่มีส่วนเกี่ยวข้องกับ Mojang AB.
          </p>

          {/* SIAMSITE branding — hardcoded, non-editable, always visible */}
          <a
            href={SIAMSITESTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-muted hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 flex-shrink-0"
          >
            <FacebookIcon className="w-3.5 h-3.5 text-[#1877f2] flex-shrink-0" />
            <span className="text-[11px] font-bold text-foreground-subtle group-hover:text-primary transition-colors duration-200 whitespace-nowrap">
              Developed and Powered by{' '}
              <span className="text-foreground group-hover:text-primary font-black transition-colors duration-200">
                SIAMSITE
              </span>
            </span>
            <ExternalLink className="w-2.5 h-2.5 text-foreground-subtle/50 group-hover:text-primary/70 transition-colors duration-200 flex-shrink-0" strokeWidth={2.25} />
          </a>
        </div>

      </div>
    </footer>
  );
}
