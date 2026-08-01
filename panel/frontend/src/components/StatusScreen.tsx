import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from '@/components/ui/icon';

/**
 * The single status surface for the panel.
 *
 * Every "it worked", "it failed", "it is still working" and "that does not exist"
 * screen renders through this so they stay visually identical. Before this, each
 * flow (order, topup, renew) hand-rolled its own centred card with its own icon
 * treatment and spacing, which is why they had all drifted apart.
 *
 * Copy is never hardcoded here: callers pass already-translated strings, so this
 * works the same under next-intl in the [locale] tree and in the operator tree
 * (which has no translations at all).
 */

export type StatusVariant = 'success' | 'error' | 'warning' | 'pending';

const VARIANTS: Record<StatusVariant, { icon: IconName; badge: string; ring: string; spin?: boolean }> = {
  success: {
    icon: 'circle-check',
    badge: 'bg-emerald-500 text-white',
    ring: 'bg-emerald-500/10',
  },
  error: {
    icon: 'circle-xmark',
    badge: 'bg-destructive text-destructive-foreground',
    ring: 'bg-destructive/10',
  },
  warning: {
    icon: 'triangle-exclamation',
    badge: 'bg-amber-500 text-white',
    ring: 'bg-amber-500/10',
  },
  pending: {
    icon: 'spinner',
    badge: 'bg-primary text-primary-foreground',
    ring: 'bg-primary/10',
    spin: true,
  },
};

export interface StatusScreenProps {
  variant: StatusVariant;
  title: string;
  /** One or two sentences. What happened, and what it means for them. */
  description?: React.ReactNode;
  /** Receipt rows, an error code, a deploy log excerpt. Rendered in a bordered well. */
  detail?: React.ReactNode;
  /** Buttons. Put the action they most likely want first. */
  actions?: React.ReactNode;
  /** Override the variant's default glyph (e.g. a rocket for "shop is deploying"). */
  icon?: IconName;
  /**
   * `compact` renders for use inside an existing wizard card, without the
   * full-viewport centring. Default renders as a standalone page body.
   */
  compact?: boolean;
  className?: string;
}

export function StatusScreen({
  variant,
  title,
  description,
  detail,
  actions,
  icon,
  compact = false,
  className,
}: StatusScreenProps) {
  const v = VARIANTS[variant];

  return (
    <div
      className={cn(
        'w-full text-center',
        compact ? 'py-2' : 'min-h-[60vh] flex flex-col items-center justify-center px-6 py-16',
        className
      )}
      role={variant === 'error' ? 'alert' : undefined}
      aria-live={variant === 'pending' ? 'polite' : undefined}
    >
      <div className="relative inline-block mb-6">
        <div className={cn('absolute inset-0 rounded-full blur-2xl', v.ring)} aria-hidden />
        <div
          className={cn(
            'relative w-20 h-20 rounded-[1.75rem] flex items-center justify-center text-3xl shadow-sm mx-auto',
            v.badge
          )}
        >
          <Icon name={icon ?? v.icon} className={v.spin ? 'animate-spin' : undefined} />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-3 max-w-lg mx-auto">
        {title}
      </h2>

      {description && (
        <div className="text-sm text-muted-foreground font-medium leading-relaxed max-w-lg mx-auto">
          {description}
        </div>
      )}

      {detail && (
        <div className="mt-6 w-full max-w-sm mx-auto rounded-xl border border-border bg-secondary/50 p-4 text-left">
          {detail}
        </div>
      )}

      {actions && (
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mx-auto [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
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
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs font-semibold text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          'text-right break-all',
          strong ? 'text-base font-bold text-foreground' : 'text-sm font-semibold text-foreground'
        )}
      >
        {value}
      </span>
    </div>
  );
}
