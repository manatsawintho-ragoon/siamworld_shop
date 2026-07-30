'use client';
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { THEMES, DEFAULT_THEME_ID, themeCss, type ThemeConfig } from '@/lib/themeCss';

// Re-exported so existing importers (the admin appearance page) keep working.
// The definitions live in lib/themeCss.ts, which server components can import.
export { THEMES, DEFAULT_THEME_ID, themeSwatch, themeCss } from '@/lib/themeCss';
export type { ThemeConfig, ThemeSwatch } from '@/lib/themeCss';

interface ThemeContextType {
  currentThemeId: string;
  themes: ThemeConfig[];
  applyThemeById: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentThemeId: DEFAULT_THEME_ID,
  themes: THEMES,
  applyThemeById: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const themeId = settings.theme_name || DEFAULT_THEME_ID;

  // The root layout already rendered this theme's CSS into the initial HTML, so
  // re-injecting the same string would only cost a style recalculation. Only act
  // when the resolved theme actually differs from what the server sent - which
  // happens when an admin changes the setting while the page is open.
  //
  // The localStorage cache that used to pre-empt the green flash is gone with it:
  // there is no flash to pre-empt now, and reading a stale cached theme was its
  // own source of one.
  useEffect(() => {
    if (document.documentElement.dataset.siteTheme === themeId) return;
    const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
    injectTheme(theme);
  }, [themeId]);

  const applyThemeById = (id: string) => {
    const theme = THEMES.find(t => t.id === id) ?? THEMES[0];
    injectTheme(theme);
    try { localStorage.setItem('site-theme', id); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ currentThemeId: themeId, themes: THEMES, applyThemeById }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);


/**
 * Write a theme's CSS into the document.
 *
 * app/layout.tsx server-renders the same string for the shop's configured theme,
 * so on a normal page load this never runs. It still matters for the admin
 * appearance page's live preview and for a settings change arriving mid-session.
 */
export function injectTheme(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('site-theme-vars') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'site-theme-vars';
    document.head.appendChild(el);
  }
  el.textContent = themeCss(theme);
  document.documentElement.setAttribute('data-site-theme', theme.id);
  if (theme.isDark) document.documentElement.setAttribute('data-site-dark', 'true');
  else document.documentElement.removeAttribute('data-site-dark');
}
