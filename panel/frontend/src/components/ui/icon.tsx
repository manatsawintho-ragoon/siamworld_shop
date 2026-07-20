/**
 * Central SVG icon system for the panel.
 *
 * One source of truth so the whole app shares a single icon language
 * (lucide line icons + a few inline brand marks). Replaces the old
 * Font Awesome CDN webfont.
 *
 * Icons render at `size="1em"` by default, so existing Tailwind text-size
 * (`text-xl`) and text-color (`text-primary`) classes keep controlling the
 * glyph exactly like the old `<i className="fas fa-…">` tags did.
 *
 * Usage:
 *   <Icon name="rocket" className="text-primary text-xl" />
 *   <Icon name="spinner" className="animate-spin" />
 *   <Icon name={open ? 'eye-slash' : 'eye'} />
 */
import { forwardRef, type SVGProps } from 'react';
import {
  LoaderCircle, Check, CheckCheck, CircleCheck, ClipboardCheck, FileCheck, ShieldCheck,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowLeftRight, ExternalLink,
  ChevronRight, ChevronLeft, ChevronDown,
  Info, TriangleAlert, CircleAlert, CircleQuestionMark, CircleX, CircleDot,
  Shield, ShieldX, UserCog, Lock, Key, IdCard, X, RotateCw, History,
  User, Users, UserPen, LogOut,
  Wallet, Coins, CircleDollarSign, ShoppingCart, Receipt, Tag, Ticket, Gift,
  Store, Server, Cpu, Terminal, GitBranch, Plug, Cloud, CloudUpload, Signal, House,
  Gauge, Zap, Box, Boxes, Layers,
  Eye, EyeOff, Copy, Trash2, Pen, Plus, CirclePlus, Minus, Search, ZoomIn,
  Funnel, List, SlidersHorizontal, Download, Save, FolderOpen, Archive, Link2, Menu, Type,
  Image as ImageIcon, FileText, Send, Pointer, WandSparkles, Sparkles, Wrench, Settings,
  Mail, MailOpen, Calendar, CalendarDays, Clock, Bell, Flame, Heart, Ghost, Inbox, Lightbulb,
  Target, Megaphone, MessagesSquare, Headset, Phone, Globe, Dices, ChartArea, Circle,
  Ban, CircleStop, Play, CirclePause, Sun, Moon, Rocket, PackageOpen, QrCode,
  GraduationCap, Gem, Crown, Trophy, Swords,
  type LucideIcon,
} from 'lucide-react';

type IconComponent = LucideIcon | ((props: SVGProps<SVGSVGElement>) => JSX.Element);

/* ── Brand marks (monochrome, follow currentColor) ───────────────────────── */
const Discord = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...p}>
    <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028M8.02 15.331c-1.183 0-2.157-1.086-2.157-2.42s.955-2.42 2.157-2.42c1.21 0 2.176 1.096 2.157 2.42 0 1.334-.955 2.42-2.157 2.42m7.975 0c-1.183 0-2.157-1.086-2.157-2.42s.955-2.42 2.157-2.42c1.21 0 2.176 1.096 2.157 2.42 0 1.334-.946 2.42-2.157 2.42" />
  </svg>
);
const Facebook = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...p}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073" />
  </svg>
);
const Windows = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...p}>
    <path d="M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
);
const Linux = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" width="1em" height="1em" {...p}>
    <path d="M12 1c-2.2 0-4 1.8-4 4 0 1 .3 1.7.3 2.4-.5 1.3-1.6 2.4-2.3 3.6-.8 1.4-1.5 2.9-1.5 4.5 0 .5.1 1 .3 1.4-.3.3-.6.6-.9.8-.4.3-.9.5-1 1 .1.5.6.7 1.1.8.9.2 1.8.1 2.6.5.9.4 1.8.6 2.6.4.3-.1.6-.3.8-.5.4.1.9.1 1.4.1s1 0 1.4-.1c.2.2.5.4.8.5.8.2 1.7 0 2.6-.4.8-.4 1.7-.3 2.6-.5.5-.1 1-.3 1.1-.8-.1-.5-.6-.7-1-1-.3-.2-.6-.5-.9-.8.2-.4.3-.9.3-1.4 0-1.6-.7-3.1-1.5-4.5-.7-1.2-1.8-2.3-2.3-3.6 0-.7.3-1.4.3-2.4 0-2.2-1.8-4-4-4Zm-1.6 4.2c.5 0 .9.5.9 1.1s-.4 1.1-.9 1.1-.9-.5-.9-1.1.4-1.1.9-1.1Zm3.2 0c.5 0 .9.5.9 1.1s-.4 1.1-.9 1.1-.9-.5-.9-1.1.4-1.1.9-1.1Zm-1.6 2.6c.7 0 1.6.5 1.6 1 0 .3-.7.6-1.6.6s-1.6-.3-1.6-.6c0-.5.9-1 1.6-1Z" />
  </svg>
);
const Google = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...p}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

/* ── Name → component map. Keys mirror Font Awesome suffixes so migration is 1:1. ── */
export const ICONS = {
  // loaders
  'spinner': LoaderCircle, 'circle-notch': LoaderCircle,
  // checks
  'check': Check, 'check-double': CheckCheck, 'circle-check': CircleCheck,
  'check-circle': CircleCheck, 'clipboard-check': ClipboardCheck,
  'file-circle-check': FileCheck, 'shield-check': ShieldCheck,
  // arrows / chevrons
  'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-up': ArrowUp, 'arrow-down': ArrowDown,
  'arrow-right-arrow-left': ArrowLeftRight, 'arrow-up-right-from-square': ExternalLink,
  'external-link-alt': ExternalLink, 'chevron-right': ChevronRight, 'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown, 'angle-right': ChevronRight,
  // info / alerts
  'circle-info': Info, 'info-circle': Info, 'triangle-exclamation': TriangleAlert,
  'circle-exclamation': CircleAlert, 'circle-question': CircleQuestionMark, 'question': CircleQuestionMark,
  'circle-xmark': CircleX, 'circle-1': CircleDot, 'circle': Circle,
  // security
  'shield-halved': Shield, 'shield-xmark': ShieldX, 'shield-keyhole': Shield, 'user-shield': UserCog,
  'lock': Lock, 'key': Key, 'id-card': IdCard,
  // close / rotate
  'times': X, 'xmark': X, 'arrows-rotate': RotateCw, 'rotate': RotateCw, 'rotate-right': RotateCw,
  'clock-rotate-left': History,
  // users
  'user': User, 'users': Users, 'user-group': Users, 'users-line': Users, 'users-viewfinder': Users,
  'user-gear': UserCog, 'user-pen': UserPen, 'sign-out-alt': LogOut,
  // money / commerce
  'wallet': Wallet, 'coins': Coins, 'sack-dollar': CircleDollarSign, 'shopping-cart': ShoppingCart,
  'receipt': Receipt, 'tag': Tag, 'ticket': Ticket, 'ticket-alt': Ticket, 'gift': Gift,
  'store': Store, 'store-slash': Store, 'store-medical': Store, 'shop': Store,
  // infra / tech
  'server': Server, 'microchip': Cpu, 'terminal': Terminal, 'code-branch': GitBranch, 'plug': Plug,
  'cloud': Cloud, 'cloud-arrow-up': CloudUpload, 'signal': Signal, 'house-signal': House,
  'gauge-high': Gauge, 'bolt': Zap, 'cube': Box, 'cubes': Boxes, 'layer-group': Layers,
  // actions / ui
  'eye': Eye, 'eye-slash': EyeOff, 'copy': Copy, 'trash': Trash2, 'pen': Pen,
  'plus': Plus, 'plus-circle': CirclePlus, 'minus': Minus, 'search': Search,
  'magnifying-glass': Search, 'search-plus': ZoomIn, 'filter': Funnel, 'list': List,
  'sliders': SlidersHorizontal, 'download': Download, 'floppy-disk': Save, 'folder-open': FolderOpen,
  'archive': Archive, 'link': Link2, 'bars': Menu, 'font': Type, 'image': ImageIcon,
  'file-pdf': FileText, 'file-contract': FileText, 'paper-plane': Send, 'hand-pointer': Pointer,
  'wand-magic-sparkles': WandSparkles, 'magic': WandSparkles, 'sparkles': Sparkles,
  'wrench': Wrench, 'gear': Settings, 'gears': Settings,
  // comms / time
  'envelope': Mail, 'envelope-open': MailOpen, 'calendar': Calendar, 'calendar-day': CalendarDays,
  'clock': Clock, 'bell': Bell, 'fire': Flame, 'heart': Heart, 'ghost': Ghost, 'inbox': Inbox,
  'lightbulb': Lightbulb, 'bullseye': Target, 'bullhorn': Megaphone, 'comments': MessagesSquare,
  'headset': Headset, 'phone': Phone, 'globe': Globe, 'dice': Dices, 'chart-area': ChartArea,
  // media / state
  'ban': Ban, 'stop': CircleStop, 'play': Play, 'circle-pause': CirclePause,
  'sun': Sun, 'moon': Moon, 'rocket': Rocket, 'box-open': PackageOpen, 'qrcode': QrCode,
  'right-left': ArrowLeftRight, 'graduation-cap': GraduationCap,
  // rarity tiers (landing page package tiers)
  'gem': Gem, 'crown': Crown, 'trophy': Trophy, 'swords': Swords,
  // brand marks
  'discord': Discord, 'facebook-f': Facebook, 'facebook': Facebook,
  'windows': Windows, 'linux': Linux, 'google-color': Google,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'ref'> {
  name: IconName;
  /** Overrides the default 1em box (accepts number of px or any CSS length). */
  size?: number | string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = '1em', className, ...rest },
  ref,
) {
  const Cmp = ICONS[name] as IconComponent;
  return (
    <Cmp
      ref={ref as never}
      width={size}
      height={size}
      className={['inline-block shrink-0 align-[-0.125em]', className].filter(Boolean).join(' ')}
      aria-hidden={rest['aria-label'] ? undefined : true}
      focusable={false}
      {...rest}
    />
  );
});
