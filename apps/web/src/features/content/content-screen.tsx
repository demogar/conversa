'use client';

import {
  Badge,
  type BadgeTone,
  Button,
  EmptyState,
  Link,
  LinkButton,
  PageHeader,
  Panel,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Text,
} from '@demogar/mola-ui';
import { type BufferChannelDto, type BufferPostDto, hasRole } from '@conversa/shared';
import { Zap } from 'lucide-react';
import NextLink from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  type BufferPostView,
  useBufferChannels,
  useBufferPosts,
  useBufferStatus,
} from '@/lib/api/hooks/buffer';
import { useCurrentWorkspace } from '@/lib/api/hooks/session';
import { useErrorMessage } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';
import { RelativeTime } from '@/features/time/relative-time';

const VIEWS: BufferPostView[] = ['scheduled', 'sent'];
const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: 'info',
  sending: 'accent',
  sent: 'success',
  error: 'danger',
  draft: 'neutral',
};
const KNOWN_STATUSES = ['scheduled', 'sending', 'sent', 'error', 'draft'] as const;

export function ContentScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('content');
  const [view, setView] = useState<BufferPostView>('scheduled');
  const status = useBufferStatus(workspaceId);
  const ready = Boolean(status.data?.connected && status.data.organizationId);

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as BufferPostView)}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        tabs={
          ready ? (
            <TabsList aria-label={t('tabs.label')}>
              {VIEWS.map((item) => (
                <TabsTab key={item} value={item}>
                  {t(`tabs.${item}`)}
                </TabsTab>
              ))}
            </TabsList>
          ) : undefined
        }
      />
      <div className="p-4 sm:p-6">
        {ready ? (
          VIEWS.map((item) => (
            <TabsPanel key={item} value={item}>
              {item === view ? <PostList workspaceId={workspaceId} view={item} /> : null}
            </TabsPanel>
          ))
        ) : (
          <ContentGate workspaceId={workspaceId} status={status} />
        )}
      </div>
    </Tabs>
  );
}

/** What the page shows until Buffer is connected with an organization chosen. */
function ContentGate({
  workspaceId,
  status,
}: {
  workspaceId: string;
  status: ReturnType<typeof useBufferStatus>;
}) {
  const t = useTranslations('content');
  const tCommon = useTranslations('common');
  const workspace = useCurrentWorkspace(workspaceId);
  const canEdit = workspace ? hasRole(workspace.role, 'ADMIN') : false;
  const integrationsHref = workspacePath(workspaceId, '/settings/integrations');

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
  if (status.isPending) return <PostsSkeleton label={t('loading')} />;

  const connected = status.data.connected;
  return (
    <EmptyState
      kind="empty"
      size="lg"
      headingLevel={2}
      icon={connected ? undefined : <Zap />}
      title={connected ? t('noOrganization.title') : t('notConnected.title')}
      description={
        connected
          ? t('noOrganization.description')
          : `${t('notConnected.description')}${canEdit ? '' : ` ${t('notConnected.member')}`}`
      }
      actions={
        canEdit ? (
          <LinkButton render={<NextLink href={integrationsHref} />}>
            {connected ? t('noOrganization.action') : t('notConnected.action')}
          </LinkButton>
        ) : undefined
      }
    />
  );
}

function PostList({ workspaceId, view }: { workspaceId: string; view: BufferPostView }) {
  const t = useTranslations('content');
  const tCommon = useTranslations('common');
  const errorMessage = useErrorMessage();
  const posts = useBufferPosts(workspaceId, view, true);
  const channels = useBufferChannels(workspaceId, true);

  if (posts.isError || channels.isError) {
    return (
      <EmptyState
        kind="error"
        headingLevel={2}
        title={tCommon('states.loadFailed')}
        description={errorMessage(posts.error ?? channels.error)}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void posts.refetch();
              void channels.refetch();
            }}
          >
            {tCommon('actions.retry')}
          </Button>
        }
      />
    );
  }
  if (posts.isPending || channels.isPending) return <PostsSkeleton label={t('loading')} />;

  if (posts.data.length === 0) {
    return (
      <EmptyState
        kind="empty"
        headingLevel={2}
        title={t(`empty.${view}`)}
        description={t(
          view === 'scheduled' ? 'empty.scheduledDescription' : 'empty.sentDescription',
        )}
      />
    );
  }

  const byId = new Map(channels.data.map((channel) => [channel.id, channel]));
  return (
    <ul
      aria-label={t(`listLabel.${view}`)}
      className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3"
    >
      {posts.data.map((post) => (
        <li key={post.id} className="min-w-0">
          <PostCard workspaceId={workspaceId} post={post} channel={byId.get(post.channelId)} />
        </li>
      ))}
    </ul>
  );
}

function PostCard({
  workspaceId,
  post,
  channel,
}: {
  workspaceId: string;
  post: BufferPostDto;
  channel: BufferChannelDto | undefined;
}) {
  const t = useTranslations('content');
  const format = useFormatter();
  const when = post.sentAt ?? post.dueAt;
  const known = KNOWN_STATUSES.find((value) => value === post.status);
  const channelName = channel?.name ?? t('unknownChannel');

  return (
    <Panel as="article" padding="none" className="flex h-full flex-col">
      {post.thumbnailUrl ? (
        // Thumbnails come from Buffer's CDN, whose hosts the image optimizer does not know.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.thumbnailUrl}
          alt={t('thumbnail')}
          loading="lazy"
          className="aspect-[4/3] w-full bg-cloth object-cover"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text as="span" size="sm" weight="medium" truncate className="min-w-0">
            {channelName}
          </Text>
          <Badge tone={STATUS_TONE[post.status] ?? 'neutral'} dot pulse={post.status === 'sending'}>
            {known ? t(`status.${known}`) : t('status.other', { status: post.status })}
          </Badge>
        </div>
        <p className="m-0 line-clamp-4 font-text text-sm whitespace-pre-line text-ink">
          {post.text.trim() || <span className="text-ink-muted">{t('noCaption')}</span>}
        </p>
        <Text size="sm" variant="secondary" className="mt-auto">
          {when ? (
            <>
              {t(post.sentAt ? 'sent' : 'due', {
                date: format.dateTime(new Date(when), { dateStyle: 'medium', timeStyle: 'short' }),
              })}{' '}
              (<RelativeTime date={when} />)
            </>
          ) : (
            t('noDate')
          )}
        </Text>
        <PostActions
          workspaceId={workspaceId}
          post={post}
          channel={channel}
          channelName={channelName}
        />
      </div>
    </Panel>
  );
}

function PostActions({
  workspaceId,
  post,
  channel,
  channelName,
}: {
  workspaceId: string;
  post: BufferPostDto;
  channel: BufferChannelDto | undefined;
  channelName: string;
}) {
  const t = useTranslations('content');
  const [automationId] = post.automationIds;
  const published = post.status === 'sent';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {automationId ? (
        <>
          <Badge tone="accent" dot>
            {t('automationWaiting')}
          </Badge>
          <Link
            variant="standalone"
            render={<NextLink href={workspacePath(workspaceId, `/automations/${automationId}`)} />}
          >
            {t('openAutomation')}
          </Link>
        </>
      ) : !published && channel?.linkedChannelId ? (
        <LinkButton
          variant="secondary"
          size="sm"
          icon={<Zap />}
          render={
            <NextLink
              href={workspacePath(
                workspaceId,
                `/automations/new?${new URLSearchParams({ bufferPostId: post.id, channelId: channel.linkedChannelId })}`,
              )}
            />
          }
        >
          {t('createAutomation')}
        </LinkButton>
      ) : !published ? (
        <Text size="sm" variant="secondary">
          {t('channelNotLinked', { channel: channelName })}{' '}
          <Link render={<NextLink href={workspacePath(workspaceId, '/channels')} />}>
            {t('connectChannel')}
          </Link>
        </Text>
      ) : null}
      {published && post.externalLink ? (
        <Link variant="standalone" href={post.externalLink} external>
          {t('viewOnInstagram')}
        </Link>
      ) : null}
    </div>
  );
}

function PostsSkeleton({ label }: { label: string }) {
  return (
    <SkeletonGroup
      loading
      label={label}
      fallback={
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="flex flex-col gap-3">
              <Skeleton className="aspect-[4/3] w-full" />
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      }
    />
  );
}
