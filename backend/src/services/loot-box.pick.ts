/**
 * Weighted random selection for loot boxes. Extracted from LootBoxService so the
 * odds logic — the fairness-critical part players can't see — is unit-testable in
 * isolation. All RNG is server-side; `rng` is injectable purely for deterministic
 * tests and defaults to Math.random in production.
 */
export function pickWeighted<T extends { weight: number }>(
  items: T[],
  rng: () => number = Math.random,
): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  // Fallback for floating-point drift at the top of the range.
  return items[items.length - 1];
}
