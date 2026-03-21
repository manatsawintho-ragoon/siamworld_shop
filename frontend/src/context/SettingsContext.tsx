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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const d = await api('/public/settings');
      setSettings((d.settings as Record<string, string>) || {});
    } catch { }
  }, []);

  useEffect(() => {
    refreshSettings().finally(() => setLoading(false));
  }, [refreshSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
