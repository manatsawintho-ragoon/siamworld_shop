import { diffPlayers } from '../player-tracker';

describe('diffPlayers', () => {
  it('detects joins (in curr, not prev)', () => {
    const { joined, left } = diffPlayers(['alice'], ['alice', 'Bob']);
    expect(joined).toEqual(['Bob']);
    expect(left).toEqual([]);
  });

  it('detects leaves (in prev, not curr)', () => {
    const { joined, left } = diffPlayers(['alice', 'bob'], ['alice']);
    expect(joined).toEqual([]);
    expect(left).toEqual(['bob']);
  });

  it('is case-insensitive when comparing', () => {
    const { joined, left } = diffPlayers(['Alice', 'BOB'], ['alice', 'bob']);
    expect(joined).toEqual([]);
    expect(left).toEqual([]);
  });

  it('preserves original casing of returned names', () => {
    const { joined } = diffPlayers([], ['SteveMC']);
    expect(joined).toEqual(['SteveMC']);
  });

  it('handles simultaneous join and leave', () => {
    const { joined, left } = diffPlayers(['a', 'b'], ['b', 'c']);
    expect(joined).toEqual(['c']);
    expect(left).toEqual(['a']);
  });

  it('returns empty for identical sets', () => {
    expect(diffPlayers(['x', 'y'], ['y', 'x'])).toEqual({ joined: [], left: [] });
  });
});
