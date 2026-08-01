import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Navbar from '@/components/Navbar';
import { StatusScreen } from '@/components/StatusScreen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

/**
 * 404 for the customer-facing tree.
 *
 * The middleware routes everything except /api, /admin and static files through
 * next-intl, so this is what an unknown customer URL lands on in both locales.
 * /admin has its own (operator)/not-found.tsx, and anything that bypasses the
 * middleware entirely (a path with a file extension, e.g. /wp-login.php) falls
 * through to app/not-found.tsx.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations('status');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <StatusScreen
        variant="warning"
        icon="magnifying-glass"
        title={t('notFoundTitle')}
        description={t('notFoundDesc')}
        actions={
          <>
            <Button asChild className="rounded-full px-8 h-12 font-bold">
              <Link href="/">
                <Icon name="house" className="mr-2" />
                {t('goHome')}
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="rounded-full px-8 h-12 font-bold border border-border"
            >
              <Link href="/dashboard">
                <Icon name="gauge-high" className="mr-2" />
                {t('goDashboard')}
              </Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
