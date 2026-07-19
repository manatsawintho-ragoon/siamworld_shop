import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { fetchShopSeo } from '@/lib/serverSeo';

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
    alternates: { canonical: '/' },
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
    ...(seo.googleVerification ? { verification: { google: seo.googleVerification } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const seo = await fetchShopSeo();
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

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* .replace(/</g,...) escapes `<` so an admin-set shop name/description
            containing `</script>` cannot break out of the JSON-LD block. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Prompt:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="font-sans bg-background text-foreground min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
