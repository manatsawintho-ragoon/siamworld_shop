'use client';
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSettings } from './SettingsContext';

export interface ThemeConfig {
  id: string;
  name: string;
  nameTh: string;
  isDark: boolean;
  preview: { from: string; to: string; accent: string; bg: string; };
  vars: Record<string, string>;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'minecraft-green',
    name: 'Minecraft Green',
    nameTh: 'ธีมเริ่มต้น',
    isDark: false,
    preview: { from: '#14532d', to: '#16a34a', accent: '#22c55e', bg: '#f0fdf4' },
    vars: {
      '--color-primary': '34 197 94',
      '--color-primary-hover': '22 163 74',
      '--color-primary-light': '74 222 128',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '20 83 45',
      '--color-primary-muted': '187 247 208',
      '--color-background': '240 253 244',
      '--color-surface': '255 255 255',
      '--color-border': '187 247 208',
      '--color-border-muted': '220 252 231',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#14532d',
      '--theme-banner-to': '#15803d',
      '--theme-card-shadow': '#86efac',
      '--theme-card-border': '#bbf7d0',
      '--theme-wallet-from': '#16a34a',
      '--theme-wallet-to': '#065f46',
    }
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    nameTh: 'มหาสมุทรลึก',
    isDark: false,
    preview: { from: '#0c1445', to: '#1d4ed8', accent: '#3b82f6', bg: '#eff6ff' },
    vars: {
      '--color-primary': '59 130 246',
      '--color-primary-hover': '37 99 235',
      '--color-primary-light': '96 165 250',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '30 64 175',
      '--color-primary-muted': '191 219 254',
      '--color-background': '239 246 255',
      '--color-surface': '255 255 255',
      '--color-border': '191 219 254',
      '--color-border-muted': '219 234 254',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#0c1a4a',
      '--theme-banner-to': '#1e40af',
      '--theme-card-shadow': '#93c5fd',
      '--theme-card-border': '#bfdbfe',
      '--theme-wallet-from': '#1d4ed8',
      '--theme-wallet-to': '#1e3a8a',
    }
  },
  {
    id: 'sunset-fire',
    name: 'Sunset Fire',
    nameTh: 'พระอาทิตย์ตก',
    isDark: false,
    preview: { from: '#7c2d12', to: '#c2410c', accent: '#f97316', bg: '#fff7ed' },
    vars: {
      '--color-primary': '249 115 22',
      '--color-primary-hover': '234 88 12',
      '--color-primary-light': '251 146 60',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '124 45 18',
      '--color-primary-muted': '254 215 170',
      '--color-background': '255 247 237',
      '--color-surface': '255 255 255',
      '--color-border': '254 215 170',
      '--color-border-muted': '255 237 213',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#7c2d12',
      '--theme-banner-to': '#c2410c',
      '--theme-card-shadow': '#fdba74',
      '--theme-card-border': '#fed7aa',
      '--theme-wallet-from': '#ea580c',
      '--theme-wallet-to': '#7c2d12',
    }
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    nameTh: 'ราชันย์ม่วง',
    isDark: false,
    preview: { from: '#2e1065', to: '#5b21b6', accent: '#8b5cf6', bg: '#f5f3ff' },
    vars: {
      '--color-primary': '139 92 246',
      '--color-primary-hover': '109 40 217',
      '--color-primary-light': '167 139 250',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '76 29 149',
      '--color-primary-muted': '221 214 254',
      '--color-background': '245 243 255',
      '--color-surface': '255 255 255',
      '--color-border': '221 214 254',
      '--color-border-muted': '237 233 254',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#2e1065',
      '--theme-banner-to': '#5b21b6',
      '--theme-card-shadow': '#c4b5fd',
      '--theme-card-border': '#ddd6fe',
      '--theme-wallet-from': '#7c3aed',
      '--theme-wallet-to': '#2e1065',
    }
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    nameTh: 'ซากุระ',
    isDark: false,
    preview: { from: '#500724', to: '#be185d', accent: '#ec4899', bg: '#fdf2f8' },
    vars: {
      '--color-primary': '236 72 153',
      '--color-primary-hover': '219 39 119',
      '--color-primary-light': '244 114 182',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '157 23 77',
      '--color-primary-muted': '251 207 232',
      '--color-background': '253 242 248',
      '--color-surface': '255 255 255',
      '--color-border': '251 207 232',
      '--color-border-muted': '252 231 243',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#500724',
      '--theme-banner-to': '#be185d',
      '--theme-card-shadow': '#f9a8d4',
      '--theme-card-border': '#fbcfe8',
      '--theme-wallet-from': '#db2777',
      '--theme-wallet-to': '#500724',
    }
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    nameTh: 'ไซเบอร์นีออน',
    isDark: true,
    preview: { from: '#050508', to: '#0f172a', accent: '#22d3ee', bg: '#08081a' },
    vars: {
      '--color-primary': '34 211 238',
      '--color-primary-hover': '6 182 212',
      '--color-primary-light': '103 232 249',
      '--color-primary-foreground': '8 8 20',
      '--color-primary-shadow': '6 182 212',
      '--color-primary-muted': '8 145 178',
      '--color-background': '8 8 20',
      '--color-surface': '15 15 35',
      '--color-border': '34 211 238',
      '--color-border-muted': '22 78 99',
      '--color-foreground': '240 249 255',
      '--color-foreground-muted': '186 230 253',
      '--color-foreground-subtle': '125 211 252',
      '--theme-banner-from': '#020213',
      '--theme-banner-to': '#0c0c2e',
      '--theme-card-shadow': '#0891b2',
      '--theme-card-border': '#22d3ee',
      '--theme-wallet-from': '#0e7490',
      '--theme-wallet-to': '#06192a',
    }
  },
  {
    id: 'golden-temple',
    name: 'Golden Temple',
    nameTh: 'วิหารทอง',
    isDark: false,
    preview: { from: '#451a03', to: '#78350f', accent: '#f59e0b', bg: '#fffbeb' },
    vars: {
      '--color-primary': '245 158 11',
      '--color-primary-hover': '217 119 6',
      '--color-primary-light': '251 191 36',
      '--color-primary-foreground': '28 14 0',
      '--color-primary-shadow': '146 64 14',
      '--color-primary-muted': '253 230 138',
      '--color-background': '255 251 235',
      '--color-surface': '255 255 255',
      '--color-border': '253 230 138',
      '--color-border-muted': '254 240 138',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#451a03',
      '--theme-banner-to': '#92400e',
      '--theme-card-shadow': '#fcd34d',
      '--theme-card-border': '#fde68a',
      '--theme-wallet-from': '#d97706',
      '--theme-wallet-to': '#451a03',
    }
  },
  {
    id: 'ice-crystal',
    name: 'Ice Crystal',
    nameTh: 'คริสตัลน้ำแข็ง',
    isDark: false,
    preview: { from: '#0c4a6e', to: '#0369a1', accent: '#06b6d4', bg: '#ecfeff' },
    vars: {
      '--color-primary': '6 182 212',
      '--color-primary-hover': '8 145 178',
      '--color-primary-light': '34 211 238',
      '--color-primary-foreground': '12 74 110',
      '--color-primary-shadow': '7 89 133',
      '--color-primary-muted': '165 243 252',
      '--color-background': '236 254 255',
      '--color-surface': '255 255 255',
      '--color-border': '165 243 252',
      '--color-border-muted': '207 250 254',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#0c4a6e',
      '--theme-banner-to': '#0369a1',
      '--theme-card-shadow': '#67e8f9',
      '--theme-card-border': '#a5f3fc',
      '--theme-wallet-from': '#0284c7',
      '--theme-wallet-to': '#0c4a6e',
    }
  },
  {
    id: 'crimson-knight',
    name: 'Crimson Knight',
    nameTh: 'อัศวินแดง',
    isDark: false,
    preview: { from: '#450a0a', to: '#991b1b', accent: '#ef4444', bg: '#fff1f2' },
    vars: {
      '--color-primary': '239 68 68',
      '--color-primary-hover': '220 38 38',
      '--color-primary-light': '248 113 113',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '127 29 29',
      '--color-primary-muted': '254 202 202',
      '--color-background': '255 241 242',
      '--color-surface': '255 255 255',
      '--color-border': '254 202 202',
      '--color-border-muted': '254 226 226',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#450a0a',
      '--theme-banner-to': '#991b1b',
      '--theme-card-shadow': '#fca5a5',
      '--theme-card-border': '#fecaca',
      '--theme-wallet-from': '#dc2626',
      '--theme-wallet-to': '#450a0a',
    }
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    nameTh: 'ราตรีคราม',
    isDark: true,
    preview: { from: '#0f0c29', to: '#1e1b4b', accent: '#818cf8', bg: '#0f0c29' },
    vars: {
      '--color-primary': '129 140 248',
      '--color-primary-hover': '99 102 241',
      '--color-primary-light': '165 180 252',
      '--color-primary-foreground': '238 242 255',
      '--color-primary-shadow': '55 48 163',
      '--color-primary-muted': '67 56 202',
      '--color-background': '15 12 41',
      '--color-surface': '24 20 60',
      '--color-border': '67 56 202',
      '--color-border-muted': '49 46 129',
      '--color-foreground': '238 242 255',
      '--color-foreground-muted': '199 210 254',
      '--color-foreground-subtle': '165 180 252',
      '--theme-banner-from': '#07051a',
      '--theme-banner-to': '#1e1b4b',
      '--theme-card-shadow': '#4338ca',
      '--theme-card-border': '#4338ca',
      '--theme-wallet-from': '#4338ca',
      '--theme-wallet-to': '#07051a',
    }
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    nameTh: 'ป่าเอเมอรัลด์',
    isDark: false,
    preview: { from: '#022c22', to: '#064e3b', accent: '#10b981', bg: '#ecfdf5' },
    vars: {
      '--color-primary': '16 185 129',
      '--color-primary-hover': '5 150 105',
      '--color-primary-light': '52 211 153',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '2 44 34',
      '--color-primary-muted': '167 243 208',
      '--color-background': '236 253 245',
      '--color-surface': '255 255 255',
      '--color-border': '167 243 208',
      '--color-border-muted': '209 250 229',
      '--color-foreground': '17 24 39',
      '--color-foreground-muted': '75 85 99',
      '--color-foreground-subtle': '107 114 128',
      '--theme-banner-from': '#022c22',
      '--theme-banner-to': '#065f46',
      '--theme-card-shadow': '#6ee7b7',
      '--theme-card-border': '#a7f3d0',
      '--theme-wallet-from': '#059669',
      '--theme-wallet-to': '#022c22',
    }
  },
  {
    id: 'rose-dragon',
    name: 'Rose Dragon',
    nameTh: 'มังกรกุหลาบ',
    isDark: true,
    preview: { from: '#1c0010', to: '#500724', accent: '#fb7185', bg: '#120008' },
    vars: {
      '--color-primary': '251 113 133',
      '--color-primary-hover': '244 63 94',
      '--color-primary-light': '253 164 175',
      '--color-primary-foreground': '255 241 242',
      '--color-primary-shadow': '136 14 79',
      '--color-primary-muted': '159 18 57',
      '--color-background': '18 0 8',
      '--color-surface': '30 8 20',
      '--color-border': '159 18 57',
      '--color-border-muted': '76 5 25',
      '--color-foreground': '255 241 242',
      '--color-foreground-muted': '253 164 175',
      '--color-foreground-subtle': '251 113 133',
      '--theme-banner-from': '#0a0004',
      '--theme-banner-to': '#500724',
      '--theme-card-shadow': '#9f1239',
      '--theme-card-border': '#9f1239',
      '--theme-wallet-from': '#be123c',
      '--theme-wallet-to': '#0a0004',
    }
  },
];

export const DEFAULT_THEME_ID = 'minecraft-green';

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

  // Apply cached theme immediately on mount — prevents green flash before settings load
  useEffect(() => {
    try {
      const cached = localStorage.getItem('site-theme');
      if (cached && cached !== DEFAULT_THEME_ID) {
        const t = THEMES.find(t => t.id === cached);
        if (t) injectTheme(t);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
    injectTheme(theme);
    try { localStorage.setItem('site-theme', themeId); } catch {}
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

export function injectTheme(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('site-theme-vars') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'site-theme-vars';
    document.head.appendChild(el);
  }

  const vars = Object.entries(theme.vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  const isDefault = theme.id === 'minecraft-green';

  if (isDefault) {
    el.textContent = `:root {\n${vars}\n}`;
    document.documentElement.setAttribute('data-site-theme', theme.id);
    document.documentElement.removeAttribute('data-site-dark');
    return;
  }

  // Scope both frontend page and portals (modals rendered via createPortal to document.body)
  const fp = ':is(.frontend-page, [data-theme-portal])';

  const base = `
/* ── Theme: ${theme.name} ── */
.frontend-page { background-color: rgb(var(--color-background)) !important; }

/* text-green-* → theme primary */
${fp} .text-green-100,
${fp} .text-green-200 { color: rgba(255,255,255,0.85) !important; }
${fp} .text-green-400 { color: rgb(var(--color-primary-light)) !important; }
${fp} .text-green-500 { color: rgb(var(--color-primary)) !important; }
${fp} .text-green-500\\/60 { color: rgb(var(--color-primary) / 0.6) !important; }
${fp} .text-green-500\\/70 { color: rgb(var(--color-primary) / 0.7) !important; }
${fp} .text-green-600,
${fp} .text-green-700 { color: rgb(var(--color-primary-hover)) !important; }
${fp} .hover\\:text-green-600:hover { color: rgb(var(--color-primary-hover)) !important; }
${fp} .group:hover .group-hover\\:text-green-600 { color: rgb(var(--color-primary-hover)) !important; }
${fp} .group:hover .group-hover\\:text-green-500\\/60 { color: rgb(var(--color-primary) / 0.6) !important; }

/* bg-green-* → theme primary */
${fp} .bg-green-50 { background-color: rgb(var(--color-primary) / 0.08) !important; }
${fp} .bg-green-100 { background-color: rgb(var(--color-primary) / 0.15) !important; }
${fp} .bg-green-400 { background-color: rgb(var(--color-primary-light)) !important; }
${fp} .bg-green-500 { background-color: rgb(var(--color-primary)) !important; }
${fp} .bg-green-600 { background-color: rgb(var(--color-primary-hover)) !important; }
${fp} .hover\\:bg-green-50:hover { background-color: rgb(var(--color-primary) / 0.08) !important; }
${fp} .hover\\:bg-green-50\\/50:hover { background-color: rgb(var(--color-primary) / 0.04) !important; }
${fp} .hover\\:bg-green-500:hover { background-color: rgb(var(--color-primary)) !important; }
${fp} .hover\\:bg-green-600:hover { background-color: rgb(var(--color-primary-hover)) !important; }

/* border-green-* → theme border */
${fp} .border-green-100 { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .border-green-200 { border-color: rgb(var(--color-border)) !important; }
${fp} .border-green-400 { border-color: rgb(var(--color-primary-light)) !important; }
${fp} .border-green-500 { border-color: rgb(var(--color-primary)) !important; }
${fp} .border-green-600 { border-color: rgb(var(--color-primary-hover)) !important; }
${fp} .hover\\:border-green-400:hover { border-color: rgb(var(--color-primary-light)) !important; }

/* gradients */
${fp} .from-green-400 { --tw-gradient-from: rgb(var(--color-primary-light)) var(--tw-gradient-from-position) !important; }
${fp} .via-emerald-500 { --tw-gradient-via: rgb(var(--color-primary)) var(--tw-gradient-via-position) !important; }
${fp} .to-green-400 { --tw-gradient-to: rgb(var(--color-primary-light)) var(--tw-gradient-to-position) !important; }

/* focus */
${fp} .focus\\:border-green-400:focus { border-color: rgb(var(--color-primary)) !important; }
${fp} .focus\\:border-green-500:focus { border-color: rgb(var(--color-primary)) !important; }
${fp} .focus\\:ring-green-400\\/20:focus { --tw-ring-color: rgb(var(--color-primary) / 0.2) !important; }
${fp} *:focus-visible { outline-color: rgb(var(--color-primary)) !important; }

/* scrollbar */
::-webkit-scrollbar-thumb { background: rgb(var(--color-border)) !important; }
::-webkit-scrollbar-thumb:hover { background: rgb(var(--color-primary)) !important; }

/* hardcoded green hex */
${fp} .bg-\\[\\#16a34a\\] { background-color: rgb(var(--color-primary-hover)) !important; }
${fp} .shadow-\\[0_4px_0_\\#0d6b2e\\] { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_3px_0_\\#0d6b2e\\] { box-shadow: 0 3px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_2px_0_\\#0d6b2e\\] { box-shadow: 0 2px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .hover\\:brightness-110:hover { filter: brightness(1.15); }

/* login/register button shadow #14532d (green-900) */
${fp} .shadow-\\[0_4px_0_\\#14532d\\] { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_2px_0_\\#14532d\\] { box-shadow: 0 2px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .hover\\:shadow-\\[0_4px_0_\\#14532d\\]:hover { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .hover\\:shadow-\\[0_2px_0_\\#14532d\\]:hover { box-shadow: 0 2px 0 rgb(var(--color-primary-shadow)) !important; }

/* text-green-800 (marquee message text) */
${fp} .text-green-800 { color: rgb(var(--color-primary-hover)) !important; }

/* dark card header/arrow bg-[#1e2735] + inventory filter active */
${fp} .bg-\\[\\#1e2735\\] { background-color: var(--theme-banner-from) !important; }
${fp} .text-\\[\\#1e2735\\] { color: var(--theme-banner-from) !important; }
${fp} .border-\\[\\#38404d\\] { border-color: rgb(var(--color-border)) !important; }
${fp} .shadow-\\[0_4px_0_\\#38404d\\] { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .active\\:shadow-\\[0_1px_0_\\#38404d\\]:active { box-shadow: 0 1px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_2px_0_\\#0d1117\\] { box-shadow: 0 2px 0 rgb(var(--color-primary-shadow)) !important; }

/* Notification / AdminAlert specific */
${fp} .text-\\[\\#16a34a\\] { color: rgb(var(--color-primary)) !important; }
${fp} .bg-\\[\\#16a34a\\] { background-color: rgb(var(--color-primary)) !important; }
${fp} .shadow-\\[0_4px_0_\\#c5cad3\\] { box-shadow: 0 4px 0 rgb(var(--color-border)) !important; }

/* Red/Amber button shadows */
${fp} .shadow-\\[0_4px_0_rgb\\(217\\,119\\,6\\)\\] { box-shadow: 0 4px 0 rgb(var(--color-warning) / 0.8) !important; }
${fp} .shadow-\\[0_4px_0_rgb\\(31\\,41\\,55\\)\\] { box-shadow: 0 4px 0 rgba(0,0,0,0.4) !important; }
${fp} .shadow-\\[0_3px_0_\\#d1d5db\\] { box-shadow: 0 3px 0 rgb(var(--color-border)) !important; }
${fp} .shadow-\\[0_4px_0_\\#e5e7eb\\] { box-shadow: 0 4px 0 rgb(var(--color-border)) !important; }
${fp} .shadow-\\[0_2px_0_\\#e5e7eb\\] { box-shadow: 0 2px 0 rgb(var(--color-border)) !important; }
`;

  const dark = theme.isDark ? `
/* ── Dark: page bg ── */
body { background-color: rgb(var(--color-background)) !important; }

/* ── Dark: surfaces ── */
${fp} .bg-white { background-color: rgb(var(--color-surface)) !important; }
${fp} .bg-white\\/90 { background-color: rgb(var(--color-surface) / 0.9) !important; }
${fp} .bg-white\\/80 { background-color: rgb(var(--color-surface) / 0.8) !important; }
${fp} .bg-white\\/50 { background-color: rgb(var(--color-surface) / 0.5) !important; }

${fp} .bg-gray-50 { background-color: rgb(var(--color-surface) / 0.5) !important; }
${fp} .bg-gray-50\\/30 { background-color: rgb(var(--color-surface) / 0.3) !important; }
${fp} .bg-gray-50\\/50 { background-color: rgb(var(--color-surface) / 0.5) !important; }
${fp} .bg-gray-50\\/60 { background-color: rgb(var(--color-surface) / 0.6) !important; }
${fp} .bg-gray-50\\/70 { background-color: rgb(var(--color-surface) / 0.7) !important; }

${fp} .bg-gray-100 { background-color: rgb(var(--color-primary) / 0.15) !important; }
${fp} .bg-gray-200 { background-color: rgb(var(--color-border)) !important; }
${fp} .bg-gray-900 { background-color: #0f172a !important; }

/* ── Dark: Accented surfaces ── */
${fp} .bg-amber-50 { background-color: rgb(var(--color-warning) / 0.15) !important; }
${fp} .bg-green-50  { background-color: rgb(var(--color-primary) / 0.15) !important; }
${fp} .bg-red-50    { background-color: rgb(var(--color-error) / 0.15) !important; }
${fp} .bg-pink-50   { background-color: rgb(236 72 153 / 0.15) !important; }
${fp} .bg-violet-50 { background-color: rgb(139 92 246 / 0.15) !important; }

/* ── Dark: Accented borders ── */
${fp} .border-amber-100, ${fp} .border-amber-200 { border-color: rgb(var(--color-warning) / 0.4) !important; }
${fp} .border-green-100, ${fp} .border-green-200 { border-color: rgb(var(--color-primary) / 0.4) !important; }
${fp} .border-red-100,   ${fp} .border-red-200   { border-color: rgb(var(--color-error) / 0.4) !important; }
${fp} .border-pink-200,  ${fp} .border-pink-300  { border-color: rgb(236 72 153 / 0.4) !important; }

/* ── Dark: gradient stops ── */
${fp} .from-white { --tw-gradient-from: rgb(var(--color-surface)) var(--tw-gradient-from-position) !important; }
${fp} .to-white   { --tw-gradient-to:   rgb(var(--color-surface)) var(--tw-gradient-to-position)   !important; }
${fp} .from-gray-50\\/50 { --tw-gradient-from: rgb(var(--color-surface) / 0.5) var(--tw-gradient-from-position) !important; }
${fp} .from-gray-50      { --tw-gradient-from: rgb(var(--color-surface)) var(--tw-gradient-from-position) !important; }
${fp} .to-gray-50        { --tw-gradient-to:   rgb(var(--color-surface)) var(--tw-gradient-to-position)   !important; }

/* ── Dark: borders ── */
${fp} .border-gray-50,
${fp} .border-gray-100 { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .border-gray-200 { border-color: rgb(var(--color-border)) !important; }
${fp} .border-white { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .border-gray-200\\/80 { border-color: rgb(var(--color-border) / 0.8) !important; }
${fp} .divide-gray-100 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .divide-gray-200 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(var(--color-border)) !important; }

/* ── Dark: text ── */
${fp} .text-white { color: white !important; }
${fp} .text-gray-900 { color: rgb(var(--color-foreground)) !important; }
${fp} .text-gray-800 { color: rgb(var(--color-foreground) / 0.95) !important; }
${fp} .text-gray-700 { color: rgb(var(--color-foreground-muted)) !important; }
${fp} .text-gray-600 { color: rgb(var(--color-foreground-muted)) !important; }
${fp} .text-gray-500 { color: rgb(var(--color-foreground-subtle)) !important; }
${fp} .text-gray-400 { color: rgb(var(--color-foreground-subtle) / 0.85) !important; }
${fp} .text-gray-300 { color: rgb(var(--color-foreground-subtle) / 0.6) !important; }

/* Accented text in Dark Mode */
${fp} .text-green-600, ${fp} .text-green-700 { color: rgb(var(--color-primary-light)) !important; }
${fp} .text-amber-600, ${fp} .text-amber-700 { color: rgb(var(--color-warning)) !important; }
${fp} .text-red-500,   ${fp} .text-red-600   { color: rgb(var(--color-error)) !important; }
${fp} .text-pink-500,  ${fp} .text-pink-600  { color: #fb7185 !important; }

/* ── Dark: hover bg ── */
${fp} .hover\\:bg-white:hover { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .hover\\:bg-gray-50:hover { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .hover\\:bg-gray-50\\/50:hover { background-color: rgb(var(--color-surface-hover) / 0.5) !important; }
${fp} .hover\\:bg-gray-100:hover { background-color: rgb(var(--color-primary) / 0.15) !important; }

/* ── Dark: inputs & forms ── */
${fp} input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
${fp} textarea,
${fp} select {
  background-color: rgb(var(--color-surface)) !important;
  color: rgb(var(--color-foreground)) !important;
  border-color: rgb(var(--color-border)) !important;
}
${fp} input::placeholder,
${fp} textarea::placeholder { color: rgb(var(--color-foreground-subtle)) !important; }
${fp} select option { background-color: rgb(var(--color-surface)); color: rgb(var(--color-foreground)); }

/* ── Dark: shadows ── */
${fp} .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4) !important; }
${fp} .shadow-md { box-shadow: 0 4px 6px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5) !important; }
${fp} .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5) !important; }
${fp} .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6), 0 8px 10px -6px rgba(0,0,0,0.5) !important; }
${fp} .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7) !important; }

/* ── Dark: scrollbar track ── */
::-webkit-scrollbar-track { background: rgb(var(--color-background)) !important; }

/* ── Dark: hardcoded green hex overrides ── */
${fp} .bg-\\[\\#16a34a\\] { background-color: rgb(var(--color-primary-hover)) !important; }
` : '';

  el.textContent = `:root {\n${vars}\n}${base}${dark}`;
  document.documentElement.setAttribute('data-site-theme', theme.id);
  if (theme.isDark) {
    document.documentElement.setAttribute('data-site-dark', 'true');
  } else {
    document.documentElement.removeAttribute('data-site-dark');
  }
}
