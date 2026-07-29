import type { Metadata } from 'next';
import { getRequestOrigin } from '@/lib/serverSeo';

/**
 * Per-article SEO. The article page itself is a client component (it POSTs a
 * view and drives the in-article carousel), so metadata and the Article
 * JSON-LD are produced here in a server layout instead.
 *
 * Fetch is best-effort and never throws: a failed lookup just yields the
 * default shop metadata, never a broken render.
 */

interface NewsSummary {
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  category: string;
}

async function fetchArticle(slug: string): Promise<NewsSummary | null> {
  const baseUrl = getRequestOrigin();
  const internal = process.env.BACKEND_INTERNAL_URL;
  const path = `/api/public/news/${encodeURIComponent(slug)}`;
  const endpoints = [internal ? `${internal}${path}` : null, `${baseUrl}${path}`].filter(Boolean) as string[];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { next: { revalidate: 120 } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.article) return data.article as NewsSummary;
    } catch { /* try next */ }
  }
  return null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const article = await fetchArticle(params.slug);
  if (!article) return { title: 'ข่าวสาร' };

  const description = (article.excerpt || article.title).slice(0, 200);
  const images = article.coverImage ? [article.coverImage] : undefined;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      images,
      publishedTime: article.publishedAt || undefined,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: article.title,
      description,
      images,
    },
  };
}

export default async function NewsArticleLayout(
  { children, params }: { children: React.ReactNode; params: { slug: string } }
) {
  const article = await fetchArticle(params.slug);
  const origin = getRequestOrigin();

  const jsonLd = article ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || article.title,
    datePublished: article.publishedAt || undefined,
    image: article.coverImage ? [article.coverImage] : undefined,
    mainEntityOfPage: `${origin}/news/${params.slug}`,
  } : null;

  return (
    <>
      {jsonLd && (
        // Escape `<` so a title containing "</script>" cannot break out of this
        // tag - the standard safe way to inline JSON into a script element.
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      )}
      {children}
    </>
  );
}
