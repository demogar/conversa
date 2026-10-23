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
  LinkButton,
  Panel,
  RelativeTime,
  useToast,
} from '@demogar/mola-ui';
import type { ChannelDto, ChannelStatus } from '@conversa/shared';
import { FlaskConical, RefreshCw, Unplug } from 'lucide-react';
import NextLink from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useConnectChannel, useDisconnectChannel } from '@/lib/api/hooks/channels';
import { metaGuideHash } from '@/features/admin/meta-setup-guide';
import { QUIET_AFTER_MS } from '@/features/admin/meta-setup-status';
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

/**
 * Connected and subscribed for a while, yet the platform has sent nothing.
 * Usually the Meta app is still in development mode or the account does not
 * allow access to its messages; on TikTok, messaging access is not approved yet.
 */
export function isWaitingForEvents(channel: ChannelDto, now = Date.now()): boolean {
  return (
    channel.status === 'ACTIVE' &&
    channel.webhookSubscribed &&
    channel.lastEventAt === null &&
    now - Date.parse(channel.connectedAt) > QUIET_AFTER_MS
  );
}

export function ChannelCard({
  workspaceId,
  channel,
  canManage,
  sandbox,
  isInstanceAdmin = false,
}: {
  workspaceId: string;
  channel: ChannelDto;
  canManage: boolean;
  sandbox: boolean;
  /** Instance admins can open the Meta setup guide; others are told who can. */
  isInstanceAdmin?: boolean;
}) {
  const t = useTranslations('channels');
  const format = useFormatter();
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const headingId = useId();
  const connect = useConnectChannel(workspaceId);
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
          <p className="m-0 truncate text-sm text-ink-2">
            {channel.displayName
              ? t('card.platformAndName', {
                  platform: t(`platform.${channel.type}`),
                  name: channel.displayName,
                })
              : t(`platform.${channel.type}`)}
          </p>
        </div>
        <ChannelStatusBadge status={channel.status} />
      </header>

      {channel.status === 'NEEDS_REAUTH' ? (
        <Callout tone="warn" variant="flat">
          {t('card.needsReauth', { platform: t(`platform.${channel.type}`) })}
        </Callout>
      ) : channel.status === 'DISCONNECTED' ? (
        <Callout tone="neutral" variant="flat">
          {t('card.disconnectedNote')}
        </Callout>
      ) : canManage && !sandbox && isWaitingForEvents(channel) ? (
        <Callout
          tone="warn"
          headingLevel={3}
          title={t('card.noEvents.title', { platform: t(`platform.${channel.type}`) })}
          actions={
            isInstanceAdmin ? (
              <LinkButton
                size="sm"
                variant="secondary"
                render={
                  <NextLink
                    href={
                      channel.type === 'TIKTOK'
                        ? '/admin#admin-tiktok'
                        : `/admin#${metaGuideHash('publish')}`
                    }
                  />
                }
              >
                {t('card.noEvents.openGuide')}
              </LinkButton>
            ) : undefined
          }
        >
          {channel.type === 'TIKTOK'
            ? isInstanceAdmin
              ? t('card.noEvents.tiktokBody')
              : t('card.noEvents.tiktokAskAdmin')
            : isInstanceAdmin
              ? t('card.noEvents.body')
              : t('card.noEvents.askAdmin')}
        </Callout>
      ) : null}

      <DescriptionList
        layout="grid"
        items={[
          {
            term: t('card.webhook'),
            detail: channel.webhookSubscribed ? t('card.webhookOn') : t('card.webhookOff'),
          },
          {
            term: t('card.tokenExpires'),
            detail: channel.tokenExpiresAt ? date(channel.tokenExpiresAt) : t('card.tokenNever'),
          },
          { term: t('card.connectedAt'), detail: date(channel.connectedAt) },
          {
            term: t('card.lastEvent'),
            detail: channel.lastEventAt ? (
              <RelativeTime date={channel.lastEventAt} locale={locale} />
            ) : (
              t('card.lastEventNever')
            ),
          },
        ]}
      />

      {connect.error ? <Callout tone="danger">{errorMessage(connect.error)}</Callout> : null}

      {canManage ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {channel.status !== 'ACTIVE' ? (
            <Button
              icon={<RefreshCw />}
              loading={connect.isPending}
              onClick={() => connect.mutate(channel.type)}
            >
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
