'use client';

import {
  Button,
  Callout,
  Dialog,
  DialogContent,
  Field,
  Form,
  Input,
  Stack,
} from '@demogar/mola-ui';
import { createWorkspaceSchema } from '@conversa/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useCreateWorkspace } from '@/lib/api/hooks/session';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.createWorkspace');
  const tCommon = useTranslations('common.actions');
  const router = useRouter();
  const create = useCreateWorkspace();
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createWorkspaceSchema.safeParse({ name });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    create.mutate(parsed.data.name, {
      onSuccess: (workspace) => {
        onOpenChange(false);
        setName('');
        router.push(workspacePath(workspace.id));
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('title')}
        description={t('description')}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" form="create-workspace" loading={create.isPending}>
              {t('submit')}
            </Button>
          </>
        }
      >
        <Form id="create-workspace" onSubmit={submit} aria-label={t('title')}>
          <Stack gap="md">
            {create.error ? <Callout tone="danger">{errorMessage(create.error)}</Callout> : null}
            <Field label={t('name')} required error={errors.name}>
              {(control) => (
                <Input
                  {...control}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              )}
            </Field>
          </Stack>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
