/**
 * Package rarity tiers for the landing page.
 *
 * The shop frontend is a separate Next app, so its `frontend/src/lib/rarity.ts`
 * cannot be imported from here. These values are copied from it deliberately:
 * the landing page sells the loot-box product, so its pricing tiers use the
 * exact same colours players see in-game. If the shop's rarity palette ever
 * changes, mirror it here.
 *
 * Source of truth for the palette: `frontend/src/lib/rarity.ts`.
 */
import type { IconName } from '@/components/ui/icon';

export type TierKey = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface TierDef {
  /** Uppercase tier name shown in the badge. Conveys tier without relying on colour. */
  label: string;
  /** Hex used for the badge background, card border and glow. */
  color: string;
  /** Soft rgba of `color`, used for the hover/in-view glow shadow. */
  glow: string;
  icon: IconName;
}

export const TIERS: Record<TierKey, TierDef> = {
  common:    { label: 'COMMON',    color: '#64748b', glow: 'rgba(100,116,139,0.30)', icon: 'cube'   },
  uncommon:  { label: 'UNCOMMON',  color: '#16a34a', glow: 'rgba(22,163,74,0.32)',   icon: 'cubes'  },
  rare:      { label: 'RARE',      color: '#2563eb', glow: 'rgba(37,99,235,0.34)',   icon: 'swords' },
  epic:      { label: 'EPIC',      color: '#9333ea', glow: 'rgba(147,51,234,0.38)',  icon: 'gem'    },
  legendary: { label: 'LEGENDARY', color: '#f97316', glow: 'rgba(249,115,22,0.38)',  icon: 'crown'  },
};

export function getTier(key: TierKey): TierDef {
  return TIERS[key] ?? TIERS.common;
}
