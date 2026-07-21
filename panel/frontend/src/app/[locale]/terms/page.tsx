import React from 'react';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import LegalLayout, { Section, P, UL, LI, Notice } from '@/components/legal/LegalLayout';
import { OPERATOR, CONTACT } from '@/lib/legal';

export function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Metadata {
  if (locale === 'en') {
    return {
      title: 'Terms of Service | Siamsite Panel',
      description: 'Terms and conditions for using the Siamsite Panel platform.',
      alternates: { canonical: '/en/terms' },
    };
  }
  return {
    title: 'ข้อกำหนดการใช้บริการ | Siamsite Panel',
    description: 'ข้อกำหนดและเงื่อนไขการใช้บริการแพลตฟอร์ม Siamsite Panel',
    alternates: { canonical: '/terms' },
  };
}

/**
 * Rich-text tag map for clauses containing emphasis. next-intl renders <b>...</b>
 * in a message through this, which keeps markup out of the translation strings
 * as raw HTML and means neither language can inject tags.
 */
const RICH = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };

export default function TermsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = useTranslations('legal.terms');

  return (
    <LegalLayout current="terms" title={t('title')} subtitle={t('subtitle')}>
      {/* Shown in both languages: the Thai page declares itself binding, the
          English one declares itself a convenience translation. Publishing a
          translated contract without stating which language governs is the
          part that actually creates legal exposure. */}
      <Notice>{t('translationNotice')}</Notice>

      <Section n="1." title={t('s1title')}>
        <P>
          {t.rich('s1p1', {
            ...RICH,
            operator: OPERATOR.nameTh,
            status: OPERATOR.status,
            service: OPERATOR.service,
            domain: OPERATOR.domain,
          })}
        </P>
        <P>{t('s1p2')}</P>
        <P>{t.rich('s1p3', RICH)}</P>
      </Section>

      <Section n="2." title={t('s2title')}>
        <UL>
          <LI>{t('s2li1')}</LI>
          <LI>{t('s2li2')}</LI>
          <LI>{t('s2li3')}</LI>
          <LI>{t('s2li4')}</LI>
        </UL>
      </Section>

      <Section n="3." title={t('s3title')}>
        <UL>
          <LI>{t('s3li1')}</LI>
          <LI>{t('s3li2', { email: CONTACT.email })}</LI>
          <LI>{t('s3li3')}</LI>
        </UL>
      </Section>

      <Section n="4." title={t('s4title')}>
        <P>{t.rich('s4p1', RICH)}</P>
        <Notice>{t.rich('s4notice', RICH)}</Notice>
      </Section>

      <Section n="5." title={t('s5title')}>
        <UL>
          <LI>{t('s5li1')}</LI>
          <LI>{t.rich('s5li2', RICH)}</LI>
          <LI>{t('s5li3')}</LI>
        </UL>
      </Section>

      <Section n="6." title={t('s6title')}>
        <P>{t('s6p1')}</P>
        <UL>
          <LI>{t('s6li1')}</LI>
          <LI>{t('s6li2')}</LI>
          <LI>{t.rich('s6li3', RICH)}</LI>
          <LI>{t('s6li4')}</LI>
          <LI>{t('s6li5')}</LI>
        </UL>
      </Section>

      <Section n="7." title={t('s7title')}>
        <P>{t('s7p1')}</P>
      </Section>

      <Section n="8." title={t('s8title')}>
        <UL>
          <LI>{t('s8li1')}</LI>
          <LI>{t('s8li2')}</LI>
          <LI>{t('s8li3')}</LI>
        </UL>
      </Section>

      <Section n="9." title={t('s9title')}>
        <P>{t('s9p1')}</P>
        <P>{t('s9p2')}</P>
      </Section>

      <Section n="10." title={t('s10title')}>
        <P>{t('s10p1')}</P>
      </Section>

      <Section n="11." title={t('s11title')}>
        <P>{t('s11p1')}</P>
      </Section>

      <Section n="12." title={t('s12title')}>
        <P>{t('s12p1')}</P>
      </Section>
    </LegalLayout>
  );
}
