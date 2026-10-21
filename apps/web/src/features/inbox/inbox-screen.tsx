'use client';

import {
  Avatar,
  Button,
  cn,
  EmptyState,
  Heading,
  LinkButton,
  PageHeader,
  RelativeTime,
  Select,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
} from '@demogar/mola-ui';
import type { ChannelDto } from '@conversa/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, RotateCcw } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ApiError } from '@/lib/api/client';
import { useChannels } from '@/lib/api/hooks/channels';
import { useConversations } from '@/lib/api/hooks/inbox';
import { keys } from '@/lib/api/keys';
import { workspacePath } from '@/lib/navigation';
import { contactName, ConversationThread } from './conversation-thread';

function pickDefault(channels: ChannelDto[]): string | null {
  return (channels.find((channel) => channel.status === 'ACTIVE') ?? channels[0])?.id ?? null;
}

export function InboxScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common.actions');
  const queryClient = useQueryClient();
  const channels = useChannels(workspaceId);
  const [chosenChannel, setChosenChannel] = useState<string | null>(null);

  const list = channels.data ?? [];
  const channelId = list.some((channel) => channel.id === chosenChannel) ? chosenChannel : pickDefault(list);
  const channel = list.find((item) => item.id === channelId) ?? null;
  const conversations = useConversations(workspaceId, channel?.status === 'ACTIVE' ? channel.id : null);

  const refreshing = conversations.isFetching && !conversations.isPending;
  const header = (
    <PageHeader
      title={t('title')}
      description={t('description')}
      actions={
        channel?.status === 'ACTIVE' ? (
          <Button
            variant="secondary"
            icon={<RefreshCw />}
            loading={refreshing}
            // The open thread's key sits under the list's, so both reload.
            onClick={() => queryClient.invalidateQueries({ queryKey: keys.conversations(workspaceId, channel.id) })}
          >
            {t('refresh')}
          </Button>
        ) : undefined
      }
    />
  );

  const channelsLink = (label: string) => (
    <LinkButton variant="secondary" render={<NextLink href={workspacePath(workspaceId, '/channels')} />}>
      {label}
    </LinkButton>
  );

  let body: ReactNode;
  if (channels.isPending) {
    body = (
      <SkeletonGroup loading label={t('states.loading')} fallback={<Skeleton className="h-64" />} className="p-4 sm:p-6" />
    );
  } else if (channels.isError) {
    body = (
      <div className="p-4 sm:p-6">
        <EmptyState
          kind="error"
          headingLevel={2}
          title={t('states.channelsFailed')}
          description={t('states.loadFailedDescription')}
          actions={
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => channels.refetch()}>
              {tCommon('retry')}
            </Button>
          }
        />
      </div>
    );
  } else if (!channel) {
    body = (
      <div className="p-4 sm:p-6">
        <EmptyState
          headingLevel={2}
          title={t('noChannels.title')}
          description={t('noChannels.description')}
          actions={channelsLink(t('noChannels.action'))}
        />
      </div>
    );
  } else if (channel.status !== 'ACTIVE' || (conversations.error instanceof ApiError && conversations.error.code === 'CHANNEL_NEEDS_REAUTH')) {
    body = (
      <div className="p-4 sm:p-6">
        <EmptyState
          kind="error"
          headingLevel={2}
          title={t('reauth.title', { username: channel.username })}
          description={t('reauth.description')}
          actions={channelsLink(t('reauth.action'))}
        />
      </div>
    );
  } else {
    body = <Conversations key={channel.id} workspaceId={workspaceId} channel={channel} query={conversations} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {list.length > 1 ? (
        <div className="border-b border-keyline px-4 py-4 sm:px-6">
          <Select
            label={t('channel')}
            items={list.map((item) => ({ value: item.id, label: `@${item.username}` }))}
            value={channelId}
            onValueChange={(value) => setChosenChannel(value)}
            wrapperClassName="max-w-xs"
          />
        </div>
      ) : null}
      {body}
    </div>
  );
}

/** The list and detail of one account's conversations, after the pattern: one pane at a time when narrow. */
function Conversations({
  workspaceId,
  channel,
  query,
}: {
  workspaceId: string;
  channel: ChannelDto;
  query: ReturnType<typeof useConversations>;
}) {
  const t = useTranslations('inbox');
  const tCommon = useTranslations('common.actions');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const listHeadingId = `${uid}-list`;
  const detailId = `${uid}-detail`;

  if (query.isPending) {
    return (
      <SkeletonGroup
        loading
        label={t('states.loading')}
        className="p-4 sm:p-6"
        fallback={
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonText key={i} lines={2} />
            ))}
          </div>
        }
      />
    );
  }

  if (query.isError) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          kind="error"
          headingLevel={2}
          title={t('states.loadFailed')}
          description={t('states.loadFailedDescription')}
          actions={
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => query.refetch()}>
              {tCommon('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const conversations = query.data;
  if (conversations.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          headingLevel={2}
          title={t('empty.title')}
          description={t('empty.description', { username: channel.username })}
        />
      </div>
    );
  }

  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0]!;

  // The Back button is displayed only in the one-column layout, so it tells whether the list is about to be hidden.
  const isSingleColumn = () => !!backRef.current && getComputedStyle(backRef.current).display !== 'none';

  const open = (id: string) => {
    const single = isSingleColumn();
    flushSync(() => {
      setSelectedId(id);
      setView('detail');
    });
    if (single) headingRef.current?.focus();
  };

  const back = () => {
    flushSync(() => setView('list'));
    itemRefs.current.get(selected.id)?.focus();
  };

  const selectedName = contactName(selected, t('unknownContact'));

  return (
    <div className="@container/inbox flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 @3xl/inbox:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
        <section
          aria-labelledby={listHeadingId}
          className={cn(
            'min-h-0 overflow-y-auto scroll-cloth bg-cloth-pale @3xl/inbox:rule-e',
            view === 'detail' && '@max-3xl/inbox:hidden',
          )}
        >
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
            <h2 id={listHeadingId} className="m-0 rotulo text-ink-muted">
              {t('conversations')}
            </h2>
            <p dir="auto" className="m-0 text-xs text-ink-muted">
              {t('conversationCount', { count: conversations.length })}
            </p>
          </div>
          <ul className="m-0 list-none p-0">
            {conversations.map((conversation) => {
              const current = conversation.id === selected.id;
              const name = contactName(conversation, t('unknownContact'));
              return (
                <li key={conversation.id} className="border-b border-keyline last:border-b-0">
                  {/* A row with two lines and an avatar, marked aria-current, as in Mola's list-and-detail pattern. */}
                  {/* eslint-disable-next-line mola-ui/design-advice -- Button cannot hold a two-line row. */}
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) itemRefs.current.set(conversation.id, node);
                      else itemRefs.current.delete(conversation.id);
                    }}
                    aria-current={current ? 'true' : undefined}
                    aria-controls={detailId}
                    onClick={() => open(conversation.id)}
                    className={cn(
                      'group/conversation flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-start sm:px-5',
                      'bg-transparent text-ink transition-colors',
                      'hover:bg-ink-soft focus-visible:focus-ring-inset focus-visible:outline-none',
                      'aria-[current=true]:bg-ink-soft aria-[current=true]:forced-selected aria-[current=true]:bar-start-ink',
                    )}
                  >
                    <Avatar name={conversation.participant.username ?? name} size="sm" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium group-aria-[current=true]/conversation:font-semibold">
                          {name}
                        </span>{' '}
                        {conversation.updatedAt ? (
                          <span dir="auto" className="shrink-0 text-xs text-ink-muted">
                            <RelativeTime date={conversation.updatedAt} format="short" />
                          </span>
                        ) : null}
                      </span>{' '}
                      {conversation.lastMessage ? (
                        <span className="line-clamp-2 text-xs text-ink-2">{conversation.lastMessage}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div
          id={detailId}
          className={cn('flex min-h-0 min-w-0 flex-col', view === 'list' && '@max-3xl/inbox:hidden')}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            <Button
              ref={backRef}
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="flip-rtl" />}
              onClick={back}
              className="-ms-2 self-start @3xl/inbox:hidden"
            >
              {t('backToConversations')}
            </Button>
            <Heading level={2} visualLevel={3} ref={headingRef} tabIndex={-1} className="outline-none">
              {selectedName}
            </Heading>
            <ConversationThread workspaceId={workspaceId} channelId={channel.id} conversation={selected} />
          </div>
        </div>
      </div>
    </div>
  );
}
