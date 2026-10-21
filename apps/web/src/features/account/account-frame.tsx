'use client';

import { LinkButton } from '@demogar/mola-ui';
import { ArrowLeft } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandMark } from '@/features/brand/brand-mark';

/**
 * The account page lives outside any workspace: the mark, a way back, and the page.
 * Language and theme are sections of the page itself, so there is no preferences bar.
 */
export function AccountFrame({ children }: { children: ReactNode }) {
  const t = useTranslations('account');

  return (
    <div className="min-h-dvh bg-cloth">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <NextLink href="/" className="no-underline">
          <BrandMark />
        </NextLink>
        <LinkButton variant="ghost" size="sm" icon={<ArrowLeft />} render={<NextLink href="/" />}>
          {t('back')}
        </LinkButton>
      </header>
      <main className="mx-auto w-full max-w-5xl pb-10">{children}</main>
    </div>
  );
}
