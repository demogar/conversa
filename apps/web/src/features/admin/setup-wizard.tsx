'use client';

import { Badge, Button, Callout, PageHeader, Stepper, type StepperStep } from '@demogar/mola-ui';
import type { InstanceSettingsDto } from '@conversa/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AdminGate } from './admin-gate';
import { InstagramFields, MetaSteps, MetaUrls, useInstagramForm } from './instagram-settings';
import { MailFields, MailTestButton, useMailForm } from './mail-settings';
import { TurnstileFields, useTurnstileForm } from './turnstile-settings';

const STEPS = ['mail', 'instagram', 'turnstile', 'done'] as const;
type Step = (typeof STEPS)[number];

/** The first run: what the installation needs, one skippable step at a time. */
export function SetupWizard() {
  const t = useTranslations('admin.setup');
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="@container/form px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="max-w-3xl">
          <AdminGate>{(settings) => <Wizard settings={settings} />}</AdminGate>
        </div>
      </div>
    </>
  );
}

function Wizard({ settings }: { settings: InstanceSettingsDto }) {
  const t = useTranslations('admin.setup');
  const router = useRouter();
  const [step, setStep] = useState<Step>('mail');
  const mail = useMailForm(settings.mail);
  const instagram = useInstagramForm(settings.instagram);
  const turnstile = useTurnstileForm(settings.turnstile);

  const steps: StepperStep[] = STEPS.map((id) => ({
    id,
    title: t(`steps.${id}.title`),
    description: t(`steps.${id}.description`),
  }));
  const next = (id: Step): Step => STEPS[Math.min(STEPS.indexOf(id) + 1, STEPS.length - 1)]!;

  async function submit(id: string): Promise<boolean> {
    if (id === 'mail') return mail.save();
    if (id === 'instagram') return instagram.save();
    if (id === 'turnstile') return turnstile.save();
    return true;
  }

  function skip() {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setStep(next(step))}>
          {t('skip')}
        </Button>
      </div>
    );
  }

  return (
    <Stepper
      label={t('label')}
      steps={steps}
      step={step}
      onStepChange={(id) => setStep(id as Step)}
      onStepSubmit={(id) => submit(id)}
      onComplete={() => router.replace('/')}
      messages={{ continue: t('saveAndContinue'), finish: t('finish') }}
    >
      {(current) => {
        switch (current.id as Step) {
          case 'mail':
            return (
              <div className="flex flex-col gap-5">
                <MailFields form={mail} />
                {settings.mail.configured ? <MailTestButton /> : null}
                {skip()}
              </div>
            );
          case 'instagram':
            return (
              <div className="flex flex-col gap-5">
                {settings.sandbox ? (
                  <Callout tone="info" variant="flat" title={t('sandboxTitle')} headingLevel={3}>
                    {t('sandboxDescription')}
                  </Callout>
                ) : null}
                <MetaSteps />
                <MetaUrls urls={settings.instagram.urls} />
                <InstagramFields form={instagram} />
                {skip()}
              </div>
            );
          case 'turnstile':
            return (
              <div className="flex flex-col gap-5">
                <p className="m-0 text-sm text-ink-2">{t('turnstileOptional')}</p>
                <TurnstileFields form={turnstile} />
                {skip()}
              </div>
            );
          default:
            return <Summary settings={settings} />;
        }
      }}
    </Stepper>
  );
}

function Summary({ settings }: { settings: InstanceSettingsDto }) {
  const t = useTranslations('admin.setup.summary');
  const rows: Array<[string, boolean]> = [
    [t('mail'), settings.mail.configured],
    [t('instagram'), settings.instagram.configured],
    [t('turnstile'), settings.turnstile.configured],
  ];
  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map(([label, configured]) => (
          <li key={label} className="flex flex-wrap items-center justify-between gap-3">
            <span>{label}</span>
            <Badge tone={configured ? 'success' : 'neutral'} dot>
              {configured ? t('configured') : t('skipped')}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="m-0 text-sm text-ink-2">{t('later')}</p>
    </div>
  );
}
