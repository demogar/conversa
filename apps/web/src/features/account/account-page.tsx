'use client';

import {
  Button,
  Callout,
  EmptyState,
  Field,
  Form,
  Input,
  PageHeader,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@demogar/mola-ui';
import {
  changePasswordSchema,
  LOCALES,
  type Locale,
  updateProfileSchema,
  type UserDto,
} from '@conversa/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { type Theme, useTheme } from '@/features/preferences/theme';
import { SettingsColumn, SettingsSection } from '@/features/settings/settings-section';
import { useChangePassword, useUpdateProfile } from '@/lib/api/hooks/account';
import { useMe } from '@/lib/api/hooks/session';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { setLocaleCookie } from '@/lib/locale';
import { MfaSection } from './mfa-section';
import { SessionsSection } from './sessions-section';

export function AccountPage() {
  const t = useTranslations('account');
  const tCommon = useTranslations('common.actions');
  const me = useMe();
  const errorMessage = useErrorMessage();

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <SettingsColumn>
          {me.isError ? (
            <EmptyState
              kind="error"
              headingLevel={2}
              title={t('loadFailed')}
              description={errorMessage(me.error)}
              actions={<Button onClick={() => void me.refetch()}>{tCommon('retry')}</Button>}
            />
          ) : (
            <SkeletonGroup
              loading={me.isPending}
              label={t('loading')}
              fallback={<AccountSkeleton />}
            >
              {me.data ? (
                <>
                  <ProfileSection key={me.data.user.name} user={me.data.user} />
                  <AppearanceSection />
                  <PasswordSection />
                  <MfaSection enabled={me.data.user.mfaEnabled} />
                  <SessionsSection />
                </>
              ) : null}
            </SkeletonGroup>
          )}
        </SettingsColumn>
      </div>
    </>
  );
}

function ProfileSection({ user }: { user: UserDto }) {
  const t = useTranslations('account.profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const toast = useToast();
  const update = useUpdateProfile();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [name, setName] = useState(user.name);
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ name });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    update.mutate(parsed.data, {
      onSuccess: () => toast.success({ title: t('saved') }),
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  function changeLocale(locale: Locale | null) {
    if (!locale || locale === user.locale) return;
    update.mutate(
      { locale },
      {
        onSuccess: () => {
          setLocaleCookie(locale);
          router.refresh();
        },
      },
    );
  }

  return (
    <SettingsSection id="account-profile" title={t('title')} description={t('description')}>
      <Form onSubmit={submit} aria-label={t('formLabel')}>
        <div className="flex flex-col gap-5">
          {update.error ? <Callout tone="danger">{errorMessage(update.error)}</Callout> : null}
          <Field label={t('name')} required error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            )}
          </Field>
          <Field label={t('email')} hint={t('emailHint')}>
            {(control) => <Input {...control} type="email" value={user.email} readOnly />}
          </Field>
          <div className="flex justify-end">
            <Button
              type="submit"
              loading={update.isPending && update.variables?.name !== undefined}
              disabled={name.trim() === user.name}
            >
              {tCommon('actions.save')}
            </Button>
          </div>
        </div>
      </Form>
      <Field label={t('language')} hint={t('languageHint')}>
        {(control) => (
          <Select<Locale>
            {...control}
            value={user.locale}
            disabled={update.isPending}
            onValueChange={changeLocale}
            items={LOCALES.map((value) => ({ value, label: tCommon(`language.${value}`) }))}
          />
        )}
      </Field>
    </SettingsSection>
  );
}

function AppearanceSection() {
  const t = useTranslations('account.theme');
  const [theme, setTheme] = useTheme();
  return (
    <SettingsSection id="account-theme" title={t('title')} description={t('description')}>
      <RadioGroup
        label={t('label')}
        value={theme}
        onValueChange={(value) => setTheme(value as Theme)}
      >
        <Radio value="system" label={t('system')} description={t('systemDescription')} />
        <Radio value="light" label={t('light')} />
        <Radio value="dark" label={t('dark')} />
      </RadioGroup>
    </SettingsSection>
  );
}

function PasswordSection() {
  const t = useTranslations('account.password');
  const tFields = useTranslations('errors.fields');
  const toast = useToast();
  const change = useChangePassword();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    const next = parsed.success ? {} : toFieldErrors(parsed.error);
    if (!next.confirm && confirm !== newPassword) next.confirm = tFields('passwords_differ');
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) return;
    change.mutate(parsed.data, {
      onSuccess: () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirm('');
        toast.success({ title: t('changed'), description: t('changedDescription') });
      },
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  return (
    <SettingsSection id="account-password" title={t('title')} description={t('description')}>
      <Form onSubmit={submit} aria-label={t('formLabel')}>
        <div className="flex flex-col gap-5">
          {change.error ? <Callout tone="danger">{errorMessage(change.error)}</Callout> : null}
          <Field label={t('current')} required error={errors.currentPassword}>
            {(control) => (
              <Input
                {...control}
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            )}
          </Field>
          <Field label={t('new')} required error={errors.newPassword} hint={t('newHint')}>
            {(control) => (
              <Input
                {...control}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          <Field label={t('confirm')} required error={errors.confirm}>
            {(control) => (
              <Input
                {...control}
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={change.isPending}>
              {t('submit')}
            </Button>
          </div>
        </div>
      </Form>
    </SettingsSection>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex flex-col">
      {[3, 2].map((lines, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-x-8 gap-y-4 border-b border-keyline py-8 first:pt-2 @2xl/form:grid-cols-[14rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-3">
            <Skeleton shape="text" className="h-5 w-2/3" />
            <SkeletonText lines={lines} className="text-sm" />
          </div>
          <Skeleton className="h-40" />
        </div>
      ))}
    </div>
  );
}
