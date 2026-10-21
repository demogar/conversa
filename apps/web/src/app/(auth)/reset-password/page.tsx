'use client';

import { Button, Callout, Field, Form, Input, LinkButton, Stack } from '@demogar/mola-ui';
import { resetPasswordSchema } from '@conversa/shared';
import { useMutation } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, Suspense, useState } from 'react';
import { AuthCard } from '@/features/auth/auth-card';
import { api } from '@/lib/api/client';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

function ResetForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const token = useSearchParams().get('token');
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const reset = useMutation({
    mutationFn: (body: unknown) => api.post('/auth/password/reset', body),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ token, password });
    const next = parsed.success ? {} : toFieldErrors(parsed.error);
    if (password !== confirm) next.confirm = tErrors('fields.passwords_differ');
    setErrors(next);
    if (parsed.success && !next.confirm) reset.mutate(parsed.data);
  }

  const toLogin = <LinkButton render={<NextLink href="/login" />}>{t('login.submit')}</LinkButton>;

  if (!token) {
    return (
      <AuthCard title={t('reset.title')}>
        <Callout tone="danger">{t('reset.missingToken')}</Callout>
      </AuthCard>
    );
  }
  if (reset.isSuccess) {
    return (
      <AuthCard title={t('reset.doneTitle')} description={t('reset.doneDescription')}>
        {toLogin}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('reset.title')} description={t('reset.description')}>
      <Form onSubmit={submit} aria-label={t('reset.title')}>
        <Stack gap="md">
          {reset.error ? <Callout tone="danger">{errorMessage(reset.error)}</Callout> : null}
          <Field
            label={t('reset.password')}
            required
            error={errors.password}
            hint={t('signup.passwordHint')}
          >
            {(control) => (
              <Input
                {...control}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            )}
          </Field>
          <Field label={t('reset.confirm')} required error={errors.confirm}>
            {(control) => (
              <Input
                {...control}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
          <Button type="submit" loading={reset.isPending}>
            {t('reset.submit')}
          </Button>
        </Stack>
      </Form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
