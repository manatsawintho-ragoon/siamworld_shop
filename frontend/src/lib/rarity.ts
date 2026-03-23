/** Shared rarity config — matches admin panel RARITY_CONFIG style exactly */
export type RarityKey = 'mythic' | 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';

export interface RarityDef {
  label: string;
  /** Hex color — use for solid bg (backgroundColor: color) and borders */
  color: string;
  /** Glow for item card box-shadow */
  glow: string;
  /** Tailwind bg tint for item card background */
  cardBg: string;
}

export const RARITY: Record<string, RarityDef> = {
  mythic:    { label: 'MYTHIC',    color: '#dc2626', glow: 'rgba(220,38,38,0.35)',   cardBg: 'bg-red-50'    },
  legendary: { label: 'LEGENDARY', color: '#f97316', glow: 'rgba(249,115,22,0.35)',  cardBg: 'bg-orange-50' },
  epic:      { label: 'EPIC',      color: '#9333ea', glow: 'rgba(147,51,234,0.35)',  cardBg: 'bg-purple-50' },
  rare:      { label: 'RARE',      color: '#2563eb', glow: 'rgba(37,99,235,0.30)',   cardBg: 'bg-blue-50'   },
  uncommon:  { label: 'UNCOMMON',  color: '#16a34a', glow: 'rgba(22,163,74,0.30)',   cardBg: 'bg-green-50'  },
  common:    { label: 'COMMON',    color: '#64748b', glow: 'rgba(100,116,139,0.25)', cardBg: 'bg-slate-50'  },
};

export function getRarity(key?: string): RarityDef {
  return RARITY[(key || '').toLowerCase()] ?? RARITY.common;
}

/**
 * Render a solid rarity badge (matching admin panel style):
 * - Solid colored background
 * - White text + white dot
 * - Use as inline JSX: <RarityBadge rarity="mythic" />
 *
 * Badge pattern (inline JSX):
 *   const rar = getRarity(item.rarity);
 *   <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md text-white leading-none"
 *         style={{ backgroundColor: rar.color, boxShadow: `0 1px 0 ${rar.color}88` }}>
 *     <span className="w-1 h-1 rounded-sm bg-white/60 flex-shrink-0" />
 *     {rar.label}
 *   </span>
 */
