import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { EN_LANDING_PAGES } from '@/lib/seo/keywords.en';
import { SITE_URL, SITE_NAME, abs, jsonLd, ORGANIZATION_ID, WEBSITE_ID } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
  description:
    'Hosted Minecraft webshop for Thai and SEA servers. AuthMe login, PromptPay and TrueMoney top-ups with automatic slip verification, and instant RCON item delivery. Free 7-day trial, no card required.',
  keywords: [
    'minecraft webshop',
    'minecraft webstore',
    'minecraft server webshop',
    'minecraft donation store',
    'hosted minecraft webshop',
    'minecraft webshop hosting',
    'minecraft webshop saas',
    'tebex alternative',
    'minecraft server monetization',
  ].join(', '),
  alternates: {
    canonical: '/en',
    languages: {
      'th-TH': `${SITE_URL}/`,
      en: `${SITE_URL}/en`,
      'x-default': `${SITE_URL}/`,
    },
  },
  openGraph: {
    title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
    description:
      'AuthMe login, PromptPay and TrueMoney top-ups, and instant RCON delivery. A hosted Minecraft webshop built for Thai and Southeast Asian servers.',
    url: '/en',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: `${SITE_URL}/dashboard-admin.png`,
        width: 1200,
        height: 630,
        alt: 'SIAMSITE admin dashboard showing Minecraft webshop sales and orders',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
    description: 'Hosted Minecraft webshop with AuthMe login, PromptPay top-ups and instant RCON delivery.',
    images: [`${SITE_URL}/dashboard-admin.png`],
  },
};

const STEPS = [
  {
    icon: 'store',
    title: 'Create your store',
    body: 'Sign up and pick a subdomain, or point your own domain with a single CNAME record. HTTPS is issued and renewed for you.',
  },
  {
    icon: 'bolt',
    title: 'Connect your server',
    body: 'Drop the bridge plugin into your plugins folder and paste your key. It connects outbound, so no RCON port is opened and no server IP is published.',
  },
  {
    icon: 'cubes',
    title: 'Add products',
    body: 'Create ranks, kits, loot boxes or currency, and give each one the RCON commands it should run on purchase.',
  },
  {
    icon: 'wallet',
    title: 'Take payments',
    body: 'Players top up with PromptPay or TrueMoney. Slips are verified automatically and the purchase is delivered in seconds.',
  },
];

const FEATURES: { icon: string; title: string; body: string; href: string }[] = [
  {
    icon: 'shield-check',
    title: 'AuthMe login, no second account',
    body: 'Players sign in with the username and password they already use in-game. Passwords stay in AuthMe and are never copied.',
    href: '/en/lp/minecraft-webshop-authme',
  },
  {
    icon: 'bolt',
    title: 'RCON delivery without open ports',
    body: 'An outbound bridge plugin delivers purchases in seconds, and works behind anti-DDoS providers that break inbound RCON.',
    href: '/en/lp/minecraft-rcon-item-delivery',
  },
  {
    icon: 'qrcode',
    title: 'PromptPay and TrueMoney top-ups',
    body: 'Automatic slip verification credits wallets without staff checking screenshots at 3am. Money settles to your own account.',
    href: '/en/lp/minecraft-payment-gateway-thailand',
  },
  {
    icon: 'cubes',
    title: 'Loot boxes with published odds',
    body: 'Weighted per-item drop rates, rarity tiers from Common to Mythic, an animated opening, and a claimable web inventory.',
    href: '/en/lp/minecraft-lootbox',
  },
  {
    icon: 'graduation-cap',
    title: 'Ranks, codes and discounts',
    body: 'Sell VIP ranks through any permission plugin, run giveaways with redeem codes, and launch promotions with discount codes.',
    href: '/en/lp/minecraft-rank-shop',
  },
  {
    icon: 'right-left',
    title: 'A Tebex alternative, when it fits',
    body: 'Worth switching only if your players pay with Thai methods. If your revenue is card-based, we say so plainly.',
    href: '/en/lp/tebex-alternative',
  },
];

const FAQS = [
  {
    q: 'What is a Minecraft webshop?',
    a: 'A website where players buy ranks, items or currency for your server, with the purchase delivered to the game automatically. It replaces manual donation handling over Discord and works while you are asleep.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'No. The store is configured through an admin dashboard: you add products and the RCON commands they should run. There is nothing to compile and no server-side code to write.',
  },
  {
    q: 'Which payment methods are supported?',
    a: 'PromptPay QR with automatic slip verification, and TrueMoney Angpao. All wallets are in Thai Baht. There is no credit card or PayPal option, so this suits servers whose players pay with Thai methods.',
  },
  {
    q: 'Which server software works with it?',
    a: 'Paper, Purpur, Spigot and Folia. Velocity and BungeeCord networks are supported by connecting the backend servers rather than the proxy, since proxies do not forward RCON.',
  },
  {
    q: 'What happens if item delivery fails?',
    a: 'The wallet charge is rolled back automatically and the player is credited again. Purchases are also blocked for offline players, because a delivery command aimed at an offline player would silently do nothing.',
  },
  {
    q: 'How much does it cost?',
    a: 'A free 7-day trial with no card required, then a discounted first month at 99 THB, then plans from 249 THB per month. No commission is taken on your sales.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'Yes. Point one CNAME record at the platform and the HTTPS certificate is issued and renewed for you, so your store runs on your own brand rather than a shared subdomain.',
  },
];

export default function EnglishHome() {
  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${abs('/en')}#webpage`,
      url: abs('/en'),
      name: 'Minecraft Webshop For Your Server',
      description: metadata.description,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/dashboard-admin.png` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Minecraft webshop platform',
      operatingSystem: 'Web',
      inLanguage: 'en',
      description:
        'Hosted Minecraft webshop with AuthMe login, PromptPay and TrueMoney top-ups, automatic slip verification and RCON item delivery.',
      url: abs('/en'),
      publisher: { '@id': ORGANIZATION_ID },
      // Deliberately no aggregateRating: Google's review snippet policy
      // disallows self-serving ratings that are not backed by real reviews
      // rendered on the page.
      offers: [
        {
          '@type': 'Offer',
          name: 'Free 7-day trial',
          price: '0',
          priceCurrency: 'THB',
          availability: 'https://schema.org/InStock',
          eligibleDuration: { '@type': 'QuantitativeValue', value: 7, unitCode: 'DAY' },
        },
        {
          '@type': 'Offer',
          name: 'Discounted first month',
          price: '99',
          priceCurrency: 'THB',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Monthly plan',
          price: '249',
          priceCurrency: 'THB',
          availability: 'https://schema.org/InStock',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: 'en',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: abs('/en') }],
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <Navbar />

      <main>
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[13px] font-medium">
            <Icon name="bolt" /> Free 7-day trial, no card required
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.15]">
            A Minecraft webshop that delivers before the player logs off
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Players log in with their existing AuthMe account, top up with PromptPay or TrueMoney, and the
            purchase reaches them over RCON in seconds. Built for Thai and Southeast Asian servers, so the
            payment methods are the ones your players actually use.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/order">Start the free trial</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/en/lp/minecraft-webshop-pricing">See pricing</Link></Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Prefer Thai? <Link href="/" className="text-primary hover:underline" hrefLang="th">อ่านหน้านี้เป็นภาษาไทย</Link>
          </p>
        </section>

        {/* Honest scope note, placed high on purpose */}
        <section className="max-w-3xl mx-auto px-6 pb-12">
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 flex items-start gap-3">
            <Icon name="circle-info" className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/90 leading-relaxed m-0">
              <strong className="font-semibold">Before you read further:</strong> top-ups run on PromptPay and
              TrueMoney and all wallets are in Thai Baht. There is no card or PayPal option today. If your
              players pay by card, a global platform will serve you better than we will, and we would rather
              tell you now than after you have set everything up.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-6 py-12" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-3xl font-semibold tracking-tight text-foreground text-center">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground text-center max-w-xl mx-auto leading-relaxed">
            Four steps from signup to your first sale. Most operators are selling the same afternoon they start.
          </p>
          <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="bg-card border border-border rounded-2xl p-5">
                <span className="flex items-center gap-2 text-primary text-sm font-semibold">
                  <Icon name={s.icon as IconName} /> Step {i + 1}
                </span>
                <h3 className="mt-3 text-base font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features, each linking to its deep page */}
        <section className="max-w-5xl mx-auto px-6 py-12" aria-labelledby="features">
          <h2 id="features" className="text-3xl font-semibold tracking-tight text-foreground text-center">
            What the store does
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <article key={f.href} className="bg-card border border-border rounded-2xl p-5 flex flex-col">
                <Icon name={f.icon as IconName} className="text-primary text-xl" />
                <h3 className="mt-3 text-base font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">{f.body}</p>
                <Link href={f.href} className="mt-4 text-sm font-semibold text-primary hover:underline">
                  Read more
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-12" aria-labelledby="faq">
          <h2 id="faq" className="text-3xl font-semibold tracking-tight text-foreground text-center">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group bg-card border border-border rounded-2xl p-4">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <h3 className="text-sm font-semibold text-foreground m-0">{f.q}</h3>
                  <Icon name="chevron-down" className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Topical hub links */}
        <section className="max-w-5xl mx-auto px-6 py-12" aria-labelledby="guides">
          <h2 id="guides" className="text-3xl font-semibold tracking-tight text-foreground text-center">
            Guides and comparisons
          </h2>
          <ul className="mt-8 grid sm:grid-cols-2 gap-3 list-none p-0">
            {EN_LANDING_PAGES.map((p) => (
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
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Or browse the full <Link href="/en/solutions" className="text-primary hover:underline">solutions hub</Link>.
          </p>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="rounded-3xl bg-primary/5 border border-primary/15 p-8">
            <h2 className="text-2xl font-bold text-foreground">Test it with real players</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Seven days free, no card required. The only test that tells you anything is a real player buying
              a real product on their own phone.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg"><Link href="/order">Start the free trial</Link></Button>
              <Button asChild variant="outline" size="lg"><Link href="/contact">Talk to us first</Link></Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
