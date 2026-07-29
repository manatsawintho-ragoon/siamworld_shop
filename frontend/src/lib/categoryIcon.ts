import {
  Award,
  Axe,
  Backpack,
  Box,
  Boxes,
  Circle,
  Coins,
  Crown,
  Diamond,
  Flame,
  Gem,
  Gift,
  Hammer,
  Heart,
  Key,
  Layers,
  Leaf,
  type LucideIcon,
  Package,
  Rocket,
  Scroll,
  Shield,
  ShoppingBag,
  Skull,
  Sparkles,
  Star,
  Sword,
  Swords,
  Ticket,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';

/**
 * Shop categories store their icon as a Font Awesome class name: the admin form
 * is a free-text "Icon (FA class)" field, so the values in the wild are whatever
 * an owner typed. Rendering them meant shipping the Font Awesome CDN stylesheet
 * to every customer page, render-blocking, for this one control.
 *
 * The DB column keeps its FA names (no migration, no admin retraining); this map
 * resolves them to the Lucide set the rest of the customer UI already uses. The
 * names below cover the Minecraft-shop vocabulary owners actually reach for.
 * Anything unmapped falls back to `Box`, which is also what an unmapped FA class
 * effectively rendered as before: a blank square.
 */
const FA_TO_LUCIDE: Record<string, LucideIcon> = {
  'fa-award': Award,
  'fa-axe': Axe,
  'fa-backpack': Backpack,
  'fa-bolt': Zap,
  'fa-box': Box,
  'fa-boxes': Boxes,
  'fa-boxes-stacked': Boxes,
  'fa-circle': Circle,
  'fa-coins': Coins,
  'fa-crown': Crown,
  'fa-cube': Box,
  'fa-cubes': Boxes,
  'fa-diamond': Diamond,
  'fa-fire': Flame,
  'fa-gem': Gem,
  'fa-gift': Gift,
  'fa-hammer': Hammer,
  'fa-heart': Heart,
  'fa-key': Key,
  'fa-layer-group': Layers,
  'fa-leaf': Leaf,
  'fa-magic': Wand2,
  'fa-medal': Award,
  'fa-package': Package,
  'fa-rocket': Rocket,
  'fa-scroll': Scroll,
  'fa-shield': Shield,
  'fa-shield-halved': Shield,
  'fa-shopping-bag': ShoppingBag,
  'fa-skull': Skull,
  'fa-sparkles': Sparkles,
  'fa-star': Star,
  'fa-sword': Sword,
  'fa-swords': Swords,
  'fa-ticket': Ticket,
  'fa-trophy': Trophy,
  'fa-wand-magic-sparkles': Sparkles,
  'fa-wings': Sparkles,
  'fa-zap': Zap,
};

/**
 * Resolve a stored category icon to a Lucide component.
 *
 * Tolerates the shapes owners actually type: with or without the `fas `/`far `
 * style prefix, with or without the `fa-` prefix, and with stray whitespace or
 * casing.
 */
export function getCategoryIcon(name?: string | null): LucideIcon {
  if (!name) return Box;
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/\b(fas|far|fab|fal|fad)\b/g, '')
    .trim();
  const key = cleaned.startsWith('fa-') ? cleaned : `fa-${cleaned}`;
  return FA_TO_LUCIDE[key] ?? Box;
}
