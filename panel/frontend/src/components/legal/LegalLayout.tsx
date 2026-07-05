import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { LEGAL_DOCS, LEGAL_UPDATED_TH, LEGAL_VERSION, CONTACT, OPERATOR } from '@/lib/legal';
import { Icon, type IconName } from '@/components/ui/icon';

interface LegalLayoutProps {
  /** slug of the current document (matches LEGAL_DOCS[].slug) — empty for /contact */
  current?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** Shared shell for every policy / legal page: navbar, themed container,
 *  sibling-policy navigation, and a contact block. Adapts to dark mode via tokens. */
export default function LegalLayout({ current, title, subtitle, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors mb-5">
            <Icon name="chevron-left" className="text-[10px]" /> กลับหน้าแรก
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2">เอกสารทางกฎหมาย</p>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight leading-tight">{title}</h1>
          <p className="mt-3 text-base text-muted-foreground font-medium max-w-2xl leading-relaxed">{subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground font-semibold">
            <span><Icon name="calendar-day" className="mr-1.5 text-primary/70" /> ปรับปรุงล่าสุด: {LEGAL_UPDATED_TH}</span>
            <span><Icon name="code-branch" className="mr-1.5 text-primary/70" /> เวอร์ชัน {LEGAL_VERSION}</span>
          </div>
        </header>

        {/* Sibling-policy quick nav */}
        <nav className="mb-10 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {LEGAL_DOCS.map((d) => {
            const active = d.slug === current;
            return (
              <Link
                key={d.slug}
                href={d.href}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-all ${
                  active
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-primary/[0.03]'
                }`}
              >
                <Icon name="file-contract" className={`mt-0.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{d.title}</span>
                  <span className="block text-xs text-muted-foreground font-medium leading-snug">{d.short}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Body */}
        <article className="legal-body space-y-9">{children}</article>

        {/* Contact / data-controller block */}
        <section className="mt-14 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-lg font-black text-foreground mb-1.5">ติดต่อผู้ให้บริการ</h2>
          <p className="text-sm text-muted-foreground font-medium mb-5 leading-relaxed">
            {OPERATOR.nameTh} ({OPERATOR.status}) ผู้ให้บริการแพลตฟอร์ม {OPERATOR.service} ({OPERATOR.domain}).
            หากมีข้อสงสัยเกี่ยวกับเอกสารนี้ ต้องการใช้สิทธิตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (PDPA)
            หรือต้องการแจ้งปัญหา ติดต่อได้ตามช่องทางด้านล่าง
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 hover:border-primary/40 transition-colors">
              <Icon name="envelope" className="text-primary w-5 text-center" />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">อีเมลหลัก</span>
                <span className="block text-sm font-bold text-foreground truncate">{CONTACT.email}</span>
              </span>
            </a>
            <a href={`mailto:${CONTACT.altEmail}`} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 hover:border-primary/40 transition-colors">
              <Icon name="envelope-open" className="text-primary w-5 text-center" />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">อีเมลสำรอง</span>
                <span className="block text-sm font-bold text-foreground truncate">{CONTACT.altEmail}</span>
              </span>
            </a>
            <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 hover:border-primary/40 transition-colors">
              <Icon name="facebook-f" className="text-primary w-5 text-center" />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Facebook</span>
                <span className="block text-sm font-bold text-foreground truncate">{CONTACT.facebookLabel}</span>
              </span>
            </a>
            <a href={CONTACT.discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 hover:border-primary/40 transition-colors">
              <Icon name="discord" className="text-primary w-5 text-center" />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Discord</span>
                <span className="block text-sm font-bold text-foreground truncate">{CONTACT.discordLabel}</span>
              </span>
            </a>
          </div>
        </section>

        <p className="mt-8 text-xs text-muted-foreground/80 font-medium leading-relaxed">
          เอกสารฉบับนี้จัดทำขึ้นเพื่ออธิบายเงื่อนไขการให้บริการตามความเข้าใจโดยทั่วไปของกฎหมายไทยที่เกี่ยวข้อง
          ผู้ให้บริการอาจปรับปรุงเนื้อหาให้สอดคล้องกับกฎหมายที่เปลี่ยนแปลง โดยจะประกาศวันที่และเวอร์ชันไว้ด้านบนเสมอ
        </p>
      </main>
    </div>
  );
}

// ── Small content primitives used by every policy page ──────────────────────

export function Section({ id, n, title, children }: { id?: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-black text-foreground mb-3 flex items-baseline gap-2.5">
        <span className="text-primary font-mono text-base">{n}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground font-medium [&_strong]:text-foreground [&_strong]:font-bold">
        {children}
      </div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2 pl-1">{children}</ul>;
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon name="circle" className="text-[5px] text-primary mt-2.5 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

/** Highlighted callout for important / warning notices. */
export function Notice({ children, tone = 'amber' }: { children: React.ReactNode; tone?: 'amber' | 'red' }) {
  const cls =
    tone === 'red'
      ? 'border-red-500/20 bg-red-500/5 [&_strong]:text-red-600 dark:[&_strong]:text-red-400'
      : 'border-amber-500/20 bg-amber-500/5 [&_strong]:text-amber-700 dark:[&_strong]:text-amber-400';
  return (
    <div className={`rounded-2xl border p-4 text-[15px] leading-relaxed text-foreground/90 font-medium ${cls}`}>
      <Icon name="circle-info" className={`mr-2 ${tone === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
      {children}
    </div>
  );
}
