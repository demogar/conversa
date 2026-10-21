'use client';

import {
  Badge,
  type BadgeTone,
  Button,
  Callout,
  DescriptionList,
  Heading,
  LinkButton,
  RelativeTime,
  Skeleton,
  SkeletonGroup,
} from '@demogar/mola-ui';
import type { AppCredentialsCheck, InstagramSetupStatusDto } from '@conversa/shared';
import { RotateCcw } from 'lucide-react';
import NextLink from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useInstagramSetupStatus } from '@/lib/api/hooks/admin';
import { type MetaGuideStep, metaGuideHash } from './meta-setup-guide';

/** How long Meta gets to send a first event before Conversa suggests what to check. */
export const QUIET_AFTER_MS = 15 * 60_000;

const CREDENTIALS_TONE: Record<AppCredentialsCheck, BadgeTone> = {
  valid: 'success',
  invalid: 'danger',
  unknown: 'neutral',
  not_configured: 'neutral',
};

/** Webhooks verified a while ago, and still nothing from Meta. */
export function isQuiet(status: InstagramSetupStatusDto, now = Date.now()): boolean {
  if (!status.webhookVerifiedAt || status.lastEventAt) return false;
  return now - Date.parse(status.webhookVerifiedAt) > QUIET_AFTER_MS;
}

/**
 * What Conversa can tell about the Meta app: whether Meta accepts the app ID
 * and secret, whether it verified the webhook, and when it last sent an event.
 * Hints point at the guide step that fixes what looks wrong: on /admin they
 * open it in place, elsewhere they link to it.
 */
export function MetaSetupStatus({
  onShowStep,
  headingLevel = 3,
}: {
  onShowStep?: (step: MetaGuideStep) => void;
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations('admin.status');
  const locale = useLocale();
  const status = useInstagramSetupStatus();

  const showStep = (step: MetaGuideStep, label: string): ReactNode =>
    onShowStep ? (
      <Button size="sm" variant="secondary" onClick={() => onShowStep(step)}>
        {label}
      </Button>
    ) : (
      <LinkButton
        size="sm"
        variant="secondary"
        render={<NextLink href={`/admin#${metaGuideHash(step)}`} />}
      >
        {label}
      </LinkButton>
    );

  const when = (value: string | null, never: string) =>
    value ? <RelativeTime date={value} locale={locale} /> : <span>{never}</span>;

  return (
    <section aria-labelledby="meta-setup-status" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={headingLevel} visualLevel={4} id="meta-setup-status">
          {t('title')}
        </Heading>
        {status.data && !status.data.sandbox ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            loading={status.isFetching}
            onClick={() => void status.refetch()}
          >
            {t('refresh')}
          </Button>
        ) : null}
      </div>

      {status.isPending ? (
        <SkeletonGroup loading label={t('loading')} fallback={<Skeleton className="h-24" />} />
      ) : status.isError ? (
        <Callout
          tone="danger"
          variant="flat"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void status.refetch()}>
              {t('retry')}
            </Button>
          }
        >
          {t('loadFailed')}
        </Callout>
      ) : status.data.sandbox ? (
        <Callout tone="info" variant="flat">
          {t('sandbox')}
        </Callout>
      ) : (
        <>
          <DescriptionList
            items={[
              {
                term: t('credentials'),
                detail: (
                  <Badge tone={CREDENTIALS_TONE[status.data.credentials]} dot>
                    {t(`credentialsState.${status.data.credentials}`)}
                  </Badge>
                ),
              },
              {
                term: t('webhookVerified'),
                detail: when(status.data.webhookVerifiedAt, t('never')),
              },
              { term: t('lastEvent'), detail: when(status.data.lastEventAt, t('never')) },
            ]}
          />
          <p className="m-0 text-xs text-ink-muted">{t('credentialsHow')}</p>

          {status.data.credentials === 'invalid' ? (
            <Callout
              tone="danger"
              title={t('hints.invalid.title')}
              headingLevel={headingLevel === 2 ? 3 : 4}
              actions={showStep('credentials', t('showStep', { step: 2 }))}
            >
              {t('hints.invalid.body')}
            </Callout>
          ) : status.data.credentials === 'unknown' ? (
            <Callout tone="info" variant="flat">
              {t('hints.unknown')}
            </Callout>
          ) : null}

          {status.data.credentials !== 'not_configured' && !status.data.webhookVerifiedAt ? (
            <Callout
              tone="info"
              title={t('hints.notVerified.title')}
              headingLevel={headingLevel === 2 ? 3 : 4}
              actions={showStep('webhooks', t('showStep', { step: 3 }))}
            >
              {t('hints.notVerified.body')}
            </Callout>
          ) : null}

          {isQuiet(status.data) ? <NoEventsHint showStep={showStep} level={headingLevel} /> : null}
        </>
      )}
    </section>
  );
}

/** Nothing from Meta yet: the two settings that cause it most often. */
export function NoEventsHint({
  showStep,
  level,
}: {
  showStep: (step: MetaGuideStep, label: string) => ReactNode;
  level: 2 | 3;
}) {
  const t = useTranslations('admin.status.hints.quiet');
  const tStatus = useTranslations('admin.status');
  return (
    <Callout
      tone="warn"
      title={t('title')}
      headingLevel={level === 2 ? 3 : 4}
      actions={
        <>
          {showStep('publish', tStatus('showStep', { step: 8 }))}
          {showStep('account', tStatus('showStep', { step: 7 }))}
        </>
      }
    >
      {t('body')}
    </Callout>
  );
}
