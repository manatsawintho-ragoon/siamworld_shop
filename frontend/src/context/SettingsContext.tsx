'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';

interface SettingsContextType {
  settings: Record<string, string>;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: {},
  loading: true,
  refreshSettings: async () => {},
});

/**
 * `initialSettings` comes from the root layout, which already fetches the same
 * public settings server-side for metadata. Seeding them here means the very
 * first paint knows the shop's logo, banner and which nav items exist.
 *
 * Starting from `{}` was a real layout-shift source, not just a flash: the
 * Navbar renders a text wordmark when `website_logo_url` is unset and an 80px
 * logo image when it is, so every page swapped one for the other a second or
 * two in and pushed the whole page down 28px. That single shift measured 0.239
 * CLS on the home page.
 */
export function SettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: Record<string, string>;
}) {
  const hasInitial = !!initialSettings && Object.keys(initialSettings).length > 0;
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings || {});
  const [loading, setLoading] = useState(!hasInitial);

  const refreshSettings = useCallback(async () => {
    try {
      const d = await api('/public/settings');
      setSettings((d.settings as Record<string, string>) || {});
    } catch { }
  }, []);

  useEffect(() => {
    // Already server-rendered: re-fetching would only replace identical values,
    // and admins get fresh data through refreshSettings() on save anyway.
    if (hasInitial) return;
    refreshSettings().finally(() => setLoading(false));
  }, [refreshSettings, hasInitial]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
