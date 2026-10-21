'use client';

import { AlertDialog, Button, Callout, Field, Form, Input, useToast } from '@demogar/mola-ui';
import { type TurnstileSettingsDto, updateTurnstileSettingsSchema } from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import { useClearInstanceSettings, useUpdateInstanceSettings } from '@/lib/api/hooks/admin';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { SecretField } from './secret-field';

export function useTurnstileForm(settings: TurnstileSettingsDto) {
  const update = useUpdateInstanceSettings('turnstile');
  const toFieldErrors = useFieldErrors();
  const tFields = useTranslations('errors.fields');
  const [siteKey, setSiteKey] = useState(settings.siteKey ?? '');
  const [secretKey, setSecretKey] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  // Remounts the secret fields after a save, so a replaced secret shows as stored again.
  const [saves, setSaves] = useState(0);

  async function save(): Promise<boolean> {
    const parsed = updateTurnstileSettingsSchema.safeParse({ siteKey, secretKey });
    const next = parsed.success ? {} : toFieldErrors(parsed.error);
    if (!settings.secretKey.configured && !secretKey.trim()) next.secretKey ??= tFields('required');
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return false;
    try {
      await update.mutateAsync(parsed.data);
      setSaves((count) => count + 1);
      setSecretKey('');
      return true;
    } catch (error) {
      setErrors(toFieldErrors(error));
      return false;
    }
  }

  return {
    settings,
    values: { siteKey, secretKey },
    set: { siteKey: setSiteKey, secretKey: setSecretKey },
    errors,
    saves,
    error: update.error,
    pending: update.isPending,
    save,
  };
}

export type TurnstileForm = ReturnType<typeof useTurnstileForm>;

export function TurnstileFields({ form }: { form: TurnstileForm }) {
  const t = useTranslations('admin.turnstile');
  const errorMessage = useErrorMessage();
  const { values, set, errors } = form;
  return (
    <div className="flex flex-col gap-5">
      {form.error && !Object.keys(errors).length ? (
        <Callout tone="danger">{errorMessage(form.error)}</Callout>
      ) : null}
      <Field label={t('siteKey')} required error={errors.siteKey} hint={t('siteKeyHint')}>
        {(control) => (
          <Input
            {...control}
            value={values.siteKey}
            onChange={(event) => set.siteKey(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      <SecretField
        key={`secretKey-${form.saves}`}
        label={t('secretKey')}
        status={form.settings.secretKey}
        value={values.secretKey}
        onChange={set.secretKey}
        error={errors.secretKey}
        required
      />
    </div>
  );
}

export function TurnstileSection({ settings }: { settings: TurnstileSettingsDto }) {
  const t = useTranslations('admin.turnstile');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const form = useTurnstileForm(settings);
  const clear = useClearInstanceSettings('turnstile');
  const [confirming, setConfirming] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void form.save().then((saved) => saved && toast.success({ title: t('saved') }));
  }

  async function confirmClear() {
    try {
      await clear.mutateAsync();
    } catch (failure) {
      setClearError(errorMessage(failure));
      throw failure;
    }
    toast.show({ title: t('turnedOff') });
  }

  return (
    <SettingsSection id="admin-turnstile" title={t('title')} description={t('description')}>
      <Callout tone="info" variant="flat">
        {settings.configured ? t('on') : t('optional')}
      </Callout>
      <Form onSubmit={submit} aria-label={t('title')}>
        <div className="flex flex-col gap-5">
          <TurnstileFields form={form} />
          <div className="flex flex-wrap justify-end gap-2">
            {settings.siteKey ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setClearError(null);
                  setConfirming(true);
                }}
              >
                {t('turnOff')}
              </Button>
            ) : null}
            <Button type="submit" loading={form.pending}>
              {tCommon('save')}
            </Button>
          </div>
        </div>
      </Form>
      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('turnOffDialogTitle')}
        description={t('turnOffDialogDescription')}
        confirmLabel={t('turnOff')}
        error={clearError}
        onConfirm={confirmClear}
      />
    </SettingsSection>
  );
}
