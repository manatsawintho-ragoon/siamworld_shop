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
 * The woff2 files are Google's subsets re-compressed with fontTools using
 * --no-hinting --desubroutinize, which took the six of them from 114KB to 68KB
 * with identical codepoint coverage. Hinting tables are dead weight: no modern
 * rasterizer consults them at UI sizes. It mattered because all six preload at
 * High priority, and on throttled mobile they were starving the render-blocking
 * stylesheet of bandwidth - First Contentful Paint sat at 2.6s waiting for a
 * 23KB CSS file that the document had already finished requesting at 0.64s.
 *
 * To update: re-fetch the Google Fonts CSS API, put the new woff2 files in
 * src/fonts, keep the unicode-range strings below in sync with that CSS, then
 * re-run the subsetter over them:
 *
 *   pyftsubset <file>.woff2 --unicodes=<the range below> --flavor=woff2 \
 *     --layout-features=kern,liga,calt,ccmp,mark,mkmk,tnum,onum,ss01 \
 *     --no-hinting --desubroutinize --output-file=<file>.woff2
 */

export const interLatin = localFont({
  src: [{ path: '../fonts/Inter-variable-latin.woff2', weight: '400 900', style: 'normal' }],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  declarations: [
    {
      prop: 'unicode-range',
      // Narrower than Google's `latin` subset on purpose: this face is a
      // variable font, so its outline data dominates the file and every glyph
      // kept costs real bytes on the critical path. Minecraft usernames are
      // [A-Za-z0-9_] by protocol and every other string on the site is Thai, so
      // the Latin-1 accented letters and most of General Punctuation were
      // paying for glyphs no shop can render. Keep this in sync with the
      // subsetter's --unicodes argument (see the header comment).
      value:
        'U+0020-007E, U+00A0, U+00A9, U+00AE, U+00B0, U+00B1, U+00B7, U+00D7, U+00F7, U+2013-2014, U+2018-201A, U+201C-201E, U+2020-2022, U+2026, U+2030, U+2039-203A, U+20AC, U+2122, U+2190-2193, U+2212, U+2215, U+FEFF, U+FFFD',
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
