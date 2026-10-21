'use client';

import {
  AlertDialog,
  Avatar,
  Badge,
  type BadgeTone,
  Button,
  Callout,
  DescriptionList,
  Heading,
  Panel,
  useToast,
} from '@demogar/mola-ui';
import type { ChannelDto, ChannelStatus } from '@conversa/shared';
import { FlaskConical, RefreshCw, Unplug } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useConnectInstagram, useDisconnectChannel } from '@/lib/api/hooks/channels';
import { useErrorMessage } from '@/lib/errors';
import { SimulateEventDialog } from './simulate-event-dialog';

const STATUS_TONE: Record<ChannelStatus, BadgeTone> = {
  ACTIVE: 'success',
  NEEDS_REAUTH: 'warn',
  DISCONNECTED: 'neutral',
};

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  const t = useTranslations('channels.status');
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {t(status)}
    </Badge>
  );
}

export function ChannelCard({
  workspaceId,
  channel,
  canManage,
  sandbox,
}: {
  workspaceId: string;
  channel: ChannelDto;
  canManage: boolean;
  sandbox: boolean;
}) {
  const t = useTranslations('channels');
  const format = useFormatter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const headingId = useId();
  const connect = useConnectInstagram(workspaceId);
  const disconnect = useDisconnectChannel(workspaceId);
  const [confirming, setConfirming] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <Panel as="article" padding="md" aria-labelledby={headingId} className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <Avatar name={channel.username} src={channel.avatarUrl ?? undefined} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Heading level={2} visualLevel={4} id={headingId} className="truncate">
            @{channel.username}
          </Heading>
          {channel.displayName ? <p className="m-0 truncate text-sm text-ink-2">{channel.displayName}</p> : null}
        </div>
        <ChannelStatusBadge status={channel.status} />
      </header>

      {channel.status === 'NEEDS_REAUTH' ? (
        <Callout tone="warn" variant="flat">
          {t('card.needsReauth')}
        </Callout>
      ) : channel.status === 'DISCONNECTED' ? (
        <Callout tone="neutral" variant="flat">
          {t('card.disconnectedNote')}
        </Callout>
      ) : null}

      <DescriptionList
        layout="grid"
        items={[
          { term: t('card.webhook'), detail: channel.webhookSubscribed ? t('card.webhookOn') : t('card.webhookOff') },
          {
            term: t('card.tokenExpires'),
            detail: channel.tokenExpiresAt ? date(channel.tokenExpiresAt) : t('card.tokenNever'),
          },
          { term: t('card.connectedAt'), detail: date(channel.connectedAt) },
        ]}
      />

      {connect.error ? <Callout tone="danger">{errorMessage(connect.error)}</Callout> : null}

      {canManage ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {channel.status !== 'ACTIVE' ? (
            <Button icon={<RefreshCw />} loading={connect.isPending} onClick={() => connect.mutate()}>
              {t('reconnect')}
            </Button>
          ) : null}
          {sandbox && channel.status === 'ACTIVE' ? (
            <Button variant="secondary" icon={<FlaskConical />} onClick={() => setSimulating(true)}>
              {t('simulate')}
            </Button>
          ) : null}
          {channel.status !== 'DISCONNECTED' ? (
            <Button variant="ghost" icon={<Unplug />} onClick={() => setConfirming(true)}>
              {t('disconnect')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) disconnect.reset();
        }}
        title={t('disconnectDialog.title', { username: channel.username })}
        description={t('disconnectDialog.description')}
        confirmLabel={t('disconnectDialog.confirm')}
        tone="danger"
        error={disconnect.error ? errorMessage(disconnect.error) : undefined}
        onConfirm={async () => {
          await disconnect.mutateAsync(channel.id);
          toast.success({ title: t('disconnectDialog.done', { username: channel.username }) });
        }}
      />

      {sandbox ? (
        <SimulateEventDialog
          workspaceId={workspaceId}
          channel={channel}
          open={simulating}
          onOpenChange={setSimulating}
        />
      ) : null}
    </Panel>
  );
}
