import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/**
 * English locale shell.
 *
 * The root layout owns <html lang="th"> and the App Router does not allow a
 * nested <html>, so the language of this subtree is declared with a lang
 * attribute on the wrapper element instead. That is valid HTML, it is present
 * in the server-rendered markup (no JS required for a crawler to see it), and
 * it is what the spec intends for a mixed-language document.
 *
 * The stronger signals for Google are the reciprocal hreflang pairs declared
 * per page and og:locale, both of which are set explicitly.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { locale: 'en_US', siteName: 'SIAMSITE STORE' },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}
