import localFont from 'next/font/local';

/**
 * Kanit, vendored.
 *
 * Why local and not next/font/google: next/font/google downloads the font at
 * BUILD time, and a failed fetch is a fatal webpack error (nextFontError), not
 * a warning. That made every production build depend on reaching Google, and
 * it did in fact break the panel build. Vendoring the woff2 files makes builds
 * hermetic - no network, no flake, byte-identical output every time.
 *
 * Two instances rather than one, split by subset and carrying the same
 * unicode-range values Google serves. CSS font fallback resolves per glyph, so
 * an English-only page never downloads the Thai files and vice versa. Merging
 * them into one instance would drop unicode-range and force every visitor to
 * fetch both alphabets.
 *
 * Everything below is written out longhand on purpose. next/font is a compile
 * time transform and rejects computed values with "Font loader values must be
 * explicitly written literals", so no helper functions, no shared consts, no
 * .map() over weights. Repetitive, but it is the only form the loader accepts.
 *
 * Weights are limited to the five actually used in the app (300 had zero
 * occurrences, 900 had exactly one, in an admin-only heading). Each declared
 * weight costs a preloaded file per subset, so check real usage before adding.
 *
 * To update: re-fetch the Google Fonts CSS API, replace the woff2 files in
 * src/fonts, and keep the unicode-range strings in sync with that CSS.
 */

export const kanitLatin = localFont({
  src: [
    { path: '../fonts/Kanit-400-latin.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Kanit-500-latin.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/Kanit-600-latin.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/Kanit-700-latin.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/Kanit-800-latin.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-kanit-latin',
  preload: true,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

export const kanitThai = localFont({
  src: [
    { path: '../fonts/Kanit-400-thai.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Kanit-500-thai.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/Kanit-600-thai.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/Kanit-700-thai.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/Kanit-800-thai.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-kanit-thai',
  preload: true,
  declarations: [
    { prop: 'unicode-range', value: 'U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC' },
  ],
});

/**
 * Inter, vendored the same way, for the English locale only.
 *
 * Kanit is a Thai-first family: its Latin is display-weighted and set for Thai
 * line height, which reads heavy in an all-English page. Inter is the Latin
 * text face, so /en swaps to it while Thai pages keep Kanit throughout.
 *
 * One file, not five: Google serves Inter's Latin subset as a single variable
 * woff2 spanning the whole 400-800 range, so all five weights resolve from it.
 * Its unicode-range is byte-identical to kanitLatin's above, which is what
 * lets it slot into the same Latin position in the --font-sans stack.
 */
export const interLatin = localFont({
  src: [
    { path: '../fonts/Inter-variable-latin.woff2', weight: '400 800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter-latin',
  preload: true,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

/** Both Kanit variables, for the <html> className. */
export const fontVariables = `${kanitLatin.variable} ${kanitThai.variable}`;
