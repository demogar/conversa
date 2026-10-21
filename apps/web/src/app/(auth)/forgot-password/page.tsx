'use client';

import { Button, Callout, Field, Form, Input, LinkButton, Stack } from '@demogar/mola-ui';
import { forgotPasswordSchema } from '@conversa/shared';
import { useMutation } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { AuthCard } from '@/features/auth/auth-card';
import { Turnstile } from '@/features/auth/turnstile';
import { api } from '@/lib/api/client';
import { useInstance } from '@/lib/api/hooks/session';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const instance = useInstance().data;
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const request = useMutation({ mutationFn: (body: unknown) => api.post('/auth/password/forgot', body) });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email, captchaToken: captchaToken ?? undefined });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (parsed.success) request.mutate(parsed.data);
  }

  const back = (
    <LinkButton variant="secondary" render={<NextLink href="/login" />}>
      {t('forgot.backToLogin')}
    </LinkButton>
  );

  if (request.isSuccess) {
    return (
      <AuthCard title={t('forgot.sentTitle')} description={t('forgot.sentDescription', { email })}>
        {back}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('forgot.title')} description={t('forgot.description')}>
      <Form onSubmit={submit} aria-label={t('forgot.title')}>
        <Stack gap="md">
          {request.error ? <Callout tone="danger">{errorMessage(request.error)}</Callout> : null}
          <Field label={t('forgot.email')} required error={errors.email}>
            {(control) => (
              <Input {...control} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            )}
          </Field>
          <Turnstile siteKey={instance?.captchaSiteKey} onToken={setCaptchaToken} label={t('captcha')} />
          <Button type="submit" loading={request.isPending}>
            {t('forgot.submit')}
          </Button>
          {back}
        </Stack>
      </Form>
    </AuthCard>
  );
}
