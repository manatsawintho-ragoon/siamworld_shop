import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { EN_LANDING_PAGES, EN_CLUSTERS } from '@/lib/seo/keywords.en';
import { Icon, type IconName } from '@/components/ui/icon';
import { abs, jsonLd, ORGANIZATION_ID } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Minecraft Webshop Guides, Features And Comparisons',
  description:
    'Every guide to running a hosted Minecraft webshop: payments, RCON delivery, loot boxes, rank shops, server compatibility, pricing and how it compares to Tebex.',
  keywords:
    'minecraft webshop, minecraft webstore, minecraft donation store, tebex alternative, minecraft rcon, minecraft lootbox, minecraft server monetization',
  alternates: { canonical: '/en/solutions' },
  openGraph: {
    title: 'Minecraft Webshop Guides, Features And Comparisons',
    description: 'Guides and feature breakdowns for running a hosted Minecraft webshop.',
    url: '/en/solutions',
    type: 'website',
    locale: 'en_US',
  },
};

export default function EnglishSolutionsHub() {
  const byCluster = Object.keys(EN_CLUSTERS)
    .map((key) => ({
      key,
      meta: EN_CLUSTERS[key],
      pages: EN_LANDING_PAGES.filter((p) => p.cluster === key),
    }))
    .filter((c) => c.pages.length > 0);

  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Minecraft Webshop Guides, Features And Comparisons',
      url: abs('/en/solutions'),
      inLanguage: 'en',
      publisher: { '@id': ORGANIZATION_ID },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: EN_LANDING_PAGES.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: abs(`/en/lp/${p.slug}`),
          name: p.h1,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/en') },
        { '@type': 'ListItem', position: 2, name: 'Solutions', item: abs('/en/solutions') },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-muted-foreground mb-6">
          <ol className="flex items-center gap-2 list-none p-0 m-0">
            <li><Link href="/en" className="hover:text-primary transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground" aria-current="page">Solutions</li>
          </ol>
        </nav>

        <header className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Minecraft webshop guides and features
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Everything the platform does, plus honest comparisons and monetization guidance for Minecraft
            server owners. Pick the topic that matches what you are trying to solve.
          </p>
        </header>

        <div className="space-y-10">
          {byCluster.map((c) => (
            <section key={c.key} aria-labelledby={`cluster-${c.key}`}>
              <h2 id={`cluster-${c.key}`} className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name={c.meta.icon as IconName} className="text-primary" /> {c.meta.label}
              </h2>
              <ul className="grid sm:grid-cols-2 gap-3 list-none p-0 m-0">
                {c.pages.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/en/lp/${p.slug}`}
                      className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors h-full"
                    >
                      <span className="text-sm font-semibold text-foreground">{p.h1}</span>
                      <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">
                        {p.description.slice(0, 120)}...
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Reading in the wrong language? <Link href="/solutions" className="text-primary hover:underline" hrefLang="th">ดูหน้าภาษาไทย</Link>
        </p>
      </main>
    </div>
  );
}
