'use client';

import {
  AlertDialog,
  Button,
  Callout,
  Field,
  Form,
  Input,
  Select,
  useToast,
} from '@demogar/mola-ui';
import {
  MAIL_SECURITY,
  type MailSecurity,
  type MailSettingsDto,
  type MailTestFailure,
  updateMailSettingsSchema,
} from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import {
  useClearInstanceSettings,
  useSendTestMail,
  useUpdateInstanceSettings,
} from '@/lib/api/hooks/admin';
import { useMe } from '@/lib/api/hooks/session';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { SecretField } from './secret-field';

/** The usual port for each kind of connection, filled in when the port is still empty. */
const DEFAULT_PORT: Record<MailSecurity, string> = { tls: '465', starttls: '587', none: '25' };

/** The mail form's state and its save, shared by the admin page and the setup wizard. */
export function useMailForm(settings: MailSettingsDto) {
  const update = useUpdateInstanceSettings('mail');
  const toFieldErrors = useFieldErrors();
  const [host, setHost] = useState(settings.host ?? '');
  const [port, setPort] = useState(
    settings.port ? String(settings.port) : DEFAULT_PORT[settings.security],
  );
  const [security, setSecurity] = useState<MailSecurity>(settings.security);
  const [username, setUsername] = useState(settings.username ?? '');
  const [password, setPassword] = useState('');
  const [fromName, setFromName] = useState(settings.fromName || 'Conversa');
  const [fromAddress, setFromAddress] = useState(settings.fromAddress ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  // Remounts the secret fields after a save, so a replaced secret shows as stored again.
  const [saves, setSaves] = useState(0);

  /** Validates and saves; resolves true when saved. */
  async function save(): Promise<boolean> {
    const parsed = updateMailSettingsSchema.safeParse({
      host,
      port,
      security,
      username,
      password,
      fromName,
      fromAddress,
    });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return false;
    try {
      await update.mutateAsync(parsed.data);
      setSaves((count) => count + 1);
      setPassword('');
      return true;
    } catch (error) {
      setErrors(toFieldErrors(error));
      return false;
    }
  }

  return {
    settings,
    values: { host, port, security, username, password, fromName, fromAddress },
    set: {
      host: setHost,
      port: setPort,
      security: (value: MailSecurity) => {
        setSecurity(value);
        if (!port || Object.values(DEFAULT_PORT).includes(port)) setPort(DEFAULT_PORT[value]);
      },
      username: setUsername,
      password: setPassword,
      fromName: setFromName,
      fromAddress: setFromAddress,
    },
    errors,
    saves,
    error: update.error,
    pending: update.isPending,
    save,
  };
}

export type MailForm = ReturnType<typeof useMailForm>;

export function MailFields({ form }: { form: MailForm }) {
  const t = useTranslations('admin.mail');
  const errorMessage = useErrorMessage();
  const { values, set, errors } = form;

  return (
    <div className="flex flex-col gap-5">
      {form.error && !Object.keys(errors).length ? (
        <Callout tone="danger">{errorMessage(form.error)}</Callout>
      ) : null}
      <div className="grid grid-cols-1 gap-5 @lg/form:grid-cols-[minmax(0,1fr)_8rem]">
        <Field label={t('host')} required error={errors.host} hint={t('hostHint')}>
          {(control) => (
            <Input
              {...control}
              value={values.host}
              onChange={(event) => set.host(event.target.value)}
              placeholder="smtp.example.com"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>
        <Field label={t('port')} required error={errors.port}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              value={values.port}
              onChange={(event) => set.port(event.target.value.replace(/\D/g, ''))}
              autoComplete="off"
            />
          )}
        </Field>
      </div>
      <Field label={t('security')} error={errors.security}>
        {(control) => (
          <Select<MailSecurity>
            {...control}
            value={values.security}
            onValueChange={(value) => value && set.security(value)}
            items={MAIL_SECURITY.map((value) => ({
              value,
              label: t(`securityOptions.${value}.label`),
              description: t(`securityOptions.${value}.description`),
            }))}
          />
        )}
      </Field>
      <Field label={t('username')} optional error={errors.username} hint={t('usernameHint')}>
        {(control) => (
          <Input
            {...control}
            value={values.username}
            onChange={(event) => set.username(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      <SecretField
        key={`password-${form.saves}`}
        label={t('password')}
        status={form.settings.password}
        value={values.password}
        onChange={set.password}
        error={errors.password}
      />
      <div className="grid grid-cols-1 gap-5 @lg/form:grid-cols-2">
        <Field label={t('fromName')} error={errors.fromName}>
          {(control) => (
            <Input
              {...control}
              value={values.fromName}
              onChange={(event) => set.fromName(event.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label={t('fromAddress')} required error={errors.fromAddress}>
          {(control) => (
            <Input
              {...control}
              type="email"
              value={values.fromAddress}
              onChange={(event) => set.fromAddress(event.target.value)}
              placeholder="no-reply@example.com"
              autoComplete="off"
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/** Sends a test message to the signed-in admin with the saved settings. */
export function MailTestButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('admin.mail.test');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const me = useMe();
  const send = useSendTestMail();
  const [failure, setFailure] = useState<MailTestFailure | null>(null);
  const email = me.data?.user.email;

  function run() {
    if (!email) return;
    setFailure(null);
    send.mutate(email, {
      onSuccess: (result) => {
        if (result.ok) toast.success({ title: t('sent', { email }) });
        else setFailure(result.failure ?? 'unknown');
      },
      onError: (error) =>
        toast.error({ title: t('failedTitle'), description: errorMessage(error) }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {failure ? (
        <Callout tone="danger" title={t('failedTitle')} headingLevel={3}>
          {t(`failure.${failure}`)}
        </Callout>
      ) : null}
      <div>
        <Button
          variant="secondary"
          loading={send.isPending}
          disabled={disabled || !email}
          onClick={run}
        >
          {t('button')}
        </Button>
        <p className="mt-1.5 mb-0 text-sm text-ink-muted">{email ? t('hint', { email }) : null}</p>
      </div>
    </div>
  );
}

export function MailSection({ settings }: { settings: MailSettingsDto }) {
  const t = useTranslations('admin.mail');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const form = useMailForm(settings);
  const clear = useClearInstanceSettings('mail');
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
    <SettingsSection id="admin-mail" title={t('title')} description={t('description')}>
      {!settings.configured ? (
        <Callout tone="info" variant="flat">
          {t('off')}
        </Callout>
      ) : null}
      <Form onSubmit={submit} aria-label={t('title')}>
        <div className="flex flex-col gap-5">
          <MailFields form={form} />
          <div className="flex flex-wrap justify-end gap-2">
            {settings.configured ? (
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
      {settings.configured ? <MailTestButton /> : null}
      <AlertDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t('turnOffDialogTitle')}
        description={t('turnOffDialogDescription')}
        confirmLabel={t('turnOff')}
        error={clearError}
        onConfirm={confirmClear}
      />
    </SettingsSection>
  );
}
