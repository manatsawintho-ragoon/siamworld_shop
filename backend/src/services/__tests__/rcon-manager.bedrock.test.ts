import { sanitizePlayerName, isListedPlayerName } from '../rcon-manager';

// Regression: Bedrock players joining via Geyser/Floodgate carry a '.' prefix
// (e.g. ".IRUK9170") that is part of their real in-game name. Stripping it made
// the shop report them offline and delivered items to a nonexistent player.

describe('sanitizePlayerName', () => {
  it('preserves the Floodgate "." prefix of a Bedrock name', () => {
    expect(sanitizePlayerName('.IRUK9170')).toBe('.IRUK9170');
  });

  it('leaves a normal Java username untouched', () => {
    expect(sanitizePlayerName('NiikPlayer')).toBe('NiikPlayer');
    expect(sanitizePlayerName('kuya_xd')).toBe('kuya_xd');
  });

  it('strips RCON/selector metacharacters that could inject commands', () => {
    // ',' ']' '=' '@' and spaces/quotes are removed; alphanumerics remain.
    expect(sanitizePlayerName('evil,name]=@x')).toBe('evilnamex');
    expect(sanitizePlayerName('a b c')).toBe('abc');
    expect(sanitizePlayerName('"quoted"')).toBe('quoted');
  });
});

describe('isListedPlayerName', () => {
  it('accepts Bedrock names with the "." prefix', () => {
    expect(isListedPlayerName('.IRUK9170')).toBe(true);
    expect(isListedPlayerName('.ITonl_3213')).toBe(true);
  });

  it('accepts normal Minecraft names', () => {
    expect(isListedPlayerName('NiikPlayer')).toBe(true);
    expect(isListedPlayerName('ragoon8720')).toBe(true);
  });

  it('rejects truncation artifacts', () => {
    expect(isListedPlayerName('...')).toBe(false);
    expect(isListedPlayerName('')).toBe(false);
    expect(isListedPlayerName('and 3 more')).toBe(false);
  });
});
