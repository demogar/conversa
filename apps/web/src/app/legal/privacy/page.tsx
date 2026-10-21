import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalDocument, type LegalSection } from '@/features/legal/legal-document';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy');
  return { title: t('title') };
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal.privacy');
  return (
    <LegalDocument
      title={t('title')}
      lead={t('lead')}
      sections={t.raw('sections') as LegalSection[]}
    />
  );
}
