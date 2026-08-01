'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { StatusScreen, StatusDetailRow } from '@/components/StatusScreen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

/**
 * Runtime error boundary for the customer tree.
 *
 * Without this file a thrown render error shows Next.js's built-in
 * "Application error: a client-side exception has occurred", which tells a
 * customer nothing and looks like the whole product broke.
 *
 * `error.digest` is the server-generated id that correlates with the stack in
 * the container log, so it is surfaced: it is the only handle support has when
 * a customer reports "it just went blank". The message itself is deliberately
 * not shown - in production it is redacted anyway, and in development the
 * overlay already shows it.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('status');

  useEffect(() => {
    console.error('[panel] unhandled render error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <StatusScreen
        variant="error"
        title={t('errorTitle')}
        description={t('errorDesc')}
        detail={
          error.digest ? <StatusDetailRow label={t('errorRef')} value={error.digest} /> : undefined
        }
        actions={
          <>
            <Button onClick={reset} className="rounded-full px-8 h-12 font-bold">
              <Icon name="arrows-rotate" className="mr-2" />
              {t('tryAgain')}
            </Button>
            <Button
              asChild
              variant="secondary"
              className="rounded-full px-8 h-12 font-bold border border-border"
            >
              <Link href="/">
                <Icon name="house" className="mr-2" />
                {t('goHome')}
              </Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
