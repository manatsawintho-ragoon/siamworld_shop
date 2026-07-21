import { Link } from '@/i18n/navigation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { getRelated, CLUSTERS, type LandingPage } from '@/lib/seo/keywords';
import { Icon, type IconName } from '@/components/ui/icon';

const BASE = 'https://panel.siamsite.shop';

export default function ThaiLanding({ page }: { page: LandingPage }) {

  const related = getRelated(page);
  const cluster = CLUSTERS[page.cluster];
  const canonical = `${BASE}/lp/${encodeURIComponent(page.slug)}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: page.h1,
      description: page.description,
      serviceType: 'บริการเช่าเว็บร้านค้า Minecraft',
      areaServed: 'TH',
      provider: { '@type': 'Organization', name: 'SIAMSITE STORE', url: BASE },
      url: canonical,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: BASE },
        { '@type': 'ListItem', position: 2, name: 'บริการ', item: `${BASE}/solutions` },
        { '@type': 'ListItem', position: 3, name: page.h1, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Navbar />

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs font-semibold text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">หน้าแรก</Link>
          <span>/</span>
          <Link href="/solutions" className="hover:text-primary transition-colors">บริการ</Link>
          <span>/</span>
          <span className="text-foreground">{cluster?.label}</span>
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

        {/* Value bullets */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-4">สิ่งที่คุณได้รับ</h2>
          <ul className="space-y-3">
            {page.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 bg-card border border-border rounded-2xl p-4">
                <Icon name="circle-check" className="text-emerald-500 mt-0.5" />
                <span className="text-sm text-foreground/90 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mb-10 rounded-3xl bg-primary/5 border border-primary/15 p-6 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">เริ่มต้นวันนี้</h2>
          <p className="text-sm text-muted-foreground mb-5">ทดลองฟรี 7 วัน หรือเดือนแรกเพียง ฿99 ติดตั้งจบใน 10 นาที ไม่ต้องผูกบัตร</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild className="h-12 px-7 rounded-2xl font-bold"><Link href="/order?kind=trial">ทดลองฟรี 7 วัน</Link></Button>
            <Button asChild variant="outline" className="h-12 px-7 rounded-2xl font-bold"><Link href="/#pricing">ดูแพ็กเกจและราคา</Link></Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-4">คำถามที่พบบ่อย</h2>
          <div className="space-y-3">
            {page.faqs.map((f, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl p-4">
                <summary className="cursor-pointer font-bold text-sm text-foreground flex items-center justify-between">
                  {f.q}
                  <Icon name="chevron-down" className="text-xs text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Internal links */}
        {related.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">บริการที่เกี่ยวข้อง</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/lp/${encodeURIComponent(r.slug)}`} className="block bg-card border border-border rounded-2xl p-4 hover:border-primary/30 hover:shadow-md transition-all">
                  <p className="font-bold text-sm text-foreground">{r.h1}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 pt-6 border-t border-border text-center">
          <Link href="/solutions" className="text-sm font-semibold text-primary hover:underline">ดูบริการทั้งหมด</Link>
        </div>
      </article>
    </div>
  );
}
