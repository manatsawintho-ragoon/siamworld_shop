/**
 * Flag SVGs for the language switcher.
 *
 * Kept out of components/ui/icon.tsx on purpose: that registry maps semantic
 * names to single-path lucide glyphs that inherit currentColor, while flags are
 * multi-path, fixed-colour artwork. Mixing them would mean the registry's
 * `size: 1em` / currentColor contract no longer holds for every entry.
 *
 * Both render at a 3:2 ratio and are decorative: the switcher labels the
 * language in text, so the SVGs carry aria-hidden and the accessible name comes
 * from the button itself.
 */

type FlagProps = { className?: string };

/** Thailand: red / white / blue (double height) / white / red. */
export function FlagTH({ className = '' }: FlagProps) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <rect width="30" height="20" fill="#f4f5f8" />
      <rect width="30" height="3.34" y="0" fill="#a51931" />
      <rect width="30" height="6.66" y="6.67" fill="#2d2a4a" />
      <rect width="30" height="3.34" y="16.66" fill="#a51931" />
    </svg>
  );
}

/**
 * United Kingdom, used as the conventional mark for "English".
 * The diagonals are clipped to the flag rect so the counterchange reads
 * correctly at small sizes instead of bleeding past the corners.
 */
export function FlagEN({ className = '' }: FlagProps) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <clipPath id="flag-en-clip">
        <rect width="30" height="20" />
      </clipPath>
      <g clipPath="url(#flag-en-clip)">
        <rect width="30" height="20" fill="#012169" />
        {/* White saltire */}
        <path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="4" />
        {/* Red saltire, offset so it sits on one side of each white arm */}
        <path d="M0 0 L30 20" stroke="#c8102e" strokeWidth="2" />
        <path d="M30 0 L0 20" stroke="#c8102e" strokeWidth="2" />
        {/* White cross, then red cross on top */}
        <path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth="6.5" />
        <path d="M15 0 V20 M0 10 H30" stroke="#c8102e" strokeWidth="4" />
      </g>
    </svg>
  );
}

export const FLAG_BY_LOCALE = { th: FlagTH, en: FlagEN } as const;
