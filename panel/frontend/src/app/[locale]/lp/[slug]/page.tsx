import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LANDING_PAGES, getLandingBySlug } from '@/lib/seo/keywords';
import { EN_LANDING_PAGES, getEnLandingBySlug } from '@/lib/seo/keywords.en';
import ThaiLanding from '@/components/marketing/ThaiLanding';
import EnglishLanding from '@/components/marketing/EnglishLanding';

export const dynamicParams = false;

/**
 * Each locale contributes its OWN slugs. Thai slugs exist only under the bare
 * path and English slugs only under /en, because these pages are not
 * translations of one another: they target different queries with different
 * content, and no slug is valid in both locales.
 *
 * That is also why nothing here emits hreflang. Declaring non-equivalent pages
 * as translations makes Google discard the annotation entirely.
 */
export function generateStaticParams({ params: { locale } }: { params: { locale: string } }) {
  const pages = locale === 'en' ? EN_LANDING_PAGES : LANDING_PAGES;
  return pages.map((p) => ({ slug: p.slug }));
}

function resolve(locale: string, slug: string) {
  const decoded = decodeURIComponent(slug);
  return locale === 'en' ? getEnLandingBySlug(decoded) : getLandingBySlug(decoded);
}

export function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}): Metadata {
  const page = resolve(locale, slug);
  if (!page) return {};

  const url = locale === 'en' ? `/en/lp/${page.slug}` : `/lp/${encodeURIComponent(page.slug)}`;

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords.join(', '),
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      type: 'article',
      locale: locale === 'en' ? 'en_US' : 'th_TH',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
  };
}

export default function LandingPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(locale);

  const page = resolve(locale, slug);
  if (!page) notFound();

  return locale === 'en' ? <EnglishLanding page={page} /> : <ThaiLanding page={page} />;
}
