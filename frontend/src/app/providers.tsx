'use client';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { AdminAlertProvider } from '@/components/AdminAlert';
import { ReactNode } from 'react';
import DynamicFavicon from '@/components/DynamicFavicon';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AdminAlertProvider>
          <DynamicFavicon />
          {children}
        </AdminAlertProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
