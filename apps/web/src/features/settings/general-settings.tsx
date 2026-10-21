'use client';

import {
  AlertDialog,
  Button,
  Callout,
  DescriptionList,
  Field,
  Form,
  Input,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  useToast,
} from '@demogar/mola-ui';
import { hasRole, updateWorkspaceSchema } from '@conversa/shared';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useCurrentWorkspace, useMe } from '@/lib/api/hooks/session';
import { useDeleteWorkspace, useRemoveMember, useRenameWorkspace } from '@/lib/api/hooks/settings';
import { keys } from '@/lib/api/keys';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { SettingsSection } from './settings-section';

export function GeneralSettings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings');
  const me = useMe();
  const workspace = useCurrentWorkspace(workspaceId);
  const loading = me.isPending || !workspace;

  return (
    <SkeletonGroup loading={loading} label={t('loading')} fallback={<GeneralSkeleton />}>
      {workspace ? (
        <>
          {hasRole(workspace.role, 'ADMIN') ? (
            // Keyed by the name, so a rename saved elsewhere resets the field.
            <RenameForm key={workspace.name} workspaceId={workspaceId} name={workspace.name} />
          ) : (
            <>
              <Callout
                tone="info"
                variant="flat"
                headingLevel={2}
                title={t('general.readOnly.title')}
                className="mb-4"
              >
                {t('general.readOnly.description', { workspace: workspace.name })}
              </Callout>
              <SettingsSection
                id="settings-workspace"
                title={t('general.workspace.title')}
                description={t('general.workspace.description')}
              >
                <DescriptionList
                  layout="stacked"
                  items={[{ term: t('general.workspace.name'), detail: workspace.name }]}
                />
              </SettingsSection>
            </>
          )}
          <DangerZone
            workspaceId={workspaceId}
            workspaceName={workspace.name}
            isOwner={workspace.role === 'OWNER'}
            userId={me.data?.user.id ?? ''}
          />
        </>
      ) : null}
    </SkeletonGroup>
  );
}

function RenameForm({ workspaceId, name: savedName }: { workspaceId: string; name: string }) {
  const t = useTranslations('settings.general.workspace');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const rename = useRenameWorkspace(workspaceId);
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [name, setName] = useState(savedName);
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateWorkspaceSchema.safeParse({ name });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    rename.mutate(parsed.data.name, {
      onSuccess: (workspace) =>
        toast.success({
          title: t('saved'),
          description: t('savedDescription', { name: workspace.name }),
        }),
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  return (
    <SettingsSection id="settings-workspace" title={t('title')} description={t('description')}>
      <Form onSubmit={submit} aria-label={t('formLabel')}>
        <div className="flex flex-col gap-5">
          {rename.error ? <Callout tone="danger">{errorMessage(rename.error)}</Callout> : null}
          <Field label={t('name')} required error={errors.name} hint={t('nameHint')}>
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={rename.isPending} disabled={name.trim() === savedName}>
              {tCommon('save')}
            </Button>
          </div>
        </div>
      </Form>
    </SettingsSection>
  );
}

function DangerZone({
  workspaceId,
  workspaceName,
  isOwner,
  userId,
}: {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  userId: string;
}) {
  const t = useTranslations('settings.general.danger');
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const remove = useDeleteWorkspace(workspaceId);
  const leave = useRemoveMember(workspaceId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspace = workspaceName;

  async function confirm() {
    try {
      if (isOwner) await remove.mutateAsync();
      else await leave.mutateAsync(userId);
    } catch (failure) {
      setError(t(isOwner ? 'deleteFailed' : 'leaveFailed', { reason: errorMessage(failure) }));
      throw failure;
    }
    toast.show({ title: t(isOwner ? 'deleted' : 'left', { workspace }) });
    router.replace('/');
    await queryClient.invalidateQueries({ queryKey: keys.me });
  }

  return (
    <SettingsSection id="settings-danger" title={t('title')} description={t('description')} danger>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="m-0 text-sm font-semibold text-ink">
            {t(isOwner ? 'deleteTitle' : 'leaveTitle')}
          </p>
          <p className="mt-1 mb-0 text-sm text-ink-2">
            {t(isOwner ? 'deleteDescription' : 'leaveDescription', { workspace })}
          </p>
        </div>
        <Button
          variant="danger"
          icon={isOwner ? <Trash2 /> : <LogOut />}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          {t(isOwner ? 'deleteButton' : 'leaveButton')}
        </Button>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={t(isOwner ? 'deleteDialogTitle' : 'leaveDialogTitle', { workspace })}
        description={t(isOwner ? 'deleteDialogDescription' : 'leaveDialogDescription', {
          workspace,
        })}
        confirmLabel={t(isOwner ? 'deleteButton' : 'leaveButton')}
        confirmationText={isOwner ? workspaceName : undefined}
        error={error}
        onConfirm={confirm}
      />
    </SettingsSection>
  );
}

function GeneralSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 pt-2 pb-8 @2xl/form:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Skeleton shape="text" className="h-5 w-2/3" />
        <SkeletonText lines={2} className="text-sm" />
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
