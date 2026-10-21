'use client';

import { LinkButton } from '@demogar/mola-ui';
import type { Locale } from '@conversa/shared';
import { ArrowLeft } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandMark } from '@/features/brand/brand-mark';
import { PreferencesBar } from '@/features/preferences/preferences-bar';
import { useUpdateProfile } from '@/lib/api/hooks/account';

/** The account page lives outside any workspace: the mark, a way back, the page, and the preferences. */
export function AccountFrame({ children }: { children: ReactNode }) {
  const t = useTranslations('account');
  const update = useUpdateProfile();

  // The language is saved to the account too, so emails follow it. The cookie
  // is already set, so a failed save still changes this browser.
  async function saveLocale(locale: Locale) {
    await update.mutateAsync({ locale }).catch(() => undefined);
  }

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
      <main className="mx-auto w-full max-w-5xl">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 pt-4 pb-10 sm:px-6">
        <PreferencesBar onLocaleChange={saveLocale} />
      </footer>
    </div>
  );
}
