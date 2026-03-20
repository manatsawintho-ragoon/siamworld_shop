'use client';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange={false}>
      <SettingsProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
