'use client';

import { Icon } from '@/components/ui/icon';
import { useTranslations } from 'next-intl';

/**
 * Floating "contact us on Facebook" button, present on every page.
 *
 * Sits below the modal/overlay layers (those use z-[110]+) so it can never
 * cover a dialog, and above ordinary page content. The label is revealed on
 * hover on pointer devices; the button keeps an aria-label either way, so it
 * is never an unlabelled icon-only control.
 */
const FACEBOOK_URL = 'https://www.facebook.com/siamsitestore/';

export default function FacebookFab() {
  const t = useTranslations('common');
  return (
    <a
      href={FACEBOOK_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('contactFacebook')}
      className="group fixed bottom-5 right-5 z-[90] flex items-center gap-2.5 rounded-full bg-[#1877F2] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 cursor-pointer h-12 pl-3.5 pr-3.5 md:hover:pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1877F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Icon name="facebook" className="text-2xl shrink-0" />
      {/* Width-animated label rather than a mounted/unmounted node, so the
          hover reveal never reflows the page around it. */}
      <span className="hidden md:inline-block max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold transition-[max-width] duration-300 ease-out group-hover:max-w-[9rem]">
        {t('chatWithUs')}
      </span>
    </a>
  );
}
