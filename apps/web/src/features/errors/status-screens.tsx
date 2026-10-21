'use client';

import { Button, Code, EmptyState, LinkButton } from '@demogar/mola-ui';
import { RotateCcw } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { BrandMark } from '@/features/brand/brand-mark';

/**
 * A page outside the app shell: the mark, then one state. The state's own
 * title is an h2, so a short h1 names the page for screen readers.
 */
function StandaloneFrame({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-cloth px-4 py-10">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <BrandMark />
        <h1 className="sr-only">{heading}</h1>
        {children}
      </div>
    </main>
  );
}

/** The 404 page: the address leads nowhere, so offer the way back in. */
export function NotFoundScreen() {
  const t = useTranslations('common.notFound');
  return (
    <StandaloneFrame heading={t('heading')}>
      <EmptyState
        kind="no-results"
        size="lg"
        headingLevel={2}
        title={t('title')}
        description={t('description')}
        actions={<LinkButton render={<NextLink href="/" />}>{t('action')}</LinkButton>}
      />
    </StandaloneFrame>
  );
}

/**
 * What an error boundary shows. Inside the workspace it fills the content
 * area and keeps the navigation; at the root it stands alone.
 */
export function RouteErrorScreen({
  error,
  retry,
  standalone = false,
}: {
  error: unknown;
  retry: () => void;
  standalone?: boolean;
}) {
  const t = useTranslations('common');
  // Server errors carry a digest that matches the server log; the message itself is never shown.
  const digest =
    error instanceof Error && 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : null;

  const state = (
    <EmptyState
      kind="error"
      size="lg"
      headingLevel={2}
      title={t('errorPage.title')}
      description={
        <>
          {t('errorPage.description')}
          {digest ? (
            <>
              {' '}
              {t.rich('errorPage.reference', {
                digest,
                code: (chunks) => <Code>{chunks}</Code>,
              })}
            </>
          ) : null}
        </>
      }
      actions={
        <>
          <Button icon={<RotateCcw />} onClick={retry}>
            {t('actions.retry')}
          </Button>
          {standalone ? (
            <LinkButton variant="secondary" render={<NextLink href="/" />}>
              {t('errorPage.home')}
            </LinkButton>
          ) : null}
        </>
      }
    />
  );

  if (standalone)
    return <StandaloneFrame heading={t('errorPage.heading')}>{state}</StandaloneFrame>;
  return (
    <div className="p-4 sm:p-6">
      <h1 className="sr-only">{t('errorPage.heading')}</h1>
      {state}
    </div>
  );
}
