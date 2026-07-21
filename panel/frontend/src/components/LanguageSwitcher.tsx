'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { FlagTH, FlagEN } from '@/components/ui/flags';
import { localeOf, localePath, hasDirectCounterpart, type Locale } from '@/lib/seo/locale-path';

const LOCALES: { code: Locale; label: string; Flag: typeof FlagTH }[] = [
  { code: 'th', label: 'ไทย', Flag: FlagTH },
  { code: 'en', label: 'English', Flag: FlagEN },
];

/**
 * Language switcher for the navbar.
 *
 * Navigates with the router rather than rendering <a> tags, because the
 * destination is computed per path and we do not want crawlers treating these
 * as translation links (only the two homepages are a real hreflang pair).
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = localeOf(pathname);
  const ActiveFlag = active === 'en' ? FlagEN : FlagTH;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const choose = (code: Locale) => {
    setOpen(false);
    if (code === active) return;
    router.push(localePath(pathname, code));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={active === 'th' ? 'เปลี่ยนภาษา' : 'Change language'}
        className={`flex items-center gap-2 rounded-full border border-border hover:bg-secondary transition-colors cursor-pointer ${
          compact ? 'px-2 py-1' : 'pl-2 pr-2.5 py-1'
        }`}
      >
        <ActiveFlag className="w-[18px] h-[12px] rounded-[2px] shrink-0 ring-1 ring-black/10" />
        {!compact && (
          <span className="text-[13px] font-medium text-foreground uppercase tracking-wide">{active}</span>
        )}
        <Icon
          name="chevron-down"
          className={`text-[10px] text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 bg-card text-card-foreground border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[110]"
        >
          {LOCALES.map(({ code, label, Flag }) => {
            const isActive = code === active;
            // Untranslated areas (dashboard, order, legal) still switch, but the
            // menu says the destination is the home page instead of implying
            // this page exists in the other language.
            const direct = isActive || hasDirectCounterpart(pathname, code);
            return (
              <button
                key={code}
                role="menuitem"
                onClick={() => choose(code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left cursor-pointer ${
                  isActive ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
                }`}
              >
                <Flag className="w-[20px] h-[13px] rounded-[2px] shrink-0 ring-1 ring-black/10" />
                <span className="flex-1">{label}</span>
                {isActive ? (
                  <Icon name="circle-check" className="text-[12px]" />
                ) : (
                  !direct && (
                    <span className="text-[11px] text-muted-foreground">
                      {code === 'en' ? 'home' : 'หน้าแรก'}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
