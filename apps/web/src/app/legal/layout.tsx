import { Container } from '@demogar/mola-ui';
import NextLink from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BrandMark } from '@/features/brand/brand-mark';
import { LegalNav } from '@/features/legal/legal-nav';
import { PreferencesBar } from '@/features/preferences/preferences-bar';

/** Public pages: reachable without signing in, so platforms and visitors can read them. */
export default async function LegalLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('legal.nav');
  return (
    <div className="min-h-dvh bg-cloth">
      <header className="rule-b bg-cloth-pale">
        <Container
          width="prose"
          className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
        >
          <NextLink href="/" aria-label={t('home')} className="no-underline">
            <BrandMark />
          </NextLink>
          <LegalNav />
        </Container>
      </header>
      <main>
        <Container width="prose" className="flex flex-col gap-10 px-4 py-10">
          {children}
          <PreferencesBar />
        </Container>
      </main>
    </div>
  );
}
