'use client';

import { Button, Callout, CodeBlock, Field, Form, Input, Select, useToast } from '@demogar/mola-ui';
import { type CreatedInvitationDto, createInvitationSchema } from '@conversa/shared';
import { Send } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useCreateInvitation } from '@/lib/api/hooks/settings';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';

type InvitableRole = 'ADMIN' | 'MEMBER';

/**
 * Invites someone by email. When this installation cannot send email, the
 * accept link is shown once, so the admin can share it another way.
 */
export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings.members.invite');
  const tRoles = useTranslations('common.roles');
  const format = useFormatter();
  const toast = useToast();
  const invite = useCreateInvitation(workspaceId);
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('MEMBER');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [shared, setShared] = useState<CreatedInvitationDto | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createInvitationSchema.safeParse({ email, role });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    invite.mutate(parsed.data, {
      onSuccess: (created) => {
        setEmail('');
        if (created.emailed) {
          setShared(null);
          toast.success({
            title: t('sent'),
            description: t('sentDescription', { email: created.email }),
          });
        } else {
          setShared(created);
        }
      },
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* A live region, so the link is announced when it appears after sending. */}
      <div aria-live="polite">
        {shared ? (
          <Callout
            tone="success"
            headingLevel={3}
            title={t('linkTitle')}
            actions={
              <Button size="sm" variant="secondary" onClick={() => setShared(null)}>
                {t('dismiss')}
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              <p className="m-0">
                {t('linkDescription', {
                  email: shared.email,
                  date: format.dateTime(new Date(shared.expiresAt), { dateStyle: 'long' }),
                })}
              </p>
              <CodeBlock label={t('linkLabel')} code={shared.acceptUrl} wrap />
            </div>
          </Callout>
        ) : null}
      </div>
      <Form onSubmit={submit} aria-label={t('formLabel')}>
        <div className="flex flex-col gap-5">
          {invite.error ? <Callout tone="danger">{errorMessage(invite.error)}</Callout> : null}
          <Field label={t('email')} required error={errors.email}>
            {(control) => (
              <Input
                {...control}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
          <Field label={t('role')} required error={errors.role} hint={t('roleHint')}>
            {(control) => (
              <Select<InvitableRole>
                {...control}
                value={role}
                onValueChange={(value) => value && setRole(value)}
                items={(['MEMBER', 'ADMIN'] as const).map((value) => ({
                  value,
                  label: tRoles(value),
                }))}
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" icon={<Send />} loading={invite.isPending}>
              {t('submit')}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
}
