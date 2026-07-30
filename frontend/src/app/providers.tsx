'use client';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { RankingsProvider } from '@/context/RankingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { PublicRankings } from '@/lib/serverSeo';
import { AdminAlertProvider } from '@/components/AdminAlert';
import { AuthModalProvider } from '@/components/AuthModal';
import { ReactNode } from 'react';
import PageTransition from '@/components/PageTransition';

export default function Providers({
  children,
  initialSettings,
  initialRankings,
  initialUser,
  sessionSeeded,
}: {
  children: ReactNode;
  initialSettings?: Record<string, string>;
  initialRankings?: PublicRankings;
  initialUser?: unknown | null;
  sessionSeeded?: boolean;
}) {
  // Both widgets default to visible, so only an explicit '0' turns the fetches off.
  const rankingsEnabled =
    (initialSettings?.show_topup_rank_widget ?? '1') === '1' ||
    (initialSettings?.show_topup_daily_widget ?? '1') === '1';

  return (
    <SettingsProvider initialSettings={initialSettings}>
      <RankingsProvider initial={initialRankings} enabled={rankingsEnabled}>
        <ThemeProvider>
          <AuthProvider initialUser={initialUser as never} seeded={sessionSeeded}>
            <AdminAlertProvider>
              <AuthModalProvider>
                {children}
              </AuthModalProvider>
            </AdminAlertProvider>
          </AuthProvider>
        </ThemeProvider>
      </RankingsProvider>
    </SettingsProvider>
  );
}
