'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuthModal } from '@/components/AuthModal';
import {
  Home, ShoppingCart, PackageOpen, Coins, Download,
  User, LogIn, LogOut, Gift, Newspaper, Ticket, Shield, Wallet,
  MoreHorizontal, X, type LucideIcon,
} from 'lucide-react';

interface NavItem {
  href?: string;
  onClick?: () => void;
  Icon: LucideIcon;
  label: string;
  match?: string;
}

export default function Navbar() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { open: openAuth } = useAuthModal();
  const [isScrolled, setIsScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const shopName     = settings.shop_name    || 'Siamsite';
  const shopSubtitle = settings.shop_subtitle || 'ระบบร้านค้ามายคราฟ';
  const bannerUrl    = settings.website_bg_url;
  const logoUrl      = settings.website_logo_url;
  // Default to shown ('1') so existing installs aren't surprised after the upgrade.
  const showLootbox  = (settings.show_lootbox_nav  ?? '1') === '1';
  const showDownload = (settings.show_download_nav ?? '1') === '1';
  const showRewards  = (settings.show_rewards_nav  ?? '1') === '1';
  const showNews     = (settings.show_news_nav     ?? '1') === '1';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the sheet on navigation so a tapped link never leaves it hanging open.
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  /**
   * Bottom bar: commerce paths first, "More" always last, five slots max
   * (any more and the targets get too narrow to hit reliably). Everything that
   * doesn't fit lives in the sheet - nothing is unreachable on a phone.
   */
  const bottomItems: NavItem[] = [
    { href: '/',      Icon: Home,         label: 'หน้าแรก', match: '/' },
    { href: '/shop',  Icon: ShoppingCart, label: 'ร้านค้า' },
    ...(showLootbox ? [{ href: '/lootbox', Icon: PackageOpen, label: 'กล่องสุ่ม' }] : []),
    { href: '/topup', Icon: Coins,        label: 'เติมเงิน' },
  ];
  // A freed slot (shop running without gacha) goes to the account shortcut
  // rather than leaving a gap.
  if (bottomItems.length < 4) {
    bottomItems.push(user
      ? { href: '/profile', Icon: User,  label: 'โปรไฟล์' }
      : { onClick: openAuth, Icon: LogIn, label: 'ล็อกอิน' });
  }

  return (
    <header className="relative w-full z-40">
      {/* Branding Banner — uses theme CSS vars.
          Kept deliberately short on phones: this block repeats on every page,
          and a 200px logo pushes the actual content below the fold. */}
      <div className="relative theme-navbar-banner overflow-hidden">
        {bannerUrl && (
          <>
            {/* Owner-supplied artwork from whatever host they used, and on most
                shops it is the page's LCP element. next/image serves it from our
                own origin (so the source host's cookies never touch the page)
                at the size actually displayed, and `priority` emits the preload
                link. Animated GIFs are passed through untouched by the
                optimizer, so a shop that picked one keeps the animation. */}
            <Image
              src={bannerUrl}
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-black/70" />
          </>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-10">
          <div className="flex flex-col items-center justify-center">
            {/* Center: Big Logo or Text */}
            <Link href="/" className="group relative flex flex-col items-center max-w-full">
              {logoUrl ? (
                <div className="logo-float transition-all duration-500 transform group-hover:scale-110">
                  {/* Intrinsic size is unknown (owner upload), so width/height
                      are the layout box and `object-contain` letterboxes inside
                      it. h-56 at 2x is the largest it is ever painted. */}
                  <Image
                    src={logoUrl}
                    alt={shopName}
                    width={448}
                    height={224}
                    priority
                    className="h-20 xs:h-24 sm:h-32 md:h-44 lg:h-56 w-auto object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                  />
                </div>
              ) : (
                <div className="logo-float flex flex-col items-center transition-all duration-300">
                  <div className="text-3xl xs:text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.6)] text-center break-words max-w-full">
                    {shopName}
                  </div>
                  <div className="text-[11px] xs:text-xs sm:text-base lg:text-lg font-bold mt-1.5 sm:mt-2 tracking-[0.2em] sm:tracking-[0.3em] uppercase text-center w-full"
                    style={{ color: 'rgb(var(--color-primary-light))' }}>{shopSubtitle}</div>
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop Navigation Bar — sticky. Hidden on mobile (bottom nav takes over). */}
      <div ref={navRef}
        className={`hidden md:block w-full relative sticky top-0 z-50 transition-shadow duration-300 ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}
        style={{ background: 'rgb(var(--color-surface))', borderBottom: '1px solid rgb(var(--color-border))' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Wraps rather than overflowing once a shop enables every optional tab
              and the window is only tablet-wide. */}
          <nav className="flex items-center w-full justify-center flex-wrap">
            <NavLink href="/"         Icon={Home}          label="Home"      subLabel="หน้าแรก"       pathname={pathname} />
            <NavLink href="/shop"     Icon={ShoppingCart}  label="Itemshop"  subLabel="ร้านค้าไอเท็ม" pathname={pathname} />
            {showLootbox  && <NavLink href="/lootbox"  Icon={PackageOpen} label="Gacha"     subLabel="กล่องสุ่ม"     pathname={pathname} />}
            {showRewards  && <NavLink href="/rewards"  Icon={Gift}        label="Rewards"   subLabel="แลกของรางวัล"  pathname={pathname} />}
            <NavLink href="/topup"    Icon={Coins}         label="Topup"     subLabel="เติมเงิน"       pathname={pathname} />
            {showNews     && <NavLink href="/news"     Icon={Newspaper}   label="News"      subLabel="ข่าวสาร"        pathname={pathname} />}
            {showDownload && <NavLink href="/download" Icon={Download}     label="Download"  subLabel="ดาวน์โหลด"     pathname={pathname} />}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar — thumb-reachable primary nav */}
      <nav aria-label="เมนูหลัก"
        className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-surface/95 backdrop-blur-md border-t border-border px-1 pt-1.5 pb-safe px-safe flex items-stretch justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {bottomItems.map(item => (
          <MobileBottomLink
            key={item.label}
            href={item.href}
            onClick={item.onClick}
            Icon={item.Icon}
            label={item.label}
            active={item.href
              ? (item.match === '/' ? pathname === '/' : pathname.startsWith(item.href))
              : false}
          />
        ))}
        <MobileBottomLink
          onClick={() => setMoreOpen(true)}
          Icon={MoreHorizontal}
          label="เพิ่มเติม"
          active={moreOpen}
          expanded={moreOpen}
        />
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
        showLootbox={showLootbox}
        showRewards={showRewards}
        showNews={showNews}
        showDownload={showDownload}
      />
    </header>
  );
}

/* ── Mobile "More" sheet ──────────────────────────────────────────────
   Everything the five-slot bottom bar can't hold. Without this, Rewards,
   News, Download, Redeem and Inventory have no entry point at all on a
   phone - the desktop nav that used to carry them is `hidden md:block`. */
function MoreSheet({ open, onClose, pathname, showLootbox, showRewards, showNews, showDownload }: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  showLootbox: boolean;
  showRewards: boolean;
  showNews: boolean;
  showDownload: boolean;
}) {
  const { user, logout, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { open: openAuth } = useAuthModal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Escape to dismiss + freeze the page behind the sheet so a scroll gesture
  // over the backdrop doesn't move the content underneath.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  // Redeem / inventory / profile bounce a signed-out visitor straight back to
  // the homepage with no explanation, so they are only offered once there is a
  // session. Signed-out users get the login button above instead.
  const tiles: { href: string; Icon: LucideIcon; label: string }[] = [
    ...(showLootbox  ? [{ href: '/lootbox',  Icon: PackageOpen, label: 'กล่องสุ่ม'    }] : []),
    ...(showRewards  ? [{ href: '/rewards',  Icon: Gift,        label: 'แลกของรางวัล' }] : []),
    ...(user ? [
      { href: '/redeem',    Icon: Ticket,      label: 'แลกโค้ด' },
      { href: '/inventory', Icon: PackageOpen, label: 'คลังของ' },
    ] : []),
    ...(showNews     ? [{ href: '/news',     Icon: Newspaper,   label: 'ข่าวสาร'   }] : []),
    ...(showDownload ? [{ href: '/download', Icon: Download,    label: 'ดาวน์โหลด' }] : []),
    ...(user ? [{ href: '/profile', Icon: User, label: 'โปรไฟล์' }] : []),
    ...(isAdmin ? [{ href: '/admin', Icon: Shield, label: 'จัดการร้าน' }] : []),
  ];

  const discordUrl  = settings.discord_invite || '';
  const facebookUrl = settings.facebook_url   || '';

  return createPortal(
    <div data-theme-portal="">
      {open && (
          <div
            className="md:hidden fixed inset-0 z-[110] flex flex-col justify-end overlay-in"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="เมนูเพิ่มเติม"
              className="relative frontend-page bg-surface rounded-t-3xl border-t border-border shadow-[0_-8px_40px_rgba(0,0,0,0.25)] max-h-[85dvh] flex flex-col sheet-in"
              onClick={e => e.stopPropagation()}
            >
              {/* Grab handle */}
              <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <div className="px-4 pb-2 flex items-center gap-3 flex-shrink-0">
                <p className="font-black text-foreground text-sm">เมนูเพิ่มเติม</p>
                <button onClick={onClose} aria-label="ปิดเมนู"
                  className="ml-auto tap-target -mr-2 rounded-xl flex items-center justify-center text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors">
                  <X className="w-5 h-5" strokeWidth={2.25} />
                </button>
              </div>

              {/* min-h-0 is what actually lets this scroll inside the flex
                  column once the tile grid outgrows the 85dvh cap. */}
              <div className="overflow-y-auto overscroll-contain min-h-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">

                {/* Account block — the sheet's headline, since the bottom bar
                    gives its account slot to a commerce tab. */}
                {user ? (
                  <Link href="/profile" onClick={onClose}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-surface-hover border border-border mb-3 active:scale-[0.99] transition-transform">
                    <img
                      src={`https://mc-heads.net/avatar/${user.username}/64`}
                      alt=""
                      className="w-11 h-11 rounded-xl border border-primary/25 flex-shrink-0"
                      style={{ imageRendering: 'pixelated' }}
                      onError={e => { (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/64'; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-foreground text-sm truncate leading-tight">{user.username}</p>
                      <p className="inline-flex items-center gap-1 text-[11px] font-bold text-primary mt-0.5">
                        <Wallet className="w-3 h-3" strokeWidth={2.5} />
                        {user.wallet_balance?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </p>
                    </div>
                  </Link>
                ) : (
                  <button
                    onClick={() => { onClose(); openAuth(); }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 mb-3 rounded-2xl bg-primary text-primary-foreground text-sm font-black shadow-[0_4px_0_rgb(var(--color-primary-shadow))] active:shadow-none active:translate-y-[4px] transition-all">
                    <LogIn className="w-4 h-4" strokeWidth={2.5} /> เข้าสู่ระบบ / สมัครสมาชิก
                  </button>
                )}

                {/* Destination grid — 3 columns keeps every tile well above the
                    44px minimum even on a 320px screen. */}
                <div className="grid grid-cols-3 gap-2">
                  {tiles.map(t => {
                    const active = pathname.startsWith(t.href);
                    return (
                      <Link key={t.label} href={t.href} onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border text-center transition-all active:scale-95 ${
                          active
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'bg-surface-hover border-border text-foreground-muted'
                        }`}>
                        <t.Icon className="w-5 h-5" strokeWidth={2} />
                        <span className="text-[11px] font-bold leading-none px-1">{t.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Social — same links as the floating desktop buttons, which
                    sit outside comfortable thumb reach on a phone. */}
                {(discordUrl || facebookUrl) && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {discordUrl && (
                      <a href={discordUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#5865F2] text-white text-xs font-bold active:scale-95 transition-transform">
                        Discord
                      </a>
                    )}
                    {facebookUrl && (
                      <a href={facebookUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1877F2] text-white text-xs font-bold active:scale-95 transition-transform">
                        Facebook
                      </a>
                    )}
                  </div>
                )}

                {user && (
                  <button onClick={() => { onClose(); logout(); }}
                    className="w-full flex items-center justify-center gap-2 py-3 mt-3 rounded-2xl bg-surface border border-border text-error text-sm font-bold active:scale-95 transition-transform">
                    <LogOut className="w-4 h-4" strokeWidth={2.25} /> ออกจากระบบ
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
    </div>,
    document.body,
  );
}

function MobileBottomLink({ href, onClick, Icon, label, active, expanded }: {
  href?: string; onClick?: () => void; Icon: LucideIcon; label: string; active: boolean; expanded?: boolean;
}) {
  const inner = (
    <>
      <div
        className="w-11 h-7 rounded-full flex items-center justify-center transition-all"
        style={active
          ? { backgroundColor: 'rgb(var(--color-primary))', color: 'rgb(var(--color-primary-foreground))', boxShadow: '0 2px 10px rgb(var(--color-primary) / 0.45), 0 1px 0 rgb(var(--color-primary-shadow) / 0.4)' }
          : { color: 'rgb(var(--color-foreground-muted))' }
        }
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.5 : 2} />
      </div>
      <span
        className="text-[10px] font-black tracking-wide leading-none"
        style={{ color: active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-foreground-muted))' }}
      >
        {label}
      </span>
    </>
  );
  // `flex-1 basis-0` makes the five slots share the bar evenly at any phone
  // width; min-h-[48px] keeps each one above the 44px touch minimum.
  const cls = 'flex flex-col items-center justify-center gap-1 flex-1 basis-0 min-w-0 min-h-[48px] py-1 rounded-xl transition-all active:scale-95';
  if (onClick) {
    return (
      <button onClick={onClick} className={cls} aria-label={label} aria-expanded={expanded}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href!} className={cls} aria-current={active ? 'page' : undefined}>
      {inner}
    </Link>
  );
}

function NavLink({ href, Icon, label, subLabel, pathname }: { href: string; Icon: LucideIcon; label: string; subLabel: string; pathname: string }) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`mc-nav-link flex flex-col items-center justify-center min-w-[104px] lg:min-w-[120px] group ${isActive ? 'active' : ''}`}
      style={isActive ? { backgroundColor: 'rgb(var(--color-primary) / 0.12)' } : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
        <span className="font-black text-[15px]">{label}</span>
      </div>
      <span className="text-[10px] font-bold opacity-80">{subLabel}</span>
    </Link>
  );
}
