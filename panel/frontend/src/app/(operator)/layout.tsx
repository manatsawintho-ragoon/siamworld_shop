import type { Metadata, Viewport } from 'next';
import { kanitLatin, kanitThai } from '@/lib/fonts';
import AppProviders from '@/components/AppProviders';
import '../globals.css';

/**
 * Root layout for the operator back office (/admin).
 *
 * There are two root layouts because <html lang> has to differ per tree: the
 * customer site renders per locale under [locale], while /admin is Thai-only
 * by decision (no customer ever sees it, so translating it earns nothing).
 * Next.js permits multiple roots as long as no app/layout.tsx exists above
 * them.
 *
 * No marketing JSON-LD here on purpose. Organization, WebSite, FAQ and
 * SoftwareApplication describe the public product; emitting them on an admin
 * screen would be describing a page that does not show any of it.
 */
export const metadata: Metadata = {
  title: 'แผงควบคุมแอดมิน | SIAMSITE',
  // Belt and braces with the robots.txt Disallow: an admin screen that somehow
  // gets fetched should still never be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
};

export default function OperatorRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${kanitLatin.variable} ${kanitThai.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
