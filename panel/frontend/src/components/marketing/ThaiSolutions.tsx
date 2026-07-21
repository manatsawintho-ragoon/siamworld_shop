import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { LANDING_PAGES, CLUSTERS } from '@/lib/seo/keywords';
import { Icon, type IconName } from '@/components/ui/icon';

const BASE = 'https://panel.siamsite.shop';

export const metadata: Metadata = {
  title: 'บริการเช่าเว็บร้านค้า Minecraft ทั้งหมด | คู่มือและฟีเจอร์',
  description:
    'รวมบริการและคู่มือเช่าเว็บร้านค้า Minecraft: ระบบเติมเงิน PromptPay/TrueMoney, ส่งของอัตโนมัติผ่าน RCON, กล่องสุ่ม, ตามประเภทเซิร์ฟเวอร์ และทางเลือกแทน Tebex สำหรับเซิร์ฟไทย',
  keywords:
    'เช่าเว็บร้านค้ามายคราฟ, ระบบร้านค้า minecraft, webshop minecraft, เติมเงินมายคราฟ, ทางเลือกแทน tebex, กล่องสุ่ม minecraft',
  alternates: { canonical: '/solutions' },
  openGraph: {
    title: 'บริการเช่าเว็บร้านค้า Minecraft ทั้งหมด',
    description: 'รวมบริการและคู่มือเช่าเว็บร้านค้า Minecraft สำหรับเจ้าของเซิร์ฟเวอร์ไทย',
    url: '/solutions',
    type: 'website',
    locale: 'th_TH',
  },
};

export default function ThaiSolutions() {
  const byCluster = Object.keys(CLUSTERS).map((key) => ({
    key,
    meta: CLUSTERS[key],
    pages: LANDING_PAGES.filter((p) => p.cluster === key),
  })).filter((c) => c.pages.length > 0);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: LANDING_PAGES.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE}/lp/${encodeURIComponent(p.slug)}`,
      name: p.h1,
    })),
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, '\\u003c') }} />
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">บริการเช่าเว็บร้านค้า Minecraft</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            รวมทุกฟีเจอร์ ทุกประเภทเซิร์ฟเวอร์ และคู่มือสำหรับเจ้าของเซิร์ฟ Minecraft ไทย เลือกหัวข้อที่ตรงกับคุณเพื่อดูรายละเอียด
          </p>
        </header>

        <div className="space-y-10">
          {byCluster.map((c) => (
            <section key={c.key}>
              <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name={c.meta.icon as IconName} className="text-primary" /> {c.meta.label}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {c.pages.map((p) => (
                  <Link key={p.slug} href={`/lp/${encodeURIComponent(p.slug)}`} className="block bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all">
                    <p className="font-bold text-sm text-foreground">{p.h1}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{p.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
