'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { usePromoEligibility, resolvePromoCta } from '@/hooks/usePromoEligibility';

/**
 * Eligibility-aware primary CTA, for use from server-rendered marketing pages.
 *
 * The landing pages are server components, so they cannot read auth state. They
 * used to hardcode `/order?kind=trial`, which sent customers who had already
 * used their trial to a rejection screen. Dropping this client island in keeps
 * those pages server-rendered while letting the one button that matters know
 * who is looking at it.
 *
 * Signed-out and pre-load both render the trial CTA, so the markup a crawler
 * sees is exactly what it saw before.
 */
export default function PromoCtaButton({ className }: { className?: string }) {
  const t = useTranslations('home');
  const cta = resolvePromoCta(usePromoEligibility());

  return (
    <Button asChild className={className}>
      <Link href={cta.href}>{t(cta.labelKey)}</Link>
    </Button>
  );
}
