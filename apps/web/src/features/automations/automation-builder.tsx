'use client';

import type { AutomationDto, ChannelDto, CreateAutomationInput, UpdateAutomationInput } from '@conversa/shared';
import {
  AlertDialog,
  Breadcrumb,
  Button,
  EmptyState,
  LinkButton,
  PageHeader,
  Skeleton,
  SkeletonGroup,
  useToast,
} from '@demogar/mola-ui';
import { Pause, Play, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  useAutomation,
  useChannelsForPicker,
  useCreateAutomation,
  useDeleteAutomation,
  useSetAutomationStatus,
  useUpdateAutomation,
} from '@/lib/api/hooks/automations';
import { useErrorMessage } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';
import { AutomationForm, type SaveIntent } from './automation-form';
import { AutomationStatusBadge } from './automation-status-badge';
import { type DraftDefaults, draftFromAutomation, emptyDraft } from './draft';

function BuilderSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-48 w-full" />
      ))}
    </div>
  );
}

function useBreadcrumb(workspaceId: string, current: string) {
  const t = useTranslations('automations.builder');
  return (
    <Breadcrumb
      aria-label={t('breadcrumb')}
      items={[{ label: t('back'), href: workspacePath(workspaceId, '/automations') }, { label: current }]}
      renderLink={(props) => <NextLink {...props} />}
    />
  );
}

function LoadError({ workspaceId, error, onRetry }: { workspaceId: string; error: unknown; onRetry: () => void }) {
  const t = useTranslations('automations.builder');
  const tCommon = useTranslations('common.actions');
  const errorMessage = useErrorMessage();
  const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
  return (
    <EmptyState
      kind={notFound ? 'empty' : 'error'}
      headingLevel={2}
      title={notFound ? t('notFound') : t('loadFailed')}
      description={notFound ? t('notFoundDescription') : errorMessage(error)}
      actions={
        notFound ? (
          <LinkButton render={<NextLink href={workspacePath(workspaceId, '/automations')} />}>{t('backToList')}</LinkButton>
        ) : (
          <Button variant="secondary" onClick={onRetry}>
            {tCommon('retry')}
          </Button>
        )
      }
    />
  );
}

function NoChannel({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('automations.builder.noChannel');
  return (
    <EmptyState
      size="lg"
      headingLevel={2}
      title={t('title')}
      description={t('description')}
      actions={
        <LinkButton render={<NextLink href={workspacePath(workspaceId, '/channels')} />} withArrow>
          {t('action')}
        </LinkButton>
      }
    />
  );
}

/** A new automation, optionally pre-filled for a scheduled Buffer post. */
export function NewAutomationScreen({ workspaceId, defaults }: { workspaceId: string; defaults?: DraftDefaults }) {
  const t = useTranslations('automations.builder');
  const tCommon = useTranslations('common.actions');
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const channels = useChannelsForPicker(workspaceId);
  const create = useCreateAutomation(workspaceId);
  const breadcrumb = useBreadcrumb(workspaceId, t('newTitle'));

  async function save(input: CreateAutomationInput | UpdateAutomationInput, intent: SaveIntent) {
    await create.mutateAsync(input as CreateAutomationInput);
    toast.success({
      title: intent === 'ACTIVE' ? t('createdActive') : t('created'),
      description: intent === 'ACTIVE' ? t('createdDescription') : t('createdDraftDescription'),
    });
    router.push(workspacePath(workspaceId, '/automations'));
  }

  function body() {
    if (channels.isError) {
      return (
        <EmptyState
          kind="error"
          headingLevel={2}
          title={t('loadFailed')}
          description={errorMessage(channels.error)}
          actions={
            <Button variant="secondary" onClick={() => channels.refetch()}>
              {tCommon('retry')}
            </Button>
          }
        />
      );
    }
    if (channels.isPending) {
      return <SkeletonGroup loading label={t('loading')} fallback={<BuilderSkeleton />} />;
    }
    const usable = channels.data.filter((channel) => channel.status !== 'DISCONNECTED');
    if (usable.length === 0) return <NoChannel workspaceId={workspaceId} />;
    return (
      <AutomationForm
        workspaceId={workspaceId}
        channels={channels.data}
        initial={emptyDraft({ ...defaults, channelId: pickChannel(usable, defaults?.channelId) })}
        saving={create.isPending}
        saveError={create.error}
        onSave={save}
      />
    );
  }

  return (
    <>
      <PageHeader breadcrumb={breadcrumb} title={t('newTitle')} description={t('newDescription')} />
      <div className="p-4 sm:p-6">{body()}</div>
    </>
  );
}

/** The given account when it exists, or the only one there is. */
function pickChannel(channels: ChannelDto[], preferred: string | null | undefined): string | null {
  if (preferred && channels.some((channel) => channel.id === preferred)) return preferred;
  return channels.length === 1 ? (channels[0]?.id ?? null) : null;
}

export function EditAutomationScreen({ workspaceId, automationId }: { workspaceId: string; automationId: string }) {
  const t = useTranslations('automations.builder');
  const tList = useTranslations('automations.list');
  const tDelete = useTranslations('automations.delete');
  const tCommon = useTranslations('common.actions');
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const automation = useAutomation(workspaceId, automationId);
  const channels = useChannelsForPicker(workspaceId);
  const save = useUpdateAutomation(workspaceId, automationId);
  const setStatus = useSetAutomationStatus(workspaceId);
  const remove = useDeleteAutomation(workspaceId);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const breadcrumb = useBreadcrumb(workspaceId, automation.data?.name ?? t('formLabel'));

  async function onSave(input: CreateAutomationInput | UpdateAutomationInput) {
    await save.mutateAsync(input as UpdateAutomationInput);
    toast.success({ title: t('saved') });
  }

  function toggle(current: AutomationDto) {
    const status = current.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setStatus.mutate(
      { id: current.id, status },
      {
        onSuccess: () => toast.success({ title: status === 'ACTIVE' ? tList('activated') : tList('paused') }),
        onError: (error) => toast.danger({ title: tList('actionFailed'), description: errorMessage(error) }),
      },
    );
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(automationId);
    } catch (error) {
      setDeleteError(tDelete('failed', { reason: errorMessage(error) }));
      throw error;
    }
    toast.success({ title: tList('deleted') });
    router.push(workspacePath(workspaceId, '/automations'));
  }

  const loaded = automation.data && channels.data ? { automation: automation.data, channels: channels.data } : null;
  const loadError = automation.error ?? channels.error;

  return (
    <>
      <PageHeader
        breadcrumb={breadcrumb}
        title={automation.data?.name ?? t('formLabel')}
        description={t('editDescription')}
        meta={automation.data ? [<AutomationStatusBadge key="status" status={automation.data.status} />] : undefined}
        actions={
          automation.data ? (
            <>
              <Button
                variant="secondary"
                icon={automation.data.status === 'ACTIVE' ? <Pause /> : <Play />}
                loading={setStatus.isPending}
                onClick={() => toggle(automation.data)}
              >
                {automation.data.status === 'ACTIVE' ? t('pause') : t('activate')}
              </Button>
              <AlertDialog
                trigger={
                  <Button variant="ghost" icon={<Trash2 />} onClick={() => setDeleteError(null)}>
                    {t('delete')}
                  </Button>
                }
                title={tDelete('title', { name: automation.data.name })}
                description={tDelete('description')}
                confirmLabel={tDelete('confirm')}
                cancelLabel={tCommon('cancel')}
                error={deleteError}
                onConfirm={confirmDelete}
              />
            </>
          ) : null
        }
      />
      <div className="p-4 sm:p-6">
        {loadError ? (
          <LoadError
            workspaceId={workspaceId}
            error={loadError}
            onRetry={() => {
              void automation.refetch();
              void channels.refetch();
            }}
          />
        ) : loaded ? (
          <AutomationForm
            key={loaded.automation.id}
            workspaceId={workspaceId}
            channels={loaded.channels}
            initial={draftFromAutomation(loaded.automation)}
            automation={loaded.automation}
            saving={save.isPending}
            saveError={save.error}
            onSave={onSave}
          />
        ) : (
          <SkeletonGroup loading label={t('loading')} fallback={<BuilderSkeleton />} />
        )}
      </div>
    </>
  );
}
