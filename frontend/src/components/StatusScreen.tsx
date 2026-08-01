import type { ReactNode } from 'react';
import { Check, X, AlertTriangle, Loader2, type LucideIcon } from 'lucide-react';

/**
 * The single status surface for the shop frontend.
 *
 * Every "paid", "slip rejected", "code already used" and "page not found" screen
 * renders through this, so a player sees the same shape whatever went right or
 * wrong. Each flow used to hand-roll its own centred card, which is how the
 * topup success screen and the redeem success screen ended up looking like they
 * belonged to different products.
 *
 * Colours come from the per-theme --color-success / --color-error /
 * --color-warning tokens, so this inherits all of the shop themes rather than
 * hardcoding green and red.
 */

export type StatusVariant = 'success' | 'error' | 'warning' | 'pending';

const VARIANTS: Record<
  StatusVariant,
  { Icon: LucideIcon; badge: string; glow: string; spin?: boolean }
> = {
  success: { Icon: Check,         badge: 'bg-success', glow: 'bg-success/10' },
  error:   { Icon: X,             badge: 'bg-error',   glow: 'bg-error/10' },
  warning: { Icon: AlertTriangle, badge: 'bg-warning', glow: 'bg-warning/10' },
  pending: { Icon: Loader2,       badge: 'bg-primary', glow: 'bg-primary/10', spin: true },
};

export interface StatusScreenProps {
  variant: StatusVariant;
  title: string;
  /** One or two sentences: what happened and what it means for the player. */
  description?: ReactNode;
  /** Receipt rows, an error reason. Rendered in a bordered well. */
  detail?: ReactNode;
  /** Buttons. Put the action they most likely want first. */
  actions?: ReactNode;
  /** Override the variant glyph (e.g. a search icon for a 404). */
  icon?: LucideIcon;
  /** Render inside an existing card instead of as a standalone page body. */
  compact?: boolean;
}

export default function StatusScreen({
  variant,
  title,
  description,
  detail,
  actions,
  icon,
  compact = false,
}: StatusScreenProps) {
  const v = VARIANTS[variant];
  const Glyph = icon ?? v.Icon;

  return (
    <div
      className={
        compact
          ? 'w-full text-center space-y-5'
          : 'w-full text-center space-y-5 py-12 px-5 sm:px-8'
      }
      role={variant === 'error' ? 'alert' : undefined}
      aria-live={variant === 'pending' ? 'polite' : undefined}
    >
      <div className="relative inline-block">
        <div className={`absolute inset-0 rounded-full blur-2xl ${v.glow}`} aria-hidden />
        <div
          className={`relative w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-xl mx-auto ${v.badge}`}
        >
          <Glyph className={`w-8 h-8 ${v.spin ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-2xl font-black text-foreground tracking-tight">{title}</h2>
        {description && (
          <div className="text-sm font-bold text-foreground-subtle leading-relaxed max-w-sm mx-auto">
            {description}
          </div>
        )}
      </div>

      {detail && (
        <div className="bg-surface-hover rounded-xl p-4 border border-border-muted max-w-xs w-full mx-auto text-left space-y-1.5">
          {detail}
        </div>
      )}

      {actions && (
        <div className="flex flex-col gap-2.5 max-w-[260px] w-full mx-auto pt-1">{actions}</div>
      )}
    </div>
  );
}

/** A label/value row for the `detail` well. Keeps receipts aligned across flows. */
export function StatusDetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] font-black text-foreground-subtle uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span
        className={
          strong
            ? 'text-lg font-black text-foreground text-right break-all'
            : 'text-xs font-black text-foreground-muted text-right break-all'
        }
      >
        {value}
      </span>
    </div>
  );
}
