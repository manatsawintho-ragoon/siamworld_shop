import { pickWeighted } from '../loot-box.pick';

type Item = { id: string; weight: number };

describe('pickWeighted', () => {
  it('always returns the only item when there is one', () => {
    const items: Item[] = [{ id: 'a', weight: 5 }];
    expect(pickWeighted(items, () => 0.99).id).toBe('a');
  });

  it('is deterministic for a given rng value (boundary walk)', () => {
    // weights [1,1,2], total 4
    const items: Item[] = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 2 },
    ];
    expect(pickWeighted(items, () => 0).id).toBe('a');     // r=0    -> a
    expect(pickWeighted(items, () => 0.2).id).toBe('a');    // r=0.8  -> a
    expect(pickWeighted(items, () => 0.25).id).toBe('a');   // r=1.0  -> a wins the boundary (<=0)
    expect(pickWeighted(items, () => 0.26).id).toBe('b');   // r=1.04 -> b
    expect(pickWeighted(items, () => 0.49).id).toBe('b');   // r=1.96 -> b
    expect(pickWeighted(items, () => 0.9).id).toBe('c');    // r=3.6  -> c
  });

  it('returns the last item at the very top of the range (fp drift guard)', () => {
    const items: Item[] = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
    ];
    // rng()~=1 -> r just under total; final item is the safe fallback
    expect(pickWeighted(items, () => 0.999999999).id).toBe('b');
  });

  it('respects weights across many draws (within tolerance)', () => {
    const items: Item[] = [
      { id: 'common', weight: 70 },
      { id: 'rare', weight: 25 },
      { id: 'mythic', weight: 5 },
    ];
    const N = 200_000;
    const counts: Record<string, number> = { common: 0, rare: 0, mythic: 0 };
    for (let i = 0; i < N; i++) counts[pickWeighted(items).id]++;
    expect(counts.common / N).toBeCloseTo(0.70, 1); // ~70%
    expect(counts.rare / N).toBeCloseTo(0.25, 1);   // ~25%
    expect(counts.mythic / N).toBeCloseTo(0.05, 1); // ~5%
  });

  it('effectively never selects a zero-weight item', () => {
    const items: Item[] = [
      { id: 'zero', weight: 0 },
      { id: 'real', weight: 10 },
    ];
    const N = 50_000;
    let zero = 0;
    for (let i = 0; i < N; i++) if (pickWeighted(items).id === 'zero') zero++;
    // Only reachable if Math.random() returns exactly 0 — astronomically rare.
    expect(zero).toBe(0);
  });
});
