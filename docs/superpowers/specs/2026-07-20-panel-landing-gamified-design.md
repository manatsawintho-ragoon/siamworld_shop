# Panel landing page: gamified redesign

Date: 2026-07-20
Status: implemented

## Goal

Make `panel.siamsite.shop` read as a game-adjacent product without losing B2B
credibility: package tiers as loot rarities, a livelier customer marquee,
richer package descriptions, and scroll/hover motion in the spirit of
mcsv.me.

## Background

Commit `8a64d54` (same day) had already promoted the customer marquee to a
full-bleed band, added scroll-driven motion, and **removed** per-card feature
lists from pricing. Two parts of this request pointed the other way, so both
were resolved with the user before implementing:

- **Marquee placement**: stays where `8a64d54` put it (band under the hero).
  It gets a gamified skin rather than moving back into the hero column.
- **Package descriptions**: `8a64d54` was right that 18 duplicate lines buried
  the prices, but the cards ended up too thin to sell. Cards now carry an
  audience line plus four plan-specific points; the shared list still appears
  once below the grid.

## Decisions

### Rarity tiers

Packages map to the shop's rarity palette so the landing page uses the same
colour language players see in-game:

| Package | Tier | Colour |
|---|---|---|
| Trial 7 days | COMMON | `#64748b` |
| ฿99 first month (promo) | EPIC | `#9333ea` |
| Long-term plan | LEGENDARY | `#f97316` |

The recommended card is EPIC, not LEGENDARY, so it reads as the smart pick
rather than the maxed-out one and LEGENDARY stays meaningful for the longest
plan.

Tier is conveyed by **badge text and icon as well as colour**, so it survives
colour-blindness and greyscale.

### Cross-app duplication

The shop (`frontend/`) and panel (`panel/frontend/`) are separate Next apps,
so `frontend/src/lib/rarity.ts` cannot be imported. A trimmed copy lives at
`panel/frontend/src/lib/rarity.ts` with a comment naming the shop file as the
source of truth. A cross-app import to save three constants would be worse
than the duplication.

### Hover parity on touch

Gamified reward states are hover-driven, and touch devices have no hover. Each
tier card is "armed" by `onViewportEnter`, and CSS routes the reward by
capability: `@media (hover: hover)` uses `:hover`, `@media (hover: none)` uses
the `.tier-armed` class. Every visitor gets the moment once; nobody gets a
dead state.

### Motion budget

Ceiling of 1-2 animated elements per viewport, all transform/opacity so they
stay on the compositor:

- Scroll progress restyled as a segmented XP bar (already scroll-driven)
- Card reveals use overshoot easing `[0.34, 1.3, 0.64, 1]`
- Breathing tier glow on the recommended card only
- Quest-chain line fills once when the steps section is reached

Explicitly rejected: pulsing status dots on every marquee pill. That would
animate ~28 `box-shadow`s at once, which is off the compositor and reads as
noise. One pulsing indicator sits on the header count instead.

### Rejected: database palette

`ui-ux-pro-max` recommended neon purple `#7C3AED` with Fredoka/Nunito. Adopting
it would rebrand the whole panel, since dashboard, admin, `/order` and `/lp`
share these tokens, and Fredoka's Thai coverage is weaker than the current
Kanit. Only the structural and motion guidance was taken.

## Accessibility

`prefers-reduced-motion` extended to cover every new class. Under it: marquee
stops, tier glow becomes static, the quest line renders filled, the XP bar
stops. All content still reaches its final state, instantly.

## Files

- `panel/frontend/src/app/page.tsx` - tier cards, marquee, quest steps, XP bar
- `panel/frontend/src/app/globals.css` - scoped keyframes, reduced-motion block
- `panel/frontend/src/lib/rarity.ts` - new tier tokens
- `panel/frontend/src/components/ui/icon.tsx` - `gem`, `crown`, `trophy`, `swords`
