'use client';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AdminAlertProvider } from '@/components/AdminAlert';
import { AuthModalProvider } from '@/components/AuthModal';
import { ReactNode } from 'react';
import DynamicFavicon from '@/components/DynamicFavicon';
import PageTransition from '@/components/PageTransition';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <AuthProvider>
          <AdminAlertProvider>
            <AuthModalProvider>
              <DynamicFavicon />
              {children}
            </AuthModalProvider>
          </AdminAlertProvider>
        </AuthProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}
