'use client';

import { Button, Callout, Code, CodeBlock, Heading, Link } from '@demogar/mola-ui';
import type { MetaAppUrlsDto } from '@conversa/shared';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

export const META_GUIDE_STEPS = [
  'create',
  'credentials',
  'webhooks',
  'login',
  'basic',
  'roles',
  'account',
  'publish',
  'connect',
] as const;
export type MetaGuideStep = (typeof META_GUIDE_STEPS)[number];

/** `/admin#meta-guide-publish` opens the guide at that step. */
export const metaGuideHash = (step: MetaGuideStep) => `meta-guide-${step}`;

export function isMetaGuideStep(value: string): value is MetaGuideStep {
  return (META_GUIDE_STEPS as readonly string[]).includes(value);
}

const laterStep = (a: MetaGuideStep, b: MetaGuideStep) =>
  META_GUIDE_STEPS.indexOf(a) >= META_GUIDE_STEPS.indexOf(b) ? a : b;

/**
 * Where the guide opens: after what Conversa can see is done (the app saved,
 * the webhook verified by Meta, events arriving), or at the furthest step this
 * browser opened, since the steps in Meta's dashboard leave nothing to check.
 */
export function metaGuideStartStep(
  progress: {
    configured: boolean;
    webhookVerifiedAt?: string | null;
    lastEventAt?: string | null;
  },
  furthestOpened: MetaGuideStep | null = null,
): MetaGuideStep {
  // Nothing saved: a step remembered from an app since removed no longer holds.
  if (!progress.configured) return furthestOpened === 'credentials' ? 'credentials' : 'create';
  const seen: MetaGuideStep = progress.lastEventAt
    ? 'connect'
    : progress.webhookVerifiedAt
      ? 'login'
      : 'webhooks';
  return furthestOpened ? laterStep(seen, furthestOpened) : seen;
}

const FURTHEST_STEP_KEY = 'conversa-meta-guide-step';

export function readFurthestMetaGuideStep(): MetaGuideStep | null {
  try {
    const value = localStorage.getItem(FURTHEST_STEP_KEY);
    return value && isMetaGuideStep(value) ? value : null;
  } catch {
    return null;
  }
}

/** Remembers the step only when it is past the one stored, so looking back loses nothing. */
export function rememberMetaGuideStep(step: MetaGuideStep): void {
  try {
    const stored = readFurthestMetaGuideStep();
    localStorage.setItem(FURTHEST_STEP_KEY, stored ? laterStep(step, stored) : step);
  } catch {
    // Storage blocked: the guide still opens from what Conversa can see.
  }
}

/** A value to paste into Meta, by the name of the Meta field it goes into. */
type Paste = { field: string; value: keyof MetaAppUrlsDto | 'verifyToken' };

interface StepSpec {
  paste?: Paste[];
  /** Webhook fields to turn on, as Meta names them. */
  subscribe?: string[];
  link?: { href: string; label: 'openApps' | 'openTesterInvites' };
  mistake?: boolean;
  note?: boolean;
}

const SPEC: Record<MetaGuideStep, StepSpec> = {
  create: { link: { href: 'https://developers.facebook.com/apps', label: 'openApps' } },
  credentials: { mistake: true },
  webhooks: {
    paste: [
      { field: 'callbackUrl', value: 'webhook' },
      { field: 'verifyToken', value: 'verifyToken' },
    ],
    subscribe: ['comments', 'messages', 'messaging_postbacks'],
    mistake: true,
  },
  login: {
    paste: [
      { field: 'oauthRedirect', value: 'oauthRedirect' },
      { field: 'deauthorize', value: 'deauthorize' },
      { field: 'dataDeletion', value: 'dataDeletion' },
    ],
    mistake: true,
  },
  basic: {
    paste: [
      { field: 'privacyPolicy', value: 'privacyPolicy' },
      { field: 'termsOfService', value: 'termsOfService' },
      { field: 'userDataDeletion', value: 'dataDeletion' },
    ],
    mistake: true,
  },
  roles: {
    link: { href: 'https://www.instagram.com/accounts/manage_access/', label: 'openTesterInvites' },
    mistake: true,
  },
  account: { mistake: true },
  publish: { mistake: true, note: true },
  connect: {},
};

/**
 * Setting up the Meta app, one step at a time: where to go in Meta's
 * dashboard, what it looks like, what to paste into which field, and the
 * mistake people make there. Used on /admin and in the first-run setup.
 */
export function MetaSetupGuide({
  urls,
  verifyToken,
  step: controlledStep,
  onStepChange,
  headingLevel = 3,
}: {
  urls: MetaAppUrlsDto;
  /** The verify token, while the browser still knows it (before or just after saving). */
  verifyToken: string | null;
  step?: MetaGuideStep;
  onStepChange?: (step: MetaGuideStep) => void;
  headingLevel?: 2 | 3;
}) {
  const t = useTranslations('admin.guide');
  const [ownStep, setOwnStep] = useState<MetaGuideStep>('create');
  const step = controlledStep ?? ownStep;
  const index = META_GUIDE_STEPS.indexOf(step);
  const spec = SPEC[step];
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Focus follows the step once someone moves, so a screen reader hears the new one.
  useEffect(() => {
    if (moved.current) titleRef.current?.focus();
  }, [step]);

  function go(next: MetaGuideStep) {
    moved.current = true;
    setOwnStep(next);
    onStepChange?.(next);
  }

  const stepLevel = headingLevel === 2 ? 3 : 4;

  return (
    <section aria-labelledby={`${titleId}-guide`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading level={headingLevel} visualLevel={4} id={`${titleId}-guide`}>
          {t('title')}
        </Heading>
        <p className="m-0 text-sm text-ink-2">{t('intro')}</p>
        <p className="m-0 text-xs text-ink-muted">{t('menuNote')}</p>
      </div>

      <nav aria-label={t('stepsLabel')}>
        <ol className="m-0 flex list-none flex-wrap gap-1 p-0">
          {META_GUIDE_STEPS.map((id, position) => {
            // Numbers only, so all nine fit on a phone; the open step's title is right below.
            const name = `${position + 1}. ${t(`steps.${id}.title`)}`;
            return (
              <li key={id}>
                <Button
                  size="sm"
                  variant={id === step ? 'secondary' : 'ghost'}
                  aria-current={id === step ? 'step' : undefined}
                  aria-label={name}
                  title={name}
                  className="w-(--control-h-sm) px-0 tabular-nums"
                  onClick={() => go(id)}
                >
                  {position + 1}
                </Button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div
        id={metaGuideHash(step)}
        role="group"
        aria-labelledby={titleId}
        className="flex flex-col gap-4 bg-cloth p-4 shadow-cut"
      >
        <div className="flex flex-col gap-1">
          <p className="m-0 text-xs text-ink-muted">
            {t('progress', { current: index + 1, total: META_GUIDE_STEPS.length })}
          </p>
          <Heading
            level={stepLevel}
            visualLevel={4}
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="outline-none"
          >
            {t(`steps.${step}.title`)}
          </Heading>
        </div>

        <dl className="m-0 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-ink-muted">{t('where')}</dt>
            <dd className="m-0 text-sm font-medium">{t(`steps.${step}.where`)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-ink-muted">{t('see')}</dt>
            <dd className="m-0 text-sm text-ink-2">{t(`steps.${step}.see`)}</dd>
          </div>
        </dl>

        <p className="m-0 text-sm">{t(`steps.${step}.do`)}</p>

        {spec.link ? (
          <Link variant="standalone" external href={spec.link.href}>
            {t(spec.link.label)}
          </Link>
        ) : null}

        {spec.paste ? (
          <div className="flex flex-col gap-3">
            {spec.paste.map(({ field, value }) =>
              value === 'verifyToken' && !verifyToken ? (
                <Callout key={field} tone="info" variant="flat">
                  {t('verifyTokenHidden')}
                </Callout>
              ) : (
                <CodeBlock
                  key={field}
                  label={t(`fields.${field}` as 'fields.callbackUrl')}
                  code={value === 'verifyToken' ? verifyToken! : urls[value]}
                  wrap
                />
              ),
            )}
          </div>
        ) : null}

        {spec.subscribe ? (
          <div className="flex flex-col gap-1">
            <p className="m-0 text-sm">{t('subscribe')}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {spec.subscribe.map((field) => (
                <li key={field}>
                  <Code>{field}</Code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {spec.mistake ? (
          <Callout tone="warn" title={t('mistake')} headingLevel={stepLevel === 3 ? 4 : 5}>
            {t(`steps.${step}.mistake` as 'steps.credentials.mistake')}
          </Callout>
        ) : null}

        {spec.note ? (
          <p className="m-0 text-sm text-ink-2">
            {t(`steps.${step}.note` as 'steps.publish.note')}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-2">
          {index > 0 ? (
            <Button
              variant="ghost"
              icon={<ArrowLeft />}
              onClick={() => go(META_GUIDE_STEPS[index - 1]!)}
            >
              {t('previous')}
            </Button>
          ) : (
            <span />
          )}
          {index < META_GUIDE_STEPS.length - 1 ? (
            <Button variant="secondary" withArrow onClick={() => go(META_GUIDE_STEPS[index + 1]!)}>
              {t('next')}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
