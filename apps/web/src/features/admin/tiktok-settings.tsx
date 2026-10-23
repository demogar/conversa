'use client';

import {
  AlertDialog,
  Badge,
  type BadgeTone,
  Button,
  Callout,
  CodeBlock,
  DescriptionList,
  Field,
  Form,
  Heading,
  Input,
  Link,
  RelativeTime,
  Skeleton,
  SkeletonGroup,
  useToast,
} from '@demogar/mola-ui';
import {
  type AppCredentialsCheck,
  type TikTokAppSettingsDto,
  updateTikTokSettingsSchema,
} from '@conversa/shared';
import { RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import {
  useClearInstanceSettings,
  useTikTokSetupStatus,
  useUpdateInstanceSettings,
} from '@/lib/api/hooks/admin';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { SecretField } from './secret-field';

const DEVELOPER_PORTAL = 'https://business-api.tiktok.com/portal';

const CREDENTIALS_TONE: Record<AppCredentialsCheck, BadgeTone> = {
  valid: 'success',
  invalid: 'danger',
  unknown: 'neutral',
  not_configured: 'neutral',
};

/** Whether TikTok accepts the app ID and secret, and when its webhooks last arrived. */
function TikTokSetupStatus() {
  const t = useTranslations('admin.status');
  const tTikTok = useTranslations('admin.tiktok');
  const locale = useLocale();
  const status = useTikTokSetupStatus();

  return (
    <section aria-labelledby="tiktok-setup-status" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} visualLevel={4} id="tiktok-setup-status">
          {tTikTok('statusTitle')}
        </Heading>
        {status.data ? (
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
        <SkeletonGroup loading label={t('loading')} fallback={<Skeleton className="h-16" />} />
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
                term: t('lastEvent'),
                detail: status.data.lastEventAt ? (
                  <RelativeTime date={status.data.lastEventAt} locale={locale} />
                ) : (
                  <span>{t('never')}</span>
                ),
              },
            ]}
          />
          {status.data.credentials === 'invalid' ? (
            <Callout tone="danger" variant="flat">
              {tTikTok('invalid')}
            </Callout>
          ) : null}
        </>
      )}
    </section>
  );
}

export function TikTokSection({
  settings,
  sandbox,
}: {
  settings: TikTokAppSettingsDto;
  sandbox: boolean;
}) {
  const t = useTranslations('admin.tiktok');
  const tCommon = useTranslations('common.actions');
  const tFields = useTranslations('errors.fields');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const update = useUpdateInstanceSettings('tiktok');
  const clear = useClearInstanceSettings('tiktok');
  const [appId, setAppId] = useState(settings.appId ?? '');
  const [appSecret, setAppSecret] = useState('');
  const [authorizationUrl, setAuthorizationUrl] = useState(settings.authorizationUrl ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  // Remounts the secret field after a save, so a replaced secret shows as stored again.
  const [saves, setSaves] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateTikTokSettingsSchema.safeParse({ appId, appSecret, authorizationUrl });
    const next = parsed.success ? {} : toFieldErrors(parsed.error);
    // The first save needs the secret; later saves may leave the stored one alone.
    if (!settings.appSecret.configured && !appSecret.trim()) next.appSecret ??= tFields('required');
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    try {
      await update.mutateAsync(parsed.data);
      setSaves((count) => count + 1);
      setAppSecret('');
      toast.success({ title: t('saved') });
    } catch (error) {
      setErrors(toFieldErrors(error));
    }
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
    <SettingsSection id="admin-tiktok" title={t('title')} description={t('description')}>
      {sandbox ? (
        <Callout tone="info" variant="flat" title={t('sandboxTitle')} headingLevel={3}>
          {t('sandboxDescription')}
        </Callout>
      ) : !settings.configured ? (
        <Callout tone="info" variant="flat">
          {t('off')}
        </Callout>
      ) : null}

      <Callout tone="warn" variant="flat" title={t('limitsTitle')} headingLevel={3}>
        {t('limitsBody')}
      </Callout>

      {sandbox || !settings.configured ? null : <TikTokSetupStatus />}

      <section aria-labelledby="tiktok-steps" className="flex flex-col gap-3">
        <Heading level={3} visualLevel={4} id="tiktok-steps">
          {t('stepsTitle')}
        </Heading>
        <ol className="m-0 flex flex-col gap-2 ps-5 text-sm">
          <li>
            {t.rich('steps.create', {
              portal: (chunks) => (
                <Link external href={DEVELOPER_PORTAL}>
                  {chunks}
                </Link>
              ),
            })}
          </li>
          <li>{t('steps.permissions')}</li>
          <li>{t('steps.redirect')}</li>
          <li>{t('steps.paste')}</li>
          <li>{t('steps.webhook')}</li>
        </ol>
        <CodeBlock label={t('redirectUrl')} code={settings.urls.oauthRedirect} wrap />
        <CodeBlock label={t('webhookUrl')} code={settings.urls.webhook} wrap />
      </section>

      <Form onSubmit={submit} aria-label={t('title')}>
        <div className="flex flex-col gap-5">
          {update.error && !Object.keys(errors).length ? (
            <Callout tone="danger">{errorMessage(update.error)}</Callout>
          ) : null}
          <Field label={t('appId')} required error={errors.appId} hint={t('appIdHint')}>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={appId}
                onChange={(event) => setAppId(event.target.value.trim())}
                autoComplete="off"
              />
            )}
          </Field>
          <SecretField
            key={`appSecret-${saves}`}
            label={t('appSecret')}
            status={settings.appSecret}
            value={appSecret}
            onChange={setAppSecret}
            error={errors.appSecret}
            hint={t('appSecretHint')}
            required
          />
          <Field
            label={t('authorizationUrl')}
            required
            error={errors.authorizationUrl}
            hint={t('authorizationUrlHint')}
          >
            {(control) => (
              <Input
                {...control}
                type="url"
                value={authorizationUrl}
                onChange={(event) => setAuthorizationUrl(event.target.value.trim())}
                autoComplete="off"
              />
            )}
          </Field>
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
            <Button type="submit" loading={update.isPending}>
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
