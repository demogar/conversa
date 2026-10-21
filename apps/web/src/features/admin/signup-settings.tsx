'use client';

import { Callout, Radio, RadioGroup, useToast } from '@demogar/mola-ui';
import type { SignupMode } from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { SettingsSection } from '@/features/settings/settings-section';
import { useUpdateInstanceSettings } from '@/lib/api/hooks/admin';
import { useErrorMessage } from '@/lib/errors';

/** Saved as soon as it changes: the choice takes effect on the next sign-up. */
export function SignupSection({ mode }: { mode: SignupMode }) {
  const t = useTranslations('admin.signup');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const update = useUpdateInstanceSettings('signup');

  function change(value: string) {
    const next = value as SignupMode;
    if (next === mode) return;
    update.mutate(
      { mode: next },
      { onSuccess: () => toast.success({ title: t(`saved.${next}`) }) },
    );
  }

  return (
    <SettingsSection id="admin-signup" title={t('title')} description={t('description')}>
      {update.error ? <Callout tone="danger">{errorMessage(update.error)}</Callout> : null}
      <RadioGroup
        label={t('label')}
        value={update.isPending && update.variables ? update.variables.mode : mode}
        onValueChange={(value) => change(String(value))}
        disabled={update.isPending}
      >
        <Radio
          value="invite_only"
          label={t('inviteOnly')}
          description={t('inviteOnlyDescription')}
        />
        <Radio value="open" label={t('open')} description={t('openDescription')} />
      </RadioGroup>
    </SettingsSection>
  );
}
