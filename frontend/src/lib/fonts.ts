import localFont from 'next/font/local';

/**
 * Inter + Prompt, vendored.
 *
 * These used to load from fonts.googleapis.com via a <link> in the root layout.
 * That stylesheet is render-blocking and cross-origin, so nothing painted until
 * a fresh connection to Google resolved: Lighthouse measured 875ms of blocked
 * render on mobile for a 1.7KB file. Self-hosting folds the @font-face rules
 * into our own CSS bundle, so there is no second request and no third-party
 * connection on the critical path.
 *
 * Vendored rather than next/font/google for the same reason the panel does it:
 * next/font/google fetches at BUILD time and a failed fetch is a fatal webpack
 * error, which would make every shop image build depend on reaching Google.
 *
 * Two instances, split by subset, carrying the unicode-range values Google
 * serves. Font fallback resolves per glyph, so Latin text draws from Inter and
 * Thai text from Prompt without either page fetching the other's files.
 *
 * next/font is a compile time transform and rejects computed values ("Font
 * loader values must be explicitly written literals"), so everything below is
 * longhand: no helpers, no shared consts, no .map() over weights.
 *
 * Weights match real usage in the app. 300 was requested from Google but never
 * used, and 800 had three occurrences, so both are gone; CSS weight matching
 * resolves an 800 to the 900 file. Each declared weight is one more preloaded
 * file, so check usage before adding one back.
 *
 * To update: re-fetch the Google Fonts CSS API, replace the woff2 files in
 * src/fonts, and keep the unicode-range strings in sync with that CSS.
 */

export const interLatin = localFont({
  src: [{ path: '../fonts/Inter-variable-latin.woff2', weight: '400 900', style: 'normal' }],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

export const promptThai = localFont({
  src: [
    { path: '../fonts/Prompt-400-thai.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Prompt-500-thai.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/Prompt-600-thai.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/Prompt-700-thai.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/Prompt-900-thai.woff2', weight: '900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-prompt',
  preload: true,
  declarations: [
    { prop: 'unicode-range', value: 'U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC' },
  ],
});

/** Both variables, for the <html> className. */
export const fontVariables = `${interLatin.variable} ${promptThai.variable}`;
