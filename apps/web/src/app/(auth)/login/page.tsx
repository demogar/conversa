'use client';

import { Button, Callout, Field, Form, Input, Link, Stack } from '@demogar/mola-ui';
import { type LoginResultDto, loginSchema, mfaVerifySchema } from '@conversa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, Suspense, useState } from 'react';
import { AuthCard } from '@/features/auth/auth-card';
import { Turnstile } from '@/features/auth/turnstile';
import { api } from '@/lib/api/client';
import { useInstance } from '@/lib/api/hooks/session';
import { keys } from '@/lib/api/keys';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { safeNextPath } from '@/lib/navigation';

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const instance = useInstance().data;
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const next = safeNextPath(params.get('next'));

  async function finish() {
    await queryClient.invalidateQueries({ queryKey: keys.me });
    router.replace(next);
  }

  const login = useMutation({
    mutationFn: (body: unknown) => api.post<LoginResultDto>('/auth/login', body),
    onSuccess: async (result) => {
      if (result.status === 'mfa_required') setChallenge(result.challenge);
      else await finish();
    },
  });

  const verify = useMutation({
    mutationFn: (body: unknown) => api.post<LoginResultDto>('/auth/mfa', body),
    onSuccess: finish,
  });

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ email, password, captchaToken: captchaToken ?? undefined });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (parsed.success) login.mutate(parsed.data);
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = mfaVerifySchema.safeParse({ challenge, code });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (parsed.success) verify.mutate(parsed.data);
  }

  if (challenge) {
    return (
      <AuthCard title={t('mfa.title')} description={t('mfa.description')}>
        <Form onSubmit={submitCode} aria-label={t('mfa.title')}>
          <Stack gap="md">
            {verify.error ? <Callout tone="danger">{errorMessage(verify.error)}</Callout> : null}
            <Field label={t('mfa.code')} required error={errors.code}>
              {(control) => (
                <Input
                  {...control}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="text"
                  autoFocus
                  className="literal"
                />
              )}
            </Field>
            <Button type="submit" loading={verify.isPending}>
              {t('mfa.submit')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChallenge(null);
                setCode('');
                verify.reset();
              }}
            >
              {t('mfa.back')}
            </Button>
          </Stack>
        </Form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('login.title')}
      description={t('login.description')}
      footer={
        instance?.signupOpen ? (
          <>
            {t('login.noAccount')}{' '}
            <Link render={<NextLink href="/signup" />}>{t('login.signup')}</Link>
          </>
        ) : null
      }
    >
      <Form onSubmit={submitPassword} aria-label={t('login.title')}>
        <Stack gap="md">
          {login.error ? <Callout tone="danger">{errorMessage(login.error)}</Callout> : null}
          <Field label={t('login.email')} required error={errors.email}>
            {(control) => (
              <Input
                {...control}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                autoFocus
              />
            )}
          </Field>
          <Field
            label={t('login.password')}
            required
            error={errors.password}
            labelAside={
              <Link variant="standalone" render={<NextLink href="/forgot-password" />}>
                {t('login.forgot')}
              </Link>
            }
          >
            {(control) => (
              <Input
                {...control}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            )}
          </Field>
          <Turnstile siteKey={instance?.captchaSiteKey} onToken={setCaptchaToken} label={t('captcha')} />
          <Button type="submit" loading={login.isPending}>
            {t('login.submit')}
          </Button>
        </Stack>
      </Form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
