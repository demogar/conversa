import { Callout, Code } from '@demogar/mola-ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalDocument, type LegalSection } from '@/features/legal/legal-document';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.dataDeletion');
  return { title: t('title') };
}

/** Meta's data deletion callback sends people here with `?code=` once a request is recorded. */
export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const t = await getTranslations('legal.dataDeletion');
  const { code: raw } = await searchParams;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 64);
  return (
    <LegalDocument title={t('title')} lead={t('lead')} sections={t.raw('sections') as LegalSection[]}>
      {code ? (
        <Callout tone="success" headingLevel={2} title={t('confirmationTitle')}>
          <p className="m-0">{t('confirmationDescription')}</p>
          <p className="mt-2 mb-0">
            {t('confirmationCode')}: <Code>{code}</Code>
          </p>
        </Callout>
      ) : null}
    </LegalDocument>
  );
}
