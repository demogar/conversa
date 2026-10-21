'use client';

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/alegreya/wght.css';
import '@fontsource-variable/martian-mono/wdth.css';
import './globals.css';

import { Button, EmptyState } from '@demogar/mola-ui';
import { isLocale, type Locale } from '@conversa/shared';
import { RotateCcw } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { BrandMark } from '@/features/brand/brand-mark';
import { LOCALE_COOKIE, negotiateLocale } from '@/i18n/config';
import en from '../../messages/en/common.json';
import es from '../../messages/es/common.json';

const MESSAGES: Record<Locale, typeof en> = { en, es };

/** The saved language, then the browser's: the root layout and its providers are gone here. */
function browserLocale(): Locale {
  const saved = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1];
  return isLocale(saved) ? saved : negotiateLocale(navigator.languages.join(','));
}

function storedTheme(): string | undefined {
  try {
    const value = localStorage.getItem('conversa-theme');
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

const noSubscription = () => () => {};

/** Replaces the root layout when it fails, so it brings its own document, styles and words. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const locale = useSyncExternalStore(noSubscription, browserLocale, () => 'en' as const);
  const theme = useSyncExternalStore(noSubscription, storedTheme, () => undefined);
  const t = MESSAGES[locale];
  return (
    <html lang={locale} dir="ltr" data-density="comfortable" data-theme={theme}>
      <body>
        <title>{`${t.errorPage.heading} · Conversa`}</title>
        <main className="grid min-h-dvh place-items-center bg-cloth px-4 py-10">
          <div className="flex w-full max-w-xl flex-col gap-6">
            <BrandMark />
            <h1 className="sr-only">{t.errorPage.heading}</h1>
            <EmptyState
              kind="error"
              size="lg"
              headingLevel={2}
              title={t.errorPage.title}
              description={t.errorPage.description}
              actions={
                <Button icon={<RotateCcw />} onClick={retry}>
                  {t.actions.retry}
                </Button>
              }
            />
          </div>
        </main>
      </body>
    </html>
  );
}
