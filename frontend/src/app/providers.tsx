'use client';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { AdminAlertProvider } from '@/components/AdminAlert';
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';
import DynamicFavicon from '@/components/DynamicFavicon';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange={false}>
      <SettingsProvider>
        <AuthProvider>
          <AdminAlertProvider>
            <DynamicFavicon />
            {children}
          </AdminAlertProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
