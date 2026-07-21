import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { getEnRelated, EN_CLUSTERS } from '@/lib/seo/keywords.en';
import type { LandingPage } from '@/lib/seo/keywords';
import { Icon, type IconName } from '@/components/ui/icon';
import { SITE_URL, SITE_NAME, abs, jsonLd, ORGANIZATION_ID } from '@/lib/seo/site';

export default function EnglishLanding({ page }: { page: LandingPage }) {

  const related = getEnRelated(page);
  const cluster = EN_CLUSTERS[page.cluster];
  const canonical = abs(`/en/lp/${page.slug}`);

  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: page.h1,
      description: page.description,
      serviceType: 'Hosted Minecraft webshop platform',
      areaServed: { '@type': 'Country', name: 'Thailand' },
      provider: { '@id': ORGANIZATION_ID },
      url: canonical,
      inLanguage: 'en',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/en') },
        { '@type': 'ListItem', position: 2, name: 'Solutions', item: abs('/en/solutions') },
        { '@type': 'ListItem', position: 3, name: page.h1, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: 'en',
      mainEntity: page.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <Navbar />

      <article className="max-w-3xl mx-auto px-6 py-12">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-muted-foreground mb-6">
          <ol className="flex items-center gap-2 flex-wrap list-none p-0 m-0">
            <li><Link href="/en" className="hover:text-primary transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/en/solutions" className="hover:text-primary transition-colors">Solutions</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground" aria-current="page">{cluster?.label}</li>
          </ol>
        </nav>

        <header className="space-y-4 mb-8">
          {cluster && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[13px] font-medium tracking-wider">
              <Icon name={cluster.icon as IconName} /> {cluster.label}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight">{page.h1}</h1>
          <div className="space-y-3">
            {page.intro.map((p, i) => (
              <p key={i} className="text-base text-muted-foreground leading-relaxed">{p}</p>
            ))}
          </div>
        </header>

        <section className="mb-10" aria-labelledby="what-you-get">
          <h2 id="what-you-get" className="text-xl font-bold text-foreground mb-4">What you get</h2>
          <ul className="space-y-3">
            {page.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 bg-card border border-border rounded-2xl p-4">
                <Icon name="circle-check" className="text-emerald-500 mt-0.5" />
                <span className="text-sm text-foreground/90 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10 rounded-3xl bg-primary/5 border border-primary/15 p-6 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Try it with your own players</h2>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Free for 7 days, no card required. Set up your store, connect your server, and let real players buy something before you decide.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/order">Start the free trial</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/en/lp/minecraft-webshop-pricing">See pricing</Link></Button>
          </div>
        </section>

        <section className="mb-10" aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-bold text-foreground mb-4">Frequently asked questions</h2>
          <div className="space-y-3">
            {page.faqs.map((f, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl p-4">
                <summary className="cursor-pointer font-semibold text-foreground text-sm list-none flex items-start justify-between gap-4">
                  <h3 className="text-sm font-semibold m-0">{f.q}</h3>
                  <Icon name="chevron-down" className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <nav className="mb-10" aria-labelledby="related">
            <h2 id="related" className="text-xl font-bold text-foreground mb-4">Related pages</h2>
            <ul className="grid sm:grid-cols-2 gap-3 list-none p-0 m-0">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/en/lp/${r.slug}`}
                    className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-colors h-full"
                  >
                    <span className="text-sm font-semibold text-foreground">{r.h1}</span>
                    <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{r.description.slice(0, 110)}...</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <p className="leading-relaxed">
            Browse every guide in the <Link href="/en/solutions" className="text-primary hover:underline">solutions hub</Link>,
            or read this site in <Link href="/" className="text-primary hover:underline" hrefLang="th">Thai</Link>.
          </p>
          <p className="mt-2 text-xs">Published by {SITE_NAME}. <Link href="/contact" className="hover:underline">Contact us</Link>.</p>
        </footer>
      </article>
    </div>
  );
}
