import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import { fetchShopSeo, fetchPublicRankings, fetchSessionUser } from '@/lib/serverSeo';
import { fontVariables } from '@/lib/fonts';
import { THEMES, DEFAULT_THEME_ID, themeCss } from '@/lib/themeCss';

// `viewportFit: 'cover'` is what makes env(safe-area-inset-*) resolve to a real
// value. Without it the mobile bottom nav's safe-area padding evaluates to 0 and
// the bar sits underneath the iPhone home indicator. `maximumScale` is left
// unset on purpose: pinch-zoom must stay available (accessibility).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Icon links for the document head.
 *
 * With no configured icon we point straight at the static SVG, which costs the
 * shop nothing. With one, every entry goes through /site-icon so the browser
 * gets a PNG it can render at the size it asked for. `apple-touch-icon` is what
 * iOS uses for a home-screen bookmark; without it Safari screenshots the page.
 */
function iconDescriptor(source: string | undefined) {
  if (!source) return { icon: '/icon.svg' };

  // Short non-cryptographic fingerprint of the configured URL. Only used for
  // cache busting, so collision resistance is not a property we need.
  let h = 0;
  for (let i = 0; i < source.length; i++) h = (Math.imul(31, h) + source.charCodeAt(i)) | 0;
  const v = (h >>> 0).toString(36);

  return {
    icon: [
      { url: `/site-icon?size=32&v=${v}`, sizes: '32x32', type: 'image/png' },
      { url: `/site-icon?size=192&v=${v}`, sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: `/site-icon?size=180&v=${v}`, sizes: '180x180', type: 'image/png' }],
  };
}

// Per-tenant metadata: each shop gets its own name/description/canonical resolved
// from the request host at runtime (works for subdomains and custom domains alike).
export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchShopSeo();
  const defaultTitle = seo.title || `${seo.shopName} | ร้านค้า Minecraft เติมเงินอัตโนมัติ รับของทันที`;
  const keywords =
    `${seo.shopName}, ร้านค้ามายคราฟ, เติมเงินมายคราฟ, ซื้อไอเท็มมายคราฟ, Minecraft Store, เซิร์ฟเวอร์มายคราฟ, PromptPay, TrueMoney` +
    (seo.keywords ? `, ${seo.keywords}` : '');

  return {
    metadataBase: new URL(seo.baseUrl),
    title: { default: defaultTitle, template: `%s | ${seo.shopName}` },
    description: seo.description,
    keywords,
    applicationName: seo.shopName,
    // No `alternates.canonical` here on purpose. Metadata set in the root layout
    // applies to every route that does not override it, so a literal '/' told
    // search engines that /shop, /lootbox, /topup and every other page were
    // duplicates of the home page - Lighthouse flagged it on each of them and it
    // is the kind of tag that quietly keeps real pages out of the index. With no
    // canonical tag at all, each URL self-canonicalises, which is the correct
    // answer for all of them. Nothing is lost for the custom-domain case either:
    // metadataBase already resolves from the request host, so an explicit
    // canonical would only ever have echoed the host the visitor arrived on.
    openGraph: {
      title: defaultTitle,
      description: seo.description,
      type: 'website',
      locale: 'th_TH',
      siteName: seo.shopName,
      url: '/',
      ...(seo.logoUrl ? { images: [{ url: seo.logoUrl }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: seo.description,
      ...(seo.logoUrl ? { images: [seo.logoUrl] } : {}),
    },
    robots: { index: true, follow: true },
    // Resolved on the server so the correct icon is in the first response and
    // survives client-side navigation. It used to be swapped in after hydration
    // by a DynamicFavicon component, which had two problems: the swap pointed at
    // /_next/image, and that endpoint answers a favicon request with AVIF (it
    // negotiates on Accept) - no browser renders an AVIF favicon, so every shop
    // was stuck on the built-in fallback mark. /site-icon re-encodes the owner's
    // image to PNG from our own origin, which keeps the third-party host off the
    // page while producing something a browser will actually draw.
    //
    // The ?v= fingerprint is what lets /site-icon be cached immutably: change the
    // favicon setting and the URL changes with it.
    icons: iconDescriptor(seo.faviconUrl || seo.logoUrl),
    ...(seo.googleVerification ? { verification: { google: seo.googleVerification } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Both are cached server-side (300s / 60s), so this is one round trip on a cold
  // cache and none on a warm one, in exchange for a sidebar that never shifts.
  const [seo, rankings, sessionUser] = await Promise.all([
    fetchShopSeo(),
    fetchPublicRankings(),
    fetchSessionUser(),
  ]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: seo.shopName,
    description: seo.description,
    url: seo.baseUrl,
    ...(seo.logoUrl ? { logo: seo.logoUrl, image: seo.logoUrl } : {}),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${seo.baseUrl}/shop?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // The shop's theme is an admin setting, not a per-visitor choice, so the server
  // can resolve it. Rendering its CSS here instead of injecting it after
  // hydration removes a full style recalculation of the document from the
  // critical path - 761ms of style-and-layout on throttled mobile, in the exact
  // window the hero image was waiting to paint - and removes the flash of default
  // green that every visitor used to see first.
  const theme = THEMES.find(t => t.id === (seo.settings.theme_name || DEFAULT_THEME_ID)) ?? THEMES[0];

  return (
    <html
      lang="th"
      data-site-theme={theme.id}
      {...(theme.isDark ? { 'data-site-dark': 'true' } : {})}
      suppressHydrationWarning
    >
      <head>
        {/* Same id the client writer targets, so injectTheme replaces this node
            rather than adding a second competing block. */}
        <style id="site-theme-vars" dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
        {/* .replace(/</g,...) escapes `<` so an admin-set shop name/description
            containing `</script>` cannot break out of the JSON-LD block. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        {/* No font or icon CDN links here on purpose. Inter and Prompt are
            self-hosted by next/font (see lib/fonts.ts) and Font Awesome now
            loads only inside the admin shell, which is the only place that
            uses it. Both were render-blocking cross-origin stylesheets on
            every customer page. */}
        {/* Player avatars (member card, top-up rankings, recent purchases) all
            come from this one host. Opening the connection up front saves the
            DNS + TLS round trip that Lighthouse measured at 335ms. */}
        <link rel="preconnect" href="https://mc-heads.net" crossOrigin="anonymous" />
      </head>
      <body className={`${fontVariables} font-sans bg-background text-foreground min-h-screen antialiased`}>
        <Providers
          initialSettings={seo.settings}
          initialRankings={rankings}
          initialUser={sessionUser}
          sessionSeeded
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
