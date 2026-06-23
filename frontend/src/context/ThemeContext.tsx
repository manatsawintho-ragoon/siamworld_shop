'use client';
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSettings } from './SettingsContext';

export interface ThemeConfig {
  id: string;
  name: string;
  nameTh: string;
  isDark: boolean;
  /** Optional coarse hint — NOT used for rendering. The admin preview derives
   *  every colour from `vars` via themeSwatch() so it always matches the real
   *  site. Kept on the original themes for backward-compat only. */
  preview?: { from: string; to: string; accent: string; bg: string; };
  vars: Record<string, string>;
}

/* ──────────────────────────────────────────────────────────────────────
   Theme design rules:
   • LIGHT themes: subtle background tint, pure-white surfaces, neutral
     text hierarchy (slate-900 → slate-600 → slate-400), accent ≠ primary
     for variety.
   • DARK themes: deep neutral background, surface clearly elevated
     (16+ RGB lighter), neutral text (slate-100/300/500) NOT theme-tinted
     so hint text doesn't out-shout body text. Card borders are subtle
     (not saturated primary). Brighter primary (-400 family) for contrast.
   • Every theme defines its own --color-success/--color-error/--color-warning
     so dark themes don't inherit light-theme amber/red values that look
     wrong against dark backgrounds.
   ────────────────────────────────────────────────────────────────────── */

export const THEMES: ThemeConfig[] = [
  /* ═══════════════════════ LIGHT THEMES ═══════════════════════ */
  {
    id: 'minecraft-green',
    name: 'Minecraft Green',
    nameTh: 'ธีมเริ่มต้น',
    isDark: false,
    preview: { from: '#14532d', to: '#16a34a', accent: '#f59e0b', bg: '#f7fef9' },
    vars: {
      '--color-primary': '34 197 94',
      '--color-primary-hover': '22 163 74',
      '--color-primary-light': '134 239 172',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '20 83 45',
      '--color-primary-muted': '187 247 208',
      '--color-accent': '245 158 11',
      '--color-accent-hover': '217 119 6',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '247 254 250',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '240 253 244',
      '--color-border': '187 247 208',
      '--color-border-muted': '220 252 231',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#14532d',
      '--theme-banner-to': '#15803d',
      '--theme-card-shadow': '#bbf7d0',
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
    preview: { from: '#0c1445', to: '#1d4ed8', accent: '#14b8a6', bg: '#f5f9ff' },
    vars: {
      '--color-primary': '59 130 246',
      '--color-primary-hover': '37 99 235',
      '--color-primary-light': '147 197 253',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '30 58 138',
      '--color-primary-muted': '191 219 254',
      '--color-accent': '20 184 166',
      '--color-accent-hover': '13 148 136',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '245 249 255',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '239 246 255',
      '--color-border': '191 219 254',
      '--color-border-muted': '219 234 254',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '5 150 105',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#0c1a4a',
      '--theme-banner-to': '#1e40af',
      '--theme-card-shadow': '#bfdbfe',
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
    preview: { from: '#7c2d12', to: '#c2410c', accent: '#f43f5e', bg: '#fff7f0' },
    vars: {
      '--color-primary': '249 115 22',
      '--color-primary-hover': '234 88 12',
      '--color-primary-light': '253 186 116',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '124 45 18',
      '--color-primary-muted': '254 215 170',
      '--color-accent': '244 63 94',
      '--color-accent-hover': '225 29 72',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '255 250 245',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '255 247 237',
      '--color-border': '254 215 170',
      '--color-border-muted': '255 237 213',
      '--color-foreground': '23 12 6',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#7c2d12',
      '--theme-banner-to': '#c2410c',
      '--theme-card-shadow': '#fed7aa',
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
    preview: { from: '#2e1065', to: '#5b21b6', accent: '#ec4899', bg: '#faf7ff' },
    vars: {
      '--color-primary': '139 92 246',
      '--color-primary-hover': '124 58 237',
      '--color-primary-light': '196 181 253',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '76 29 149',
      '--color-primary-muted': '221 214 254',
      '--color-accent': '236 72 153',
      '--color-accent-hover': '219 39 119',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '250 247 255',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '245 243 255',
      '--color-border': '221 214 254',
      '--color-border-muted': '237 233 254',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#2e1065',
      '--theme-banner-to': '#5b21b6',
      '--theme-card-shadow': '#ddd6fe',
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
    preview: { from: '#500724', to: '#be185d', accent: '#fb7185', bg: '#fff7fb' },
    vars: {
      '--color-primary': '236 72 153',
      '--color-primary-hover': '219 39 119',
      '--color-primary-light': '249 168 212',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '157 23 77',
      '--color-primary-muted': '251 207 232',
      '--color-accent': '251 113 133',
      '--color-accent-hover': '244 63 94',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '255 247 251',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '253 242 248',
      '--color-border': '251 207 232',
      '--color-border-muted': '252 231 243',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#500724',
      '--theme-banner-to': '#be185d',
      '--theme-card-shadow': '#fbcfe8',
      '--theme-card-border': '#fbcfe8',
      '--theme-wallet-from': '#db2777',
      '--theme-wallet-to': '#500724',
    }
  },
  {
    id: 'golden-temple',
    name: 'Golden Temple',
    nameTh: 'วิหารทอง',
    isDark: false,
    preview: { from: '#451a03', to: '#78350f', accent: '#ef4444', bg: '#fffbf2' },
    vars: {
      '--color-primary': '245 158 11',
      '--color-primary-hover': '217 119 6',
      '--color-primary-light': '252 211 77',
      '--color-primary-foreground': '41 17 9',
      '--color-primary-shadow': '146 64 14',
      '--color-primary-muted': '253 230 138',
      '--color-accent': '239 68 68',
      '--color-accent-hover': '220 38 38',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '255 251 235',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '254 252 232',
      '--color-border': '253 230 138',
      '--color-border-muted': '254 240 138',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#451a03',
      '--theme-banner-to': '#92400e',
      '--theme-card-shadow': '#fde68a',
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
    preview: { from: '#0c4a6e', to: '#0369a1', accent: '#0ea5e9', bg: '#f3fdff' },
    vars: {
      '--color-primary': '6 182 212',
      '--color-primary-hover': '8 145 178',
      '--color-primary-light': '103 232 249',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '14 116 144',
      '--color-primary-muted': '165 243 252',
      '--color-accent': '14 165 233',
      '--color-accent-hover': '2 132 199',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '245 254 255',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '236 254 255',
      '--color-border': '165 243 252',
      '--color-border-muted': '207 250 254',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#0c4a6e',
      '--theme-banner-to': '#0369a1',
      '--theme-card-shadow': '#a5f3fc',
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
    preview: { from: '#450a0a', to: '#991b1b', accent: '#f59e0b', bg: '#fff7f7' },
    vars: {
      '--color-primary': '239 68 68',
      '--color-primary-hover': '220 38 38',
      '--color-primary-light': '252 165 165',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '127 29 29',
      '--color-primary-muted': '254 202 202',
      '--color-accent': '245 158 11',
      '--color-accent-hover': '217 119 6',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '255 247 247',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '254 242 242',
      '--color-border': '254 202 202',
      '--color-border-muted': '254 226 226',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#450a0a',
      '--theme-banner-to': '#991b1b',
      '--theme-card-shadow': '#fecaca',
      '--theme-card-border': '#fecaca',
      '--theme-wallet-from': '#dc2626',
      '--theme-wallet-to': '#450a0a',
    }
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    nameTh: 'ป่าเอเมอรัลด์',
    isDark: false,
    preview: { from: '#022c22', to: '#064e3b', accent: '#84cc16', bg: '#f6fdfa' },
    vars: {
      '--color-primary': '16 185 129',
      '--color-primary-hover': '5 150 105',
      '--color-primary-light': '110 231 183',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '6 95 70',
      '--color-primary-muted': '167 243 208',
      '--color-accent': '132 204 22',
      '--color-accent-hover': '101 163 13',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '246 253 250',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '236 253 245',
      '--color-border': '167 243 208',
      '--color-border-muted': '209 250 229',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '5 150 105',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#022c22',
      '--theme-banner-to': '#065f46',
      '--theme-card-shadow': '#a7f3d0',
      '--theme-card-border': '#a7f3d0',
      '--theme-wallet-from': '#059669',
      '--theme-wallet-to': '#022c22',
    }
  },
  {
    id: 'teal-lagoon',
    name: 'Teal Lagoon',
    nameTh: 'ทะเลสาบเทอร์ควอยซ์',
    isDark: false,
    vars: {
      '--color-primary': '20 184 166',
      '--color-primary-hover': '13 148 136',
      '--color-primary-light': '94 234 212',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '17 94 89',
      '--color-primary-muted': '153 246 228',
      '--color-accent': '6 182 212',
      '--color-accent-hover': '8 145 178',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '247 254 253',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '240 253 250',
      '--color-border': '153 246 228',
      '--color-border-muted': '204 251 241',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#134e4a',
      '--theme-banner-to': '#0f766e',
      '--theme-card-shadow': '#99f6e4',
      '--theme-card-border': '#99f6e4',
      '--theme-wallet-from': '#0d9488',
      '--theme-wallet-to': '#134e4a',
    }
  },
  {
    id: 'indigo-sky',
    name: 'Indigo Sky',
    nameTh: 'ครามนภา',
    isDark: false,
    vars: {
      '--color-primary': '99 102 241',
      '--color-primary-hover': '79 70 229',
      '--color-primary-light': '165 180 252',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '55 48 163',
      '--color-primary-muted': '199 210 254',
      '--color-accent': '14 165 233',
      '--color-accent-hover': '2 132 199',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '245 247 255',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '238 242 255',
      '--color-border': '199 210 254',
      '--color-border-muted': '224 231 255',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#1e1b4b',
      '--theme-banner-to': '#3730a3',
      '--theme-card-shadow': '#c7d2fe',
      '--theme-card-border': '#c7d2fe',
      '--theme-wallet-from': '#4f46e5',
      '--theme-wallet-to': '#1e1b4b',
    }
  },
  {
    id: 'lime-meadow',
    name: 'Lime Meadow',
    nameTh: 'ทุ่งมะนาว',
    isDark: false,
    vars: {
      '--color-primary': '101 163 13',
      '--color-primary-hover': '77 124 15',
      '--color-primary-light': '163 230 53',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '54 83 20',
      '--color-primary-muted': '217 249 157',
      '--color-accent': '16 185 129',
      '--color-accent-hover': '5 150 105',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '247 254 231',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '236 252 203',
      '--color-border': '217 249 157',
      '--color-border-muted': '236 252 203',
      '--color-foreground': '26 36 10',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#1a2e05',
      '--theme-banner-to': '#3f6212',
      '--theme-card-shadow': '#d9f99d',
      '--theme-card-border': '#d9f99d',
      '--theme-wallet-from': '#4d7c0f',
      '--theme-wallet-to': '#1a2e05',
    }
  },
  {
    id: 'coral-reef',
    name: 'Coral Reef',
    nameTh: 'ปะการังชมพู',
    isDark: false,
    vars: {
      '--color-primary': '244 63 94',
      '--color-primary-hover': '225 29 72',
      '--color-primary-light': '253 164 175',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '159 18 57',
      '--color-primary-muted': '254 205 211',
      '--color-accent': '249 115 22',
      '--color-accent-hover': '234 88 12',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '255 245 247',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '255 241 242',
      '--color-border': '254 205 211',
      '--color-border-muted': '255 228 230',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#4c0519',
      '--theme-banner-to': '#9f1239',
      '--theme-card-shadow': '#fecdd3',
      '--theme-card-border': '#fecdd3',
      '--theme-wallet-from': '#e11d48',
      '--theme-wallet-to': '#4c0519',
    }
  },
  {
    id: 'slate-stone',
    name: 'Slate Stone',
    nameTh: 'หินชนวน',
    isDark: false,
    vars: {
      '--color-primary': '71 85 105',
      '--color-primary-hover': '51 65 85',
      '--color-primary-light': '148 163 184',
      '--color-primary-foreground': '255 255 255',
      '--color-primary-shadow': '30 41 59',
      '--color-primary-muted': '203 213 225',
      '--color-accent': '59 130 246',
      '--color-accent-hover': '37 99 235',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '248 250 252',
      '--color-surface': '255 255 255',
      '--color-surface-hover': '241 245 249',
      '--color-border': '226 232 240',
      '--color-border-muted': '241 245 249',
      '--color-foreground': '15 23 42',
      '--color-foreground-muted': '71 85 105',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '22 163 74',
      '--color-error': '220 38 38',
      '--color-warning': '217 119 6',
      '--theme-banner-from': '#0f172a',
      '--theme-banner-to': '#334155',
      '--theme-card-shadow': '#e2e8f0',
      '--theme-card-border': '#e2e8f0',
      '--theme-wallet-from': '#475569',
      '--theme-wallet-to': '#0f172a',
    }
  },

  /* ═══════════════════════ DARK THEMES ═══════════════════════ */
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    nameTh: 'ไซเบอร์นีออน',
    isDark: true,
    preview: { from: '#050816', to: '#0f172a', accent: '#e879f9', bg: '#050816' },
    vars: {
      '--color-primary': '34 211 238',
      '--color-primary-hover': '6 182 212',
      '--color-primary-light': '103 232 249',
      '--color-primary-foreground': '8 8 22',
      '--color-primary-shadow': '8 145 178',
      '--color-primary-muted': '14 116 144',
      '--color-accent': '232 121 249',
      '--color-accent-hover': '217 70 239',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '5 8 22',
      '--color-surface': '15 23 42',
      '--color-surface-hover': '30 41 59',
      '--color-border': '30 41 59',
      '--color-border-muted': '15 23 42',
      '--color-foreground': '241 245 249',
      '--color-foreground-muted': '203 213 225',
      '--color-foreground-subtle': '100 116 139',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#020213',
      '--theme-banner-to': '#0c0c2e',
      '--theme-card-shadow': 'rgba(0,0,0,0.5)',
      '--theme-card-border': '#1f2937',
      '--theme-wallet-from': '#0891b2',
      '--theme-wallet-to': '#0c0c2e',
    }
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    nameTh: 'ราตรีคราม',
    isDark: true,
    preview: { from: '#07051a', to: '#1e1b4b', accent: '#f472b6', bg: '#0c0a1e' },
    vars: {
      '--color-primary': '129 140 248',
      '--color-primary-hover': '99 102 241',
      '--color-primary-light': '165 180 252',
      '--color-primary-foreground': '23 21 51',
      '--color-primary-shadow': '67 56 202',
      '--color-primary-muted': '55 48 163',
      '--color-accent': '244 114 182',
      '--color-accent-hover': '236 72 153',
      '--color-accent-foreground': '255 255 255',
      '--color-background': '12 10 30',
      '--color-surface': '26 22 51',
      '--color-surface-hover': '36 30 68',
      '--color-border': '45 38 84',
      '--color-border-muted': '26 22 51',
      '--color-foreground': '241 245 249',
      '--color-foreground-muted': '203 213 225',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#07051a',
      '--theme-banner-to': '#1e1b4b',
      '--theme-card-shadow': 'rgba(0,0,0,0.45)',
      '--theme-card-border': '#2d2654',
      '--theme-wallet-from': '#4338ca',
      '--theme-wallet-to': '#1e1b4b',
    }
  },
  {
    id: 'rose-dragon',
    name: 'Rose Dragon',
    nameTh: 'มังกรกุหลาบ',
    isDark: true,
    preview: { from: '#1a0d12', to: '#500724', accent: '#fbbf24', bg: '#1a0d12' },
    vars: {
      '--color-primary': '251 113 133',
      '--color-primary-hover': '244 63 94',
      '--color-primary-light': '253 164 175',
      '--color-primary-foreground': '24 8 14',
      '--color-primary-shadow': '159 18 57',
      '--color-primary-muted': '136 14 79',
      '--color-accent': '251 191 36',
      '--color-accent-hover': '245 158 11',
      '--color-accent-foreground': '24 8 14',
      '--color-background': '26 13 18',
      '--color-surface': '42 24 32',
      '--color-surface-hover': '58 37 48',
      '--color-border': '74 47 58',
      '--color-border-muted': '42 24 32',
      '--color-foreground': '250 250 250',
      '--color-foreground-muted': '212 212 216',
      '--color-foreground-subtle': '161 161 170',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#1a0d12',
      '--theme-banner-to': '#500724',
      '--theme-card-shadow': 'rgba(0,0,0,0.5)',
      '--theme-card-border': '#4a2f3a',
      '--theme-wallet-from': '#be123c',
      '--theme-wallet-to': '#1a0d12',
    }
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    nameTh: 'ออบซิเดียน',
    isDark: true,
    preview: { from: '#000000', to: '#18181b', accent: '#22d3ee', bg: '#09090b' },
    vars: {
      '--color-primary': '251 191 36',
      '--color-primary-hover': '245 158 11',
      '--color-primary-light': '252 211 77',
      '--color-primary-foreground': '24 16 0',
      '--color-primary-shadow': '180 83 9',
      '--color-primary-muted': '146 64 14',
      '--color-accent': '34 211 238',
      '--color-accent-hover': '6 182 212',
      '--color-accent-foreground': '8 8 22',
      '--color-background': '9 9 11',
      '--color-surface': '24 24 27',
      '--color-surface-hover': '39 39 42',
      '--color-border': '39 39 42',
      '--color-border-muted': '24 24 27',
      '--color-foreground': '250 250 250',
      '--color-foreground-muted': '212 212 216',
      '--color-foreground-subtle': '161 161 170',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#000000',
      '--theme-banner-to': '#0c0c0c',
      '--theme-card-shadow': 'rgba(0,0,0,0.6)',
      '--theme-card-border': '#27272a',
      '--theme-wallet-from': '#d97706',
      '--theme-wallet-to': '#1c1917',
    }
  },
  {
    id: 'verdant-night',
    name: 'Verdant Night',
    nameTh: 'ราตรีพฤกษ์',
    isDark: true,
    preview: { from: '#022c22', to: '#064e3b', accent: '#facc15', bg: '#0a1410' },
    vars: {
      '--color-primary': '52 211 153',
      '--color-primary-hover': '16 185 129',
      '--color-primary-light': '110 231 183',
      '--color-primary-foreground': '4 27 19',
      '--color-primary-shadow': '6 95 70',
      '--color-primary-muted': '6 78 59',
      '--color-accent': '250 204 21',
      '--color-accent-hover': '234 179 8',
      '--color-accent-foreground': '40 25 0',
      '--color-background': '10 20 16',
      '--color-surface': '17 32 25',
      '--color-surface-hover': '26 46 37',
      '--color-border': '31 58 46',
      '--color-border-muted': '17 32 25',
      '--color-foreground': '240 253 244',
      '--color-foreground-muted': '187 247 208',
      '--color-foreground-subtle': '134 239 172',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#022c22',
      '--theme-banner-to': '#064e3b',
      '--theme-card-shadow': 'rgba(0,0,0,0.45)',
      '--theme-card-border': '#1f3a2e',
      '--theme-wallet-from': '#059669',
      '--theme-wallet-to': '#022c22',
    }
  },
  {
    id: 'abyssal-blue',
    name: 'Abyssal Blue',
    nameTh: 'ห้วงสมุทรคราม',
    isDark: true,
    vars: {
      '--color-primary': '96 165 250',
      '--color-primary-hover': '59 130 246',
      '--color-primary-light': '147 197 253',
      '--color-primary-foreground': '7 14 30',
      '--color-primary-shadow': '30 58 138',
      '--color-primary-muted': '30 64 175',
      '--color-accent': '56 189 248',
      '--color-accent-hover': '14 165 233',
      '--color-accent-foreground': '8 14 30',
      '--color-background': '8 13 25',
      '--color-surface': '17 24 45',
      '--color-surface-hover': '26 35 60',
      '--color-border': '31 41 71',
      '--color-border-muted': '17 24 45',
      '--color-foreground': '241 245 249',
      '--color-foreground-muted': '203 213 225',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#060a18',
      '--theme-banner-to': '#16234a',
      '--theme-card-shadow': 'rgba(0,0,0,0.5)',
      '--theme-card-border': '#1f2947',
      '--theme-wallet-from': '#1d4ed8',
      '--theme-wallet-to': '#0a1228',
    }
  },
  {
    id: 'void-purple',
    name: 'Void Purple',
    nameTh: 'สุญญากาศม่วง',
    isDark: true,
    vars: {
      '--color-primary': '167 139 250',
      '--color-primary-hover': '139 92 246',
      '--color-primary-light': '196 181 253',
      '--color-primary-foreground': '24 16 43',
      '--color-primary-shadow': '91 33 182',
      '--color-primary-muted': '76 29 149',
      '--color-accent': '232 121 249',
      '--color-accent-hover': '217 70 239',
      '--color-accent-foreground': '24 8 30',
      '--color-background': '18 12 32',
      '--color-surface': '31 23 51',
      '--color-surface-hover': '43 32 68',
      '--color-border': '54 41 84',
      '--color-border-muted': '31 23 51',
      '--color-foreground': '245 243 255',
      '--color-foreground-muted': '214 207 240',
      '--color-foreground-subtle': '161 153 196',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#14082e',
      '--theme-banner-to': '#3b0764',
      '--theme-card-shadow': 'rgba(0,0,0,0.5)',
      '--theme-card-border': '#362956',
      '--theme-wallet-from': '#7c3aed',
      '--theme-wallet-to': '#1e1235',
    }
  },
  {
    id: 'ember-ash',
    name: 'Ember Ash',
    nameTh: 'ขี้เถ้าถ่านไฟ',
    isDark: true,
    vars: {
      '--color-primary': '251 146 60',
      '--color-primary-hover': '249 115 22',
      '--color-primary-light': '253 186 116',
      '--color-primary-foreground': '28 16 4',
      '--color-primary-shadow': '154 52 18',
      '--color-primary-muted': '124 45 18',
      '--color-accent': '250 204 21',
      '--color-accent-hover': '234 179 8',
      '--color-accent-foreground': '40 25 0',
      '--color-background': '18 16 14',
      '--color-surface': '32 28 25',
      '--color-surface-hover': '45 39 35',
      '--color-border': '58 50 44',
      '--color-border-muted': '32 28 25',
      '--color-foreground': '250 250 249',
      '--color-foreground-muted': '214 211 209',
      '--color-foreground-subtle': '168 162 158',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#1c1410',
      '--theme-banner-to': '#7c2d12',
      '--theme-card-shadow': 'rgba(0,0,0,0.55)',
      '--theme-card-border': '#3a322c',
      '--theme-wallet-from': '#ea580c',
      '--theme-wallet-to': '#1c1008',
    }
  },
  {
    id: 'crimson-eclipse',
    name: 'Crimson Eclipse',
    nameTh: 'สุริยุปราคาเลือด',
    isDark: true,
    vars: {
      '--color-primary': '248 113 113',
      '--color-primary-hover': '239 68 68',
      '--color-primary-light': '252 165 165',
      '--color-primary-foreground': '32 8 8',
      '--color-primary-shadow': '153 27 27',
      '--color-primary-muted': '127 29 29',
      '--color-accent': '251 191 36',
      '--color-accent-hover': '245 158 11',
      '--color-accent-foreground': '32 16 0',
      '--color-background': '17 11 11',
      '--color-surface': '31 21 21',
      '--color-surface-hover': '45 31 31',
      '--color-border': '58 40 40',
      '--color-border-muted': '31 21 21',
      '--color-foreground': '250 248 248',
      '--color-foreground-muted': '214 209 209',
      '--color-foreground-subtle': '168 160 160',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#1a0a0a',
      '--theme-banner-to': '#7f1d1d',
      '--theme-card-shadow': 'rgba(0,0,0,0.55)',
      '--theme-card-border': '#3a2828',
      '--theme-wallet-from': '#dc2626',
      '--theme-wallet-to': '#1a0808',
    }
  },
  {
    id: 'slate-graphite',
    name: 'Slate Graphite',
    nameTh: 'กราไฟต์เทา',
    isDark: true,
    vars: {
      '--color-primary': '203 213 225',
      '--color-primary-hover': '148 163 184',
      '--color-primary-light': '226 232 240',
      '--color-primary-foreground': '15 23 42',
      '--color-primary-shadow': '51 65 85',
      '--color-primary-muted': '71 85 105',
      '--color-accent': '56 189 248',
      '--color-accent-hover': '14 165 233',
      '--color-accent-foreground': '8 14 30',
      '--color-background': '15 18 24',
      '--color-surface': '26 31 41',
      '--color-surface-hover': '38 45 58',
      '--color-border': '51 60 74',
      '--color-border-muted': '26 31 41',
      '--color-foreground': '248 250 252',
      '--color-foreground-muted': '203 213 225',
      '--color-foreground-subtle': '148 163 184',
      '--color-success': '52 211 153',
      '--color-error': '248 113 113',
      '--color-warning': '251 191 36',
      '--theme-banner-from': '#0b0f16',
      '--theme-banner-to': '#1e293b',
      '--theme-card-shadow': 'rgba(0,0,0,0.5)',
      '--theme-card-border': '#2a323f',
      '--theme-wallet-from': '#475569',
      '--theme-wallet-to': '#0b0f16',
    }
  },
];

export const DEFAULT_THEME_ID = 'minecraft-green';

/* ──────────────────────────────────────────────────────────────────────
   themeSwatch — single source of truth for previews.
   Every colour is derived from the theme's real CSS `vars`, so anything an
   admin sees in the Appearance preview is exactly what renders on the live
   site (primary buttons, banner gradient, wallet card, text hierarchy …).
   ────────────────────────────────────────────────────────────────────── */
export interface ThemeSwatch {
  isDark: boolean;
  background: string; surface: string; surfaceHover: string;
  primary: string; primaryHover: string; primaryLight: string; primaryFg: string;
  accent: string; accentFg: string;
  foreground: string; foregroundMuted: string; foregroundSubtle: string;
  border: string;
  /** price text colour — mirrors .theme-price-text (light: hover, dark: light) */
  price: string;
  bannerFrom: string; bannerTo: string;
  walletFrom: string; walletTo: string;
}

export function themeSwatch(t: ThemeConfig): ThemeSwatch {
  const c = (k: string, fallback = '0 0 0') => `rgb(${t.vars[k] ?? fallback})`;
  const raw = (k: string, fallback = '#000000') => t.vars[k] ?? fallback;
  return {
    isDark: t.isDark,
    background: c('--color-background', '255 255 255'),
    surface: c('--color-surface', '255 255 255'),
    surfaceHover: c('--color-surface-hover', '244 244 245'),
    primary: c('--color-primary'),
    primaryHover: c('--color-primary-hover'),
    primaryLight: c('--color-primary-light'),
    primaryFg: c('--color-primary-foreground', '255 255 255'),
    accent: c('--color-accent'),
    accentFg: c('--color-accent-foreground', '255 255 255'),
    foreground: c('--color-foreground', '15 23 42'),
    foregroundMuted: c('--color-foreground-muted', '71 85 105'),
    foregroundSubtle: c('--color-foreground-subtle', '148 163 184'),
    border: c('--color-border', '226 232 240'),
    price: t.isDark ? c('--color-primary-light') : c('--color-primary-hover'),
    bannerFrom: raw('--theme-banner-from'),
    bannerTo: raw('--theme-banner-to'),
    walletFrom: raw('--theme-wallet-from'),
    walletTo: raw('--theme-wallet-to'),
  };
}

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

/* Wallet highlight card greens (profile + sidebar) */
${fp} .bg-\\[\\#168d41\\] { background-color: rgb(var(--color-primary-hover)) !important; }
${fp} .shadow-\\[0_4px_0_\\#0f6530\\] { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_4px_0_\\#0f6530\\,0_2px_24px_rgba\\(22\\,141\\,65\\,0\\.45\\)\\] { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)), 0 2px 24px rgb(var(--color-primary) / 0.35) !important; }
${fp} .border-\\[\\#1faa4f\\]\\/30 { border-color: rgb(var(--color-primary-light) / 0.3) !important; }

/* Other green button-shadow variants */
${fp} .shadow-\\[0_4px_0_\\#15803d\\] { box-shadow: 0 4px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_2px_0_\\#15803d\\] { box-shadow: 0 2px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .shadow-\\[0_3px_0_\\#15803d\\] { box-shadow: 0 3px 0 rgb(var(--color-primary-shadow)) !important; }
${fp} .bg-\\[\\#15803d\\] { background-color: rgb(var(--color-primary-hover)) !important; }
${fp} .border-\\[\\#22c55e\\] { border-color: rgb(var(--color-primary)) !important; }

/* Red/Amber button shadows (light themes only — dark overrides below) */
${fp} .shadow-\\[0_4px_0_rgb\\(217\\,119\\,6\\)\\] { box-shadow: 0 4px 0 rgb(var(--color-warning) / 0.8) !important; }
${fp} .shadow-\\[0_4px_0_rgb\\(31\\,41\\,55\\)\\] { box-shadow: 0 4px 0 rgba(0,0,0,0.4) !important; }
${fp} .shadow-\\[0_3px_0_\\#d1d5db\\] { box-shadow: 0 3px 0 rgb(var(--color-border)) !important; }
${fp} .shadow-\\[0_4px_0_\\#e5e7eb\\] { box-shadow: 0 4px 0 rgb(var(--color-border)) !important; }
${fp} .shadow-\\[0_2px_0_\\#e5e7eb\\] { box-shadow: 0 2px 0 rgb(var(--color-border)) !important; }
`;

  const dark = theme.isDark ? `
/* ── Dark: page bg ── */
body { background-color: rgb(var(--color-background)) !important; color: rgb(var(--color-foreground)) !important; }

/* ── Dark: surfaces (clear elevation hierarchy) ── */
${fp} .bg-white { background-color: rgb(var(--color-surface)) !important; }
${fp} .bg-white\\/90 { background-color: rgb(var(--color-surface) / 0.9) !important; }
${fp} .bg-white\\/80 { background-color: rgb(var(--color-surface) / 0.8) !important; }
${fp} .bg-white\\/50 { background-color: rgb(var(--color-surface) / 0.5) !important; }

${fp} .bg-gray-50 { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .bg-gray-50\\/30 { background-color: rgb(var(--color-surface-hover) / 0.3) !important; }
${fp} .bg-gray-50\\/40 { background-color: rgb(var(--color-surface-hover) / 0.4) !important; }
${fp} .bg-gray-50\\/50 { background-color: rgb(var(--color-surface-hover) / 0.5) !important; }
${fp} .bg-gray-50\\/60 { background-color: rgb(var(--color-surface-hover) / 0.6) !important; }
${fp} .bg-gray-50\\/70 { background-color: rgb(var(--color-surface-hover) / 0.7) !important; }
${fp} .bg-gray-100 { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .bg-gray-200 { background-color: rgb(var(--color-border)) !important; }
${fp} .bg-gray-900 { background-color: rgb(var(--color-surface)) !important; }
${fp} .bg-slate-50, ${fp} .bg-slate-50\\/40 { background-color: rgb(var(--color-surface-hover) / 0.5) !important; }

/* ── Dark: accented surfaces — use theme semantic colors ── */
${fp} .bg-amber-50 { background-color: rgb(var(--color-warning) / 0.15) !important; }
${fp} .bg-amber-100 { background-color: rgb(var(--color-warning) / 0.2) !important; }
${fp} .bg-yellow-50 { background-color: rgb(var(--color-warning) / 0.15) !important; }
${fp} .bg-yellow-100 { background-color: rgb(var(--color-warning) / 0.2) !important; }
${fp} .bg-green-50  { background-color: rgb(var(--color-success) / 0.15) !important; }
${fp} .bg-green-100 { background-color: rgb(var(--color-success) / 0.2) !important; }
${fp} .bg-emerald-50 { background-color: rgb(var(--color-success) / 0.15) !important; }
${fp} .bg-emerald-100 { background-color: rgb(var(--color-success) / 0.2) !important; }
${fp} .bg-red-50    { background-color: rgb(var(--color-error) / 0.15) !important; }
${fp} .bg-red-100   { background-color: rgb(var(--color-error) / 0.2) !important; }
${fp} .bg-rose-50   { background-color: rgb(var(--color-error) / 0.15) !important; }
${fp} .bg-pink-50   { background-color: rgb(var(--color-accent) / 0.15) !important; }
${fp} .bg-pink-100  { background-color: rgb(var(--color-accent) / 0.2) !important; }
${fp} .bg-violet-50 { background-color: rgb(var(--color-accent) / 0.15) !important; }
${fp} .bg-violet-100 { background-color: rgb(var(--color-accent) / 0.2) !important; }
${fp} .bg-blue-50   { background-color: rgb(59 130 246 / 0.15) !important; }
${fp} .bg-blue-100  { background-color: rgb(59 130 246 / 0.2) !important; }
${fp} .bg-indigo-50, ${fp} .bg-indigo-100 { background-color: rgb(99 102 241 / 0.18) !important; }
${fp} .bg-sky-50, ${fp} .bg-sky-100 { background-color: rgb(56 189 248 / 0.18) !important; }
${fp} .bg-cyan-50, ${fp} .bg-cyan-100 { background-color: rgb(34 211 238 / 0.18) !important; }
${fp} .bg-teal-50, ${fp} .bg-teal-100 { background-color: rgb(45 212 191 / 0.18) !important; }
${fp} .bg-orange-50 { background-color: rgb(var(--color-warning) / 0.15) !important; }
${fp} .bg-orange-100 { background-color: rgb(var(--color-warning) / 0.2) !important; }
${fp} .bg-purple-50 { background-color: rgb(var(--color-accent) / 0.15) !important; }
${fp} .bg-purple-100 { background-color: rgb(var(--color-accent) / 0.2) !important; }

/* ── Dark: accented borders ── */
${fp} .border-amber-100, ${fp} .border-amber-200 { border-color: rgb(var(--color-warning) / 0.4) !important; }
${fp} .border-green-100, ${fp} .border-green-200 { border-color: rgb(var(--color-success) / 0.4) !important; }
${fp} .border-red-100,   ${fp} .border-red-200   { border-color: rgb(var(--color-error) / 0.4) !important; }
${fp} .border-pink-200,  ${fp} .border-pink-300  { border-color: rgb(var(--color-accent) / 0.4) !important; }
${fp} .border-blue-100,  ${fp} .border-blue-200  { border-color: rgb(59 130 246 / 0.4) !important; }
${fp} .border-orange-100, ${fp} .border-orange-200 { border-color: rgb(var(--color-warning) / 0.4) !important; }
${fp} .border-violet-100, ${fp} .border-violet-200 { border-color: rgb(var(--color-accent) / 0.4) !important; }

/* ── Dark: gradient stops ── */
${fp} .from-white { --tw-gradient-from: rgb(var(--color-surface)) var(--tw-gradient-from-position) !important; }
${fp} .to-white   { --tw-gradient-to:   rgb(var(--color-surface)) var(--tw-gradient-to-position)   !important; }
${fp} .from-gray-50\\/50 { --tw-gradient-from: rgb(var(--color-surface-hover) / 0.5) var(--tw-gradient-from-position) !important; }
${fp} .from-gray-50      { --tw-gradient-from: rgb(var(--color-surface-hover)) var(--tw-gradient-from-position) !important; }
${fp} .to-gray-50        { --tw-gradient-to:   rgb(var(--color-surface-hover)) var(--tw-gradient-to-position)   !important; }
${fp} .from-gray-800, ${fp} .via-gray-800, ${fp} .to-gray-800 { --tw-gradient-from: rgb(var(--color-surface-hover)) var(--tw-gradient-from-position) !important; }

/* ── Dark: borders ── */
${fp} .border-gray-50,
${fp} .border-gray-100 { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .border-gray-200 { border-color: rgb(var(--color-border)) !important; }
${fp} .border-white { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .border-gray-200\\/70,
${fp} .border-gray-200\\/80 { border-color: rgb(var(--color-border) / 0.8) !important; }
${fp} .divide-gray-50  > :not([hidden]) ~ :not([hidden]) { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .divide-gray-100 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(var(--color-border-muted)) !important; }
${fp} .divide-gray-200 > :not([hidden]) ~ :not([hidden]) { border-color: rgb(var(--color-border)) !important; }

/* ── Dark: text — neutral hierarchy (NOT theme-tinted for subtle text) ── */
${fp} .text-white { color: white !important; }
${fp} .text-gray-900 { color: rgb(var(--color-foreground)) !important; }
${fp} .text-gray-800 { color: rgb(var(--color-foreground) / 0.95) !important; }
${fp} .text-gray-700 { color: rgb(var(--color-foreground-muted)) !important; }
${fp} .text-gray-600 { color: rgb(var(--color-foreground-muted)) !important; }
${fp} .text-gray-500 { color: rgb(var(--color-foreground-subtle)) !important; }
${fp} .text-gray-400 { color: rgb(var(--color-foreground-muted) / 0.9) !important; }
${fp} .text-gray-300 { color: rgb(var(--color-foreground-muted) / 0.8) !important; }
${fp} .text-gray-200 { color: rgb(var(--color-foreground-muted) / 0.7) !important; }
${fp} .text-slate-50, ${fp} .text-slate-100 { color: rgb(var(--color-foreground)) !important; }
${fp} .text-slate-500, ${fp} .text-slate-600 { color: rgb(var(--color-foreground-subtle)) !important; }

/* Accented text in Dark Mode — bright/saturated semantic colors so deep shades
   (text-*-700/-800) don't blend with the dark surface */
${fp} .text-green-600, ${fp} .text-green-700, ${fp} .text-green-800 { color: rgb(var(--color-success)) !important; }
${fp} .text-emerald-500, ${fp} .text-emerald-600, ${fp} .text-emerald-700, ${fp} .text-emerald-800 { color: rgb(var(--color-success)) !important; }
${fp} .text-lime-600, ${fp} .text-lime-700 { color: rgb(var(--color-success)) !important; }
${fp} .text-amber-500, ${fp} .text-amber-600, ${fp} .text-amber-700, ${fp} .text-amber-800 { color: rgb(var(--color-warning)) !important; }
${fp} .text-yellow-500, ${fp} .text-yellow-600, ${fp} .text-yellow-700, ${fp} .text-yellow-800 { color: rgb(var(--color-warning)) !important; }
${fp} .text-orange-400, ${fp} .text-orange-500, ${fp} .text-orange-600, ${fp} .text-orange-700, ${fp} .text-orange-800 { color: rgb(var(--color-warning)) !important; }
${fp} .text-red-400, ${fp} .text-red-500, ${fp} .text-red-600, ${fp} .text-red-700, ${fp} .text-red-800 { color: rgb(var(--color-error)) !important; }
${fp} .text-rose-500, ${fp} .text-rose-600, ${fp} .text-rose-700 { color: rgb(var(--color-error)) !important; }
${fp} .text-pink-500, ${fp} .text-pink-600, ${fp} .text-pink-700, ${fp} .text-pink-800 { color: rgb(var(--color-accent)) !important; }
${fp} .text-violet-400, ${fp} .text-violet-500, ${fp} .text-violet-600, ${fp} .text-violet-700, ${fp} .text-violet-800 { color: rgb(var(--color-accent)) !important; }
${fp} .text-purple-400, ${fp} .text-purple-500, ${fp} .text-purple-600, ${fp} .text-purple-700, ${fp} .text-purple-800 { color: rgb(var(--color-accent)) !important; }
${fp} .text-fuchsia-500, ${fp} .text-fuchsia-600 { color: rgb(var(--color-accent)) !important; }
${fp} .text-indigo-400, ${fp} .text-indigo-500, ${fp} .text-indigo-600, ${fp} .text-indigo-700 { color: rgb(129 140 248) !important; }
${fp} .text-blue-300, ${fp} .text-blue-400, ${fp} .text-blue-500, ${fp} .text-blue-600, ${fp} .text-blue-700, ${fp} .text-blue-800 { color: rgb(96 165 250) !important; }
${fp} .text-sky-500, ${fp} .text-sky-600, ${fp} .text-sky-700 { color: rgb(56 189 248) !important; }
${fp} .text-cyan-500, ${fp} .text-cyan-600, ${fp} .text-cyan-700 { color: rgb(34 211 238) !important; }
${fp} .text-teal-500, ${fp} .text-teal-600, ${fp} .text-teal-700 { color: rgb(45 212 191) !important; }

/* Hover/group-hover variants — must restate so deep shades don't sneak back in */
${fp} .hover\\:text-amber-600:hover, ${fp} .hover\\:text-amber-700:hover { color: rgb(var(--color-warning)) !important; }
${fp} .hover\\:text-orange-600:hover, ${fp} .hover\\:text-orange-700:hover { color: rgb(var(--color-warning)) !important; }
${fp} .hover\\:text-red-600:hover, ${fp} .hover\\:text-red-700:hover { color: rgb(var(--color-error)) !important; }
${fp} .hover\\:text-pink-500:hover, ${fp} .hover\\:text-pink-600:hover { color: rgb(var(--color-accent)) !important; }
${fp} .hover\\:text-violet-500:hover, ${fp} .hover\\:text-violet-600:hover { color: rgb(var(--color-accent)) !important; }
${fp} .hover\\:text-blue-700:hover, ${fp} .hover\\:text-blue-800:hover { color: rgb(96 165 250) !important; }
${fp} .group:hover .group-hover\\:text-amber-300 { color: rgb(var(--color-warning)) !important; }
${fp} .group:hover .group-hover\\:text-amber-600 { color: rgb(var(--color-warning)) !important; }
${fp} .group:hover .group-hover\\:text-green-600 { color: rgb(var(--color-primary)) !important; }
${fp} .group:hover .group-hover\\:text-primary { color: rgb(var(--color-primary)) !important; }

/* ── Dark: hover bg ── */
${fp} .hover\\:bg-white:hover { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .hover\\:bg-gray-50:hover { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .hover\\:bg-gray-50\\/50:hover { background-color: rgb(var(--color-surface-hover) / 0.5) !important; }
${fp} .hover\\:bg-gray-50\\/60:hover { background-color: rgb(var(--color-surface-hover) / 0.6) !important; }
${fp} .hover\\:bg-gray-100:hover { background-color: rgb(var(--color-primary) / 0.15) !important; }

/* ── Dark: inputs & forms ── */
${fp} input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
${fp} textarea,
${fp} select {
  background-color: rgb(var(--color-surface-hover)) !important;
  color: rgb(var(--color-foreground)) !important;
  border-color: rgb(var(--color-border)) !important;
}
${fp} input::placeholder,
${fp} textarea::placeholder { color: rgb(var(--color-foreground-subtle)) !important; }
${fp} select option { background-color: rgb(var(--color-surface)); color: rgb(var(--color-foreground)); }

/* ── Dark: shadows — deeper, no blown-out tints ── */
${fp} .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4) !important; }
${fp} .shadow-md { box-shadow: 0 4px 6px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5) !important; }
${fp} .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5) !important; }
${fp} .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6), 0 8px 10px -6px rgba(0,0,0,0.5) !important; }
${fp} .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.75) !important; }
/* the big themed card shadow #c5cad3 should be subtle on dark — match border */
${fp} .shadow-\\[0_4px_0_\\#c5cad3\\] { box-shadow: 0 4px 0 rgb(var(--color-border)), 0 2px 16px rgba(0,0,0,0.4) !important; }

/* ── Dark: scrollbar track ── */
::-webkit-scrollbar-track { background: rgb(var(--color-background)) !important; }

/* ── Dark: hardcoded green hex overrides ── */
${fp} .bg-\\[\\#16a34a\\] { background-color: rgb(var(--color-primary-hover)) !important; }

/* ── Dark: blue-tinted backgrounds that often appear for "info" sections ── */
${fp} .bg-\\[\\#1e2735\\] { background-color: rgb(var(--color-surface-hover)) !important; }
${fp} .bg-\\[\\#0c1a4a\\], ${fp} .bg-\\[\\#003b80\\] { background-color: rgb(var(--color-surface-hover)) !important; }

/* ── Dark: high-contrast price text — primary-light pops harder on dark surfaces than primary-hover ── */
${fp} .theme-price-text { color: rgb(var(--color-primary-light)) !important; text-shadow: 0 0 12px rgb(var(--color-primary) / 0.35); }

/* ── Dark: buy button — keep bright primary→primary-light gradient and force readable text ── */
${fp} .btn-buy {
  background: linear-gradient(to bottom, rgb(var(--color-primary-light)), rgb(var(--color-primary))) !important;
  color: rgb(var(--color-primary-foreground)) !important;
  box-shadow: 0 4px 0 rgba(0,0,0,0.6), 0 0 18px rgb(var(--color-primary) / 0.45), inset 0 1px 0 rgba(255,255,255,0.22) !important;
  text-shadow: 0 1px 0 rgba(255,255,255,0.25) !important;
}
${fp} .btn-buy:hover {
  background: linear-gradient(to bottom, rgb(var(--color-primary-light)), rgb(var(--color-primary))) !important;
  filter: brightness(1.12);
  box-shadow: 0 2px 0 rgba(0,0,0,0.6), 0 0 22px rgb(var(--color-primary) / 0.55) !important;
}

/* ── Dark: theme-price-badge — brighter gradient + glow + readable text ── */
${fp} .theme-price-badge {
  background: linear-gradient(135deg, rgb(var(--color-primary-light)), rgb(var(--color-primary))) !important;
  color: rgb(var(--color-primary-foreground)) !important;
  box-shadow: 0 2px 14px rgba(0,0,0,0.55), 0 0 0 1px rgb(var(--color-primary) / 0.5), 0 0 22px rgb(var(--color-primary) / 0.35), inset 0 1px 0 rgba(255,255,255,0.22) !important;
  text-shadow: 0 1px 0 rgba(255,255,255,0.2);
}

/* ── Dark: nav links — make labels clearly visible (default is foreground-muted, but force a brighter baseline) ── */
.mc-nav-link { color: rgb(var(--color-foreground) / 0.85) !important; }
.mc-nav-link:hover { color: rgb(var(--color-primary-light)) !important; }
.mc-nav-link.active { color: rgb(var(--color-primary-light)) !important; }
.mc-nav-link::after { background-color: rgb(var(--color-primary-light)) !important; }

/* ── Dark: amber/red/green accented borders that aren't already covered above ── */
${fp} .border-emerald-100, ${fp} .border-emerald-200 { border-color: rgb(var(--color-success) / 0.4) !important; }
${fp} .border-yellow-100, ${fp} .border-yellow-200 { border-color: rgb(var(--color-warning) / 0.4) !important; }
${fp} .border-rose-100, ${fp} .border-rose-200 { border-color: rgb(var(--color-error) / 0.4) !important; }
${fp} .border-purple-100, ${fp} .border-purple-200 { border-color: rgb(var(--color-accent) / 0.4) !important; }
${fp} .border-pink-100 { border-color: rgb(var(--color-accent) / 0.4) !important; }

/* ── Dark: white/light pill-style backdrops that lose contrast on dark (used as floating badges over images) ── */
${fp} .bg-white\\/90 { background-color: rgb(var(--color-surface) / 0.92) !important; }
${fp} .bg-surface\\/90 { background-color: rgb(var(--color-surface) / 0.92) !important; }
` : '';

  el.textContent = `:root {\n${vars}\n}${base}${dark}`;
  document.documentElement.setAttribute('data-site-theme', theme.id);
  if (theme.isDark) {
    document.documentElement.setAttribute('data-site-dark', 'true');
  } else {
    document.documentElement.removeAttribute('data-site-dark');
  }
}
