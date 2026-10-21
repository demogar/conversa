'use client';

import type { AutomationDto, ChannelDto } from '@conversa/shared';
import {
  AlertDialog,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  Link,
  LinkButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  PageHeader,
  Text,
  useToast,
} from '@demogar/mola-ui';
import { Copy, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  useAutomations,
  useChannelsForPicker,
  useDeleteAutomation,
  useDuplicateAutomation,
  useSetAutomationStatus,
} from '@/lib/api/hooks/automations';
import { useErrorMessage } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';
import { AutomationStatusBadge } from './automation-status-badge';

function useTriggerSummary() {
  const t = useTranslations('automations.list.trigger');
  return (automation: AutomationDto) => {
    const count = automation.keywords.length;
    const keywords = automation.matchMode === 'KEYWORDS';
    if (automation.triggerType === 'COMMENT') {
      return keywords ? t('commentKeywords', { count }) : t('commentAnything');
    }
    return keywords ? t('messageKeywords', { count }) : t('messageAnything');
  };
}

export function AutomationsScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('automations.list');
  const tCommon = useTranslations('common');
  const tDelete = useTranslations('automations.delete');
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const triggerSummary = useTriggerSummary();

  const automations = useAutomations(workspaceId);
  const channels = useChannelsForPicker(workspaceId);
  const setStatus = useSetAutomationStatus(workspaceId);
  const duplicate = useDuplicateAutomation(workspaceId);
  const remove = useDeleteAutomation(workspaceId);

  const [deleting, setDeleting] = useState<AutomationDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const channelsById = useMemo(
    () => new Map<string, ChannelDto>((channels.data ?? []).map((channel) => [channel.id, channel])),
    [channels.data],
  );

  const newPath = workspacePath(workspaceId, '/automations/new');
  const editPath = (id: string) => workspacePath(workspaceId, `/automations/${id}`);
  const number = (value: number) => format.number(value);

  function failed(error: unknown) {
    toast.danger({ title: t('actionFailed'), description: errorMessage(error) });
  }

  function toggle(automation: AutomationDto) {
    const status = automation.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setStatus.mutate(
      { id: automation.id, status },
      {
        onSuccess: () => toast.success({ title: status === 'ACTIVE' ? t('activated') : t('paused') }),
        onError: failed,
      },
    );
  }

  function copy(automation: AutomationDto) {
    duplicate.mutate(automation.id, {
      onSuccess: (created) =>
        toast.success({
          title: t('duplicated'),
          description: t('duplicatedDescription'),
          action: { label: t('edit'), onClick: () => router.push(editPath(created.id)) },
        }),
      onError: failed,
    });
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success({ title: t('deleted') });
    } catch (error) {
      setDeleteError(tDelete('failed', { reason: errorMessage(error) }));
      // Rethrown so the dialog stays open where the person acted.
      throw error;
    }
  }

  const columns: DataTableColumn<AutomationDto>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      hideable: false,
      sortable: true,
      sortValue: (row) => row.name.toLocaleLowerCase(),
      cell: (row) => (
        <Link variant="standalone" render={<NextLink href={editPath(row.id)} />}>
          {row.name}
        </Link>
      ),
    },
    { key: 'trigger', header: t('columns.trigger'), cell: (row) => triggerSummary(row) },
    {
      key: 'channel',
      header: t('columns.channel'),
      cell: (row) => {
        const channel = channelsById.get(row.channelId);
        if (channels.isPending) return '—';
        return channel ? (
          <span className="literal">@{channel.username}</span>
        ) : (
          <Text as="span" variant="muted">
            {t('unknownChannel')}
          </Text>
        );
      },
    },
    {
      key: 'status',
      header: t('columns.status'),
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => <AutomationStatusBadge status={row.status} />,
    },
    {
      key: 'triggered',
      header: t('columns.triggered'),
      align: 'end',
      sortable: true,
      sortValue: (row) => row.stats.triggered,
      cell: (row) => number(row.stats.triggered),
    },
    {
      key: 'sent',
      header: t('columns.sent'),
      align: 'end',
      sortable: true,
      sortValue: (row) => row.stats.sent,
      cell: (row) => number(row.stats.sent),
    },
    {
      key: 'clicks',
      header: t('columns.clicks'),
      align: 'end',
      sortable: true,
      sortValue: (row) => row.stats.clicks,
      cell: (row) => number(row.stats.clicks),
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('columns.actions')}</span>,
      label: t('columns.actions'),
      hideable: false,
      width: '4rem',
      cell: (row) => (
        <Menu>
          <MenuTrigger
            render={
              <IconButton label={t('rowActions', { name: row.name })} variant="ghost" size="sm">
                <MoreHorizontal />
              </IconButton>
            }
          />
          <MenuContent align="end">
            <MenuItem icon={<Pencil />} onClick={() => router.push(editPath(row.id))}>
              {t('edit')}
            </MenuItem>
            <MenuItem icon={<Copy />} onClick={() => copy(row)}>
              {t('duplicate')}
            </MenuItem>
            <MenuItem icon={row.status === 'ACTIVE' ? <Pause /> : <Play />} onClick={() => toggle(row)}>
              {row.status === 'ACTIVE' ? t('pause') : t('activate')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 />}
              tone="danger"
              onClick={() => {
                setDeleteError(null);
                setDeleting(row);
              }}
            >
              {t('delete')}
            </MenuItem>
          </MenuContent>
        </Menu>
      ),
    },
  ];

  const createButton = (
    <LinkButton icon={<Plus />} render={<NextLink href={newPath} />}>
      {t('create')}
    </LinkButton>
  );

  const noChannel = channels.isSuccess && channels.data.length === 0;

  function body() {
    if (automations.isError) {
      return (
        <EmptyState
          kind="error"
          headingLevel={2}
          title={t('error')}
          description={errorMessage(automations.error)}
          actions={
            <Button variant="secondary" onClick={() => automations.refetch()}>
              {tCommon('actions.retry')}
            </Button>
          }
        />
      );
    }
    if (automations.isSuccess && automations.data.length === 0) {
      if (noChannel) {
        return (
          <EmptyState
            size="lg"
            headingLevel={2}
            title={t('empty.noChannelTitle')}
            description={t('empty.noChannelDescription')}
            actions={
              <LinkButton render={<NextLink href={workspacePath(workspaceId, '/channels')} />} withArrow>
                {t('empty.goToChannels')}
              </LinkButton>
            }
          />
        );
      }
      return (
        <EmptyState
          size="lg"
          headingLevel={2}
          title={t('empty.title')}
          description={t('empty.description')}
          actions={createButton}
        />
      );
    }
    return (
      <DataTable
        label={t('tableLabel')}
        columns={columns}
        rows={automations.data ?? []}
        getRowId={(row) => row.id}
        loading={automations.isPending}
        noun={{ one: t('noun.one'), other: t('noun.other') }}
        stackWhenNarrow
        pageSize={25}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={automations.data?.length || !noChannel ? createButton : null}
      />
      <div className="p-4 sm:p-6">{body()}</div>
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={tDelete('title', { name: deleting?.name ?? '' })}
        description={tDelete('description')}
        confirmLabel={tDelete('confirm')}
        cancelLabel={tCommon('actions.cancel')}
        error={deleteError}
        onConfirm={confirmDelete}
      />
    </>
  );
}
