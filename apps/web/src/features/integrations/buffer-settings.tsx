'use client';

import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Callout,
  DescriptionList,
  EmptyState,
  Field,
  Form,
  Input,
  Link,
  RelativeTime,
  Select,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Text,
  useToast,
} from '@demogar/mola-ui';
import { type BufferStatusDto, connectBufferSchema, hasRole } from '@conversa/shared';
import { Unplug } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import {
  useBufferChannels,
  useBufferOrganizations,
  useBufferStatus,
  useConnectBuffer,
  useDisconnectBuffer,
  useSelectBufferOrganization,
} from '@/lib/api/hooks/buffer';
import { useChannels } from '@/lib/api/hooks/channels';
import { useCurrentWorkspace } from '@/lib/api/hooks/session';
import { type FieldErrors, useErrorMessage, useFieldErrors } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';

const BUFFER_API_SETTINGS = 'https://publish.buffer.com/settings/api';
const SYNC_ERRORS = ['unauthorized', 'rate_limited', 'not_found', 'unavailable'] as const;

export function BufferSettings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('integrations');
  const tCommon = useTranslations('common');
  const workspace = useCurrentWorkspace(workspaceId);
  const status = useBufferStatus(workspaceId);
  const canEdit = workspace ? hasRole(workspace.role, 'ADMIN') : false;

  if (status.isError) {
    return (
      <EmptyState
        kind="error"
        headingLevel={2}
        title={tCommon('states.loadFailed')}
        description={tCommon('states.loadFailedDescription')}
        actions={
          <Button variant="secondary" onClick={() => status.refetch()}>
            {tCommon('actions.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <SkeletonGroup loading={status.isPending || !workspace} label={t('loading')} fallback={<BufferSkeleton />}>
      {status.data && workspace ? (
        <>
          {!canEdit ? (
            <Callout tone="info" variant="flat" headingLevel={2} title={t('buffer.readOnly.title')} className="mb-4">
              {t('buffer.readOnly.description')}
            </Callout>
          ) : null}
          <SettingsSection id="integrations-buffer" title={t('buffer.title')} description={t('buffer.description')}>
            <Text size="sm" variant="secondary">
              {t('buffer.howItWorks')}
            </Text>
            {status.data.connected ? (
              <ConnectedBuffer workspaceId={workspaceId} status={status.data} canEdit={canEdit} />
            ) : canEdit ? (
              <ConnectForm workspaceId={workspaceId} />
            ) : (
              <DescriptionList
                layout="stacked"
                items={[{ term: t('buffer.status'), detail: t('buffer.notConnected') }]}
              />
            )}
          </SettingsSection>
          {status.data.connected && status.data.organizationId ? <LinkedChannels workspaceId={workspaceId} /> : null}
        </>
      ) : null}
    </SkeletonGroup>
  );
}

function ConnectForm({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('integrations.buffer.connect');
  const toast = useToast();
  const connect = useConnectBuffer(workspaceId);
  const errorMessage = useErrorMessage();
  const toFieldErrors = useFieldErrors();
  const [apiKey, setApiKey] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = connectBufferSchema.safeParse({ apiKey });
    setErrors(parsed.success ? {} : toFieldErrors(parsed.error));
    if (!parsed.success) return;
    connect.mutate(parsed.data, {
      onSuccess: () => {
        setApiKey('');
        toast.success({ title: t('success'), description: t('successDescription') });
      },
      onError: (error) => setErrors(toFieldErrors(error)),
    });
  }

  return (
    <Form onSubmit={submit} aria-label={t('formLabel')}>
      <div className="flex flex-col gap-5">
        {connect.error ? <Callout tone="danger">{errorMessage(connect.error)}</Callout> : null}
        <Field
          label={t('apiKey')}
          required
          error={errors.apiKey}
          hint={
            <>
              {t('hint')}{' '}
              <Link href={BUFFER_API_SETTINGS} external>
                {t('hintLink')}
              </Link>{' '}
              {t('hintEnd')}
            </>
          }
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="literal"
            />
          )}
        </Field>
        <div>
          <Button type="submit" loading={connect.isPending}>
            {t('submit')}
          </Button>
        </div>
      </div>
    </Form>
  );
}

function ConnectedBuffer({
  workspaceId,
  status,
  canEdit,
}: {
  workspaceId: string;
  status: BufferStatusDto;
  canEdit: boolean;
}) {
  const t = useTranslations('integrations.buffer');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const organizations = useBufferOrganizations(workspaceId, canEdit);
  const select = useSelectBufferOrganization(workspaceId);
  const disconnect = useDisconnectBuffer(workspaceId);
  const [confirming, setConfirming] = useState(false);

  const options = (organizations.data ?? []).map((org) => ({ value: org.id, label: org.name }));
  const choosable = canEdit && (options.length > 1 || !status.organizationId);
  const syncError = SYNC_ERRORS.find((kind) => kind === status.lastError) ?? (status.lastError ? 'unavailable' : null);

  function choose(organizationId: string | null) {
    if (!organizationId || organizationId === status.organizationId) return;
    select.mutate(organizationId, {
      onSuccess: (next) =>
        toast.success({
          title: t('organizationSaved'),
          description: t('organizationSavedDescription', { name: next.organizationName ?? '' }),
        }),
    });
  }

  async function confirmDisconnect() {
    await disconnect.mutateAsync();
    setConfirming(false);
    toast.success({ title: t('disconnect.success') });
  }

  return (
    <>
      <DescriptionList
        layout="stacked"
        items={[
          {
            term: t('status'),
            detail: (
              <Badge tone="success" dot>
                {t('connected')}
              </Badge>
            ),
          },
          ...(choosable ? [] : [{ term: t('organization'), detail: status.organizationName ?? tCommon('none') }]),
          {
            term: t('lastSync'),
            detail: status.lastSyncedAt ? <RelativeTime date={status.lastSyncedAt} /> : tCommon('never'),
          },
        ]}
      />
      {syncError ? (
        <Callout tone="warn" variant="flat" title={t('lastError')}>
          {t(`errors.${syncError}`)}
        </Callout>
      ) : null}
      {choosable ? (
        <Field
          label={t('organization')}
          required
          hint={status.organizationId ? t('organizationHint') : t('organizationPending')}
          error={organizations.error ? errorMessage(organizations.error) : undefined}
        >
          {(control) => (
            <Select
              {...control}
              items={options}
              value={status.organizationId}
              placeholder={t('chooseOrganization')}
              disabled={organizations.isPending || select.isPending}
              onValueChange={choose}
            />
          )}
        </Field>
      ) : null}
      {select.error ? <Callout tone="danger">{errorMessage(select.error)}</Callout> : null}
      {canEdit ? (
        <div>
          <AlertDialog
            open={confirming}
            onOpenChange={setConfirming}
            trigger={
              <Button variant="danger" icon={<Unplug />}>
                {t('disconnect.button')}
              </Button>
            }
            title={t('disconnect.title')}
            description={t('disconnect.description')}
            confirmLabel={t('disconnect.button')}
            error={disconnect.error ? errorMessage(disconnect.error) : undefined}
            onConfirm={confirmDisconnect}
          />
        </div>
      ) : null}
    </>
  );
}

function LinkedChannels({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('integrations.channels');
  const tCommon = useTranslations('common');
  const errorMessage = useErrorMessage();
  const remote = useBufferChannels(workspaceId, true);
  const local = useChannels(workspaceId);
  const channelsHref = workspacePath(workspaceId, '/channels');

  return (
    <SettingsSection id="integrations-buffer-channels" title={t('title')} description={t('description')}>
      {remote.isPending ? (
        <SkeletonText lines={3} />
      ) : remote.isError ? (
        <Callout
          tone="danger"
          actions={
            <Button variant="secondary" size="sm" onClick={() => remote.refetch()}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {errorMessage(remote.error)}
        </Callout>
      ) : remote.data.length === 0 ? (
        <Text size="sm" variant="secondary">
          {t('empty')}
        </Text>
      ) : (
        <ul aria-label={t('listLabel')} className="m-0 flex list-none flex-col divide-y divide-keyline p-0">
          {remote.data.map((channel) => {
            const linked = local.data?.find((item) => item.id === channel.linkedChannelId);
            return (
              <li key={channel.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={channel.name} src={channel.avatar ?? undefined} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{channel.name}</span>
                {channel.linkedChannelId ? (
                  <Badge tone="success" dot>
                    {t('linkedTo', { handle: linked ? `@${linked.username}` : channel.name })}
                  </Badge>
                ) : (
                  <span className="flex flex-wrap items-center gap-3">
                    <Badge tone="warn" dot>
                      {t('notLinked')}
                    </Badge>
                    <Link variant="standalone" render={<NextLink href={channelsHref} />}>
                      {t('connectInConversa')}
                    </Link>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SettingsSection>
  );
}

function BufferSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-2">
      <Skeleton className="h-6 w-40" />
      <SkeletonText lines={3} />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
