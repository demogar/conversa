'use client';

import { AlertDialog, Button, Callout, Field, Form, Input, useToast } from '@demogar/mola-ui';
import { type InstagramAppSettingsDto, updateInstagramSettingsSchema } from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import { useClearInstanceSettings, useUpdateInstanceSettings } from '@/lib/api/hooks/admin';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import {
  isMetaGuideStep,
  MetaSetupGuide,
  type MetaGuideStep,
  metaGuideHash,
} from './meta-setup-guide';
import { MetaSetupStatus } from './meta-setup-status';
import { SecretField } from './secret-field';

/** A random webhook verify token, made in the browser: 24 bytes, URL-safe. */
export function generateVerifyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function useInstagramForm(settings: InstagramAppSettingsDto) {
  const update = useUpdateInstanceSettings('instagram');
  const toFieldErrors = useFieldErrors();
  const tFields = useTranslations('errors.fields');
  const [appId, setAppId] = useState(settings.appId ?? '');
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  // The server never returns the token, so keep the one just saved for the guide's webhook step.
  const [savedVerifyToken, setSavedVerifyToken] = useState<string | null>(null);
  // Remounts the secret fields after a save, so a replaced secret shows as stored again.
  const [saves, setSaves] = useState(0);

  async function save(): Promise<boolean> {
    const parsed = updateInstagramSettingsSchema.safeParse({ appId, appSecret, verifyToken });
    const next = parsed.success ? {} : toFieldErrors(parsed.error);
    // The first save needs every value; later saves may leave stored secrets alone.
    if (!settings.appSecret.configured && !appSecret.trim()) next.appSecret ??= tFields('required');
    if (!settings.verifyToken.configured && !verifyToken.trim())
      next.verifyToken ??= tFields('required');
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return false;
    try {
      await update.mutateAsync(parsed.data);
      if (verifyToken.trim()) setSavedVerifyToken(verifyToken.trim());
      setSaves((count) => count + 1);
      setAppSecret('');
      setVerifyToken('');
      return true;
    } catch (error) {
      setErrors(toFieldErrors(error));
      return false;
    }
  }

  return {
    settings,
    values: { appId, appSecret, verifyToken },
    set: { appId: setAppId, appSecret: setAppSecret, verifyToken: setVerifyToken },
    errors,
    saves,
    /** The verify token to paste into Meta, while this page still knows it. */
    verifyTokenToPaste: verifyToken.trim() || savedVerifyToken,
    error: update.error,
    pending: update.isPending,
    save,
  };
}

export type InstagramForm = ReturnType<typeof useInstagramForm>;

export function InstagramFields({ form }: { form: InstagramForm }) {
  const t = useTranslations('admin.instagram');
  const errorMessage = useErrorMessage();
  const { values, set, errors } = form;

  return (
    <div className="flex flex-col gap-5">
      {form.error && !Object.keys(errors).length ? (
        <Callout tone="danger">{errorMessage(form.error)}</Callout>
      ) : null}
      <Field label={t('appId')} required error={errors.appId} hint={t('appIdHint')}>
        {(control) => (
          <Input
            {...control}
            inputMode="numeric"
            value={values.appId}
            onChange={(event) => set.appId(event.target.value.trim())}
            autoComplete="off"
          />
        )}
      </Field>
      <SecretField
        key={`appSecret-${form.saves}`}
        label={t('appSecret')}
        status={form.settings.appSecret}
        value={values.appSecret}
        onChange={set.appSecret}
        error={errors.appSecret}
        hint={t('appSecretHint')}
        required
      />
      <SecretField
        key={`verifyToken-${form.saves}`}
        label={t('verifyToken')}
        status={form.settings.verifyToken}
        value={values.verifyToken}
        onChange={set.verifyToken}
        error={errors.verifyToken}
        hint={t('verifyTokenHint')}
        required
        reveal
        extra={
          <Button variant="secondary" onClick={() => set.verifyToken(generateVerifyToken())}>
            {t('generate')}
          </Button>
        }
      />
    </div>
  );
}

export function InstagramSection({
  settings,
  sandbox,
}: {
  settings: InstagramAppSettingsDto;
  sandbox: boolean;
}) {
  const t = useTranslations('admin.instagram');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const form = useInstagramForm(settings);
  const clear = useClearInstanceSettings('instagram');
  const [confirming, setConfirming] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [step, setStep] = useState<MetaGuideStep>(settings.configured ? 'webhooks' : 'create');

  // A hint elsewhere links to /admin#meta-guide-<step>: open the guide there, once laid out.
  useEffect(() => {
    function openFromHash() {
      const wanted = window.location.hash.replace(/^#meta-guide-/, '');
      if (!isMetaGuideStep(wanted)) return;
      setStep(wanted);
      document.getElementById('admin-instagram')?.scrollIntoView();
    }
    const frame = requestAnimationFrame(openFromHash);
    window.addEventListener('hashchange', openFromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', openFromHash);
    };
  }, []);

  function showStep(next: MetaGuideStep) {
    setStep(next);
    document.getElementById(metaGuideHash(next))?.scrollIntoView({ block: 'nearest' });
  }

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
    toast.show({ title: t('removed') });
  }

  return (
    <SettingsSection id="admin-instagram" title={t('title')} description={t('description')}>
      {sandbox ? (
        <Callout tone="info" variant="flat" title={t('sandboxTitle')} headingLevel={3}>
          {t('sandboxDescription')}
        </Callout>
      ) : !settings.configured ? (
        <Callout tone="info" variant="flat">
          {t('off')}
        </Callout>
      ) : null}
      {sandbox ? null : <MetaSetupStatus onShowStep={showStep} />}
      <MetaSetupGuide
        urls={settings.urls}
        verifyToken={form.verifyTokenToPaste}
        step={step}
        onStepChange={setStep}
      />
      <Form onSubmit={submit} aria-label={t('title')}>
        <div className="flex flex-col gap-5">
          <InstagramFields form={form} />
          <div className="flex flex-wrap justify-end gap-2">
            {settings.appId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setClearError(null);
                  setConfirming(true);
                }}
              >
                {t('remove')}
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
        tone="danger"
        title={t('removeDialogTitle')}
        description={t('removeDialogDescription')}
        confirmLabel={t('remove')}
        error={clearError}
        onConfirm={confirmClear}
      />
    </SettingsSection>
  );
}
