'use client';

import { Button, Callout, EmptyState, Field, Form, Input, Link, LinkButton, Stack } from '@demogar/mola-ui';
import { type Locale, signupSchema } from '@conversa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, Suspense, useState } from 'react';
import { AuthCard } from '@/features/auth/auth-card';
import { Turnstile } from '@/features/auth/turnstile';
import { api } from '@/lib/api/client';
import { useInvitationPreview } from '@/lib/api/hooks/invitations';
import { useInstance } from '@/lib/api/hooks/session';
import { keys } from '@/lib/api/keys';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

function SignupForm() {
  const t = useTranslations('auth');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const invitationToken = params.get('invite');
  const instance = useInstance();
  const invitation = useInvitationPreview(invitationToken);
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  // An invitation fixes the address: the account must match the invited email.
  const effectiveEmail = invitation.data?.email ?? email;

  const signup = useMutation({
    mutationFn: (body: unknown) => api.post('/auth/signup', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.me });
      router.replace('/');
    },
    onError: (error) => setErrors(toFieldErrors(error)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = signupSchema.safeParse({
      name,
      email: effectiveEmail,
      password,
      locale,
      invitationToken: invitationToken ?? undefined,
      captchaToken: captchaToken ?? undefined,
    });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (parsed.success) signup.mutate(parsed.data);
  }

  const open = instance.data?.signupOpen || Boolean(invitation.data);
  if (instance.data && !open && !invitation.isLoading) {
    return (
      <AuthCard title={t('signup.closedTitle')}>
        <EmptyState
          kind="no-permission"
          size="sm"
          headingLevel={2}
          title={t('signup.closedTitle')}
          description={t('signup.closedDescription')}
          actions={<LinkButton render={<NextLink href="/login" />}>{t('signup.signIn')}</LinkButton>}
        />
      </AuthCard>
    );
  }

  const description = instance.data?.needsSetup
    ? t('signup.setupDescription')
    : invitation.data
      ? t('signup.invitedDescription', { workspace: invitation.data.workspaceName, email: invitation.data.email })
      : t('signup.description');

  return (
    <AuthCard
      title={instance.data?.needsSetup ? t('signup.setupTitle') : t('signup.title')}
      description={description}
      footer={
        <>
          {t('signup.haveAccount')}{' '}
          <Link render={<NextLink href={invitationToken ? `/invite/${invitationToken}` : '/login'} />}>
            {t('signup.signIn')}
          </Link>
        </>
      }
    >
      <Form onSubmit={submit} aria-label={t('signup.title')}>
        <Stack gap="md">
          {signup.error && !Object.keys(errors).length ? (
            <Callout tone="danger">{errorMessage(signup.error)}</Callout>
          ) : null}
          <Field label={t('signup.name')} required error={errors.name}>
            {(control) => (
              <Input {...control} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            )}
          </Field>
          <Field label={t('signup.email')} required error={errors.email}>
            {(control) => (
              <Input
                {...control}
                type="email"
                value={effectiveEmail}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                readOnly={Boolean(invitation.data)}
              />
            )}
          </Field>
          <Field label={t('signup.password')} required error={errors.password} hint={t('signup.passwordHint')}>
            {(control) => (
              <Input
                {...control}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          <Turnstile siteKey={instance.data?.captchaSiteKey} onToken={setCaptchaToken} label={t('captcha')} />
          <Button type="submit" loading={signup.isPending}>
            {t('signup.submit')}
          </Button>
        </Stack>
      </Form>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
