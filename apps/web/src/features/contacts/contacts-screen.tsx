'use client';

import {
  Button,
  Code,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  RelativeTime,
  SearchInput,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from '@demogar/mola-ui';
import { hasRole, type ContactDto } from '@conversa/shared';
import { AtSign, RotateCcw } from 'lucide-react';
import NextLink from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { type ContactFilters, useChannelLabels, useContacts } from '@/lib/api/hooks/contacts';
import { useCurrentWorkspace } from '@/lib/api/hooks/session';
import { workspacePath } from '@/lib/navigation';

const ALL = 'all';
const SEARCH_DELAY_MS = 300;

/** The value, once it has stopped changing for `delay` milliseconds. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function ContactsScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('contacts');
  const tCommon = useTranslations('common');
  const workspace = useCurrentWorkspace(workspaceId);
  const canConnect = workspace ? hasRole(workspace.role, 'ADMIN') : false;
  const [search, setSearch] = useState('');
  const [channelId, setChannelId] = useState<string>(ALL);
  const settledSearch = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);

  const filters = useMemo<ContactFilters>(
    () => ({
      search: settledSearch || undefined,
      channelId: channelId === ALL ? undefined : channelId,
    }),
    [settledSearch, channelId],
  );
  const filtered = search.trim() !== '' || channelId !== ALL;
  const contacts = useContacts(workspaceId, filters);
  const channels = useChannelLabels(workspaceId).data ?? [];
  const channelName = new Map(channels.map((channel) => [channel.id, `@${channel.username}`]));
  const showChannel = channels.length > 1;
  const columns = showChannel ? 6 : 5;

  const rows = contacts.data?.pages.flatMap((page) => page.items) ?? [];
  const hasMore = contacts.hasNextPage;
  const count = contacts.data
    ? hasMore
      ? t('countMore', { count: rows.length })
      : t('count', { count: rows.length })
    : null;

  function clearFilters() {
    setSearch('');
    setChannelId(ALL);
  }

  const clearButton = (
    <Button size="sm" variant="secondary" icon={<RotateCcw />} onClick={clearFilters}>
      {t('filters.clear')}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        meta={count && !filtered ? [count] : undefined}
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <section aria-label={t('filters.label')} className="bg-cloth-pale shadow-cut">
          <div
            role="search"
            aria-label={t('filters.label')}
            className="grid items-end gap-3 p-3 sm:grid-cols-[minmax(14rem,1fr)_16rem_auto]"
          >
            <Field label={t('filters.search')}>
              {(control) => (
                <SearchInput
                  {...control}
                  size="sm"
                  placeholder={t('filters.searchPlaceholder')}
                  value={search}
                  maxLength={60}
                  onChange={(event) => setSearch(event.target.value)}
                  onClear={() => setSearch('')}
                />
              )}
            </Field>
            {showChannel ? (
              <Field label={t('filters.channel')}>
                {(control) => (
                  <Select
                    {...control}
                    size="sm"
                    items={[
                      { value: ALL, label: t('filters.allChannels') },
                      ...channels.map((channel) => ({
                        value: channel.id,
                        label: `@${channel.username}`,
                      })),
                    ]}
                    value={channelId}
                    onValueChange={(value) => setChannelId(value ?? ALL)}
                  />
                )}
              </Field>
            ) : null}
            {filtered ? clearButton : null}
          </div>
        </section>

        {contacts.isError ? (
          <EmptyState
            kind="error"
            size="lg"
            headingLevel={2}
            title={t('loadFailed')}
            description={tCommon('states.loadFailedDescription')}
            actions={
              <Button variant="secondary" icon={<RotateCcw />} onClick={() => contacts.refetch()}>
                {tCommon('actions.retry')}
              </Button>
            }
          />
        ) : (
          <>
            <h2 className="sr-only">{t('table.label')}</h2>
            {filtered && count ? (
              <p role="status" className="text-sm text-ink-muted">
                {count}
              </p>
            ) : null}
            <Table
              aria-label={t('table.label')}
              aria-busy={contacts.isPending || undefined}
              framed
              className="min-w-[44rem]"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.contact')}</TableHead>
                  {showChannel ? <TableHead>{t('table.channel')}</TableHead> : null}
                  <TableHead>{t('table.follows')}</TableHead>
                  <TableHead numeric>{t('table.interactions')}</TableHead>
                  <TableHead>{t('table.firstSeen')}</TableHead>
                  <TableHead>{t('table.lastInteraction')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.isPending ? (
                  <TableSkeletonRows columns={columns} />
                ) : rows.length === 0 ? (
                  filtered ? (
                    <TableEmpty
                      colSpan={columns}
                      kind="no-results"
                      title={t('noResults.title')}
                      actions={clearButton}
                    >
                      {t('noResults.description')}
                    </TableEmpty>
                  ) : (
                    <TableEmpty
                      colSpan={columns}
                      title={t('empty.title')}
                      actions={
                        canConnect && channels.length === 0 ? (
                          <LinkButton
                            size="sm"
                            variant="secondary"
                            icon={<AtSign />}
                            render={<NextLink href={workspacePath(workspaceId, '/channels')} />}
                          >
                            {t('empty.action')}
                          </LinkButton>
                        ) : undefined
                      }
                    >
                      {t('empty.description')}
                    </TableEmpty>
                  )
                ) : (
                  rows.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      channel={showChannel ? (channelName.get(contact.channelId) ?? '—') : null}
                    />
                  ))
                )}
              </TableBody>
            </Table>
            {hasMore ? (
              <div>
                <Button
                  variant="secondary"
                  loading={contacts.isFetchingNextPage}
                  onClick={() => contacts.fetchNextPage()}
                >
                  {tCommon('actions.loadMore')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function ContactRow({ contact, channel }: { contact: ContactDto; channel: string | null }) {
  const t = useTranslations('contacts');
  const format = useFormatter();
  const follows = contact.isFollower === null ? 'unknown' : contact.isFollower ? 'yes' : 'no';
  return (
    <TableRow>
      <TableCell>
        {contact.username ? (
          <span className="font-medium">@{contact.username}</span>
        ) : (
          <span className="text-ink-muted">
            {t('unknown')} <Code>{contact.externalId}</Code>
          </span>
        )}
      </TableCell>
      {channel !== null ? <TableCell>{channel}</TableCell> : null}
      <TableCell className={follows === 'unknown' ? 'text-ink-muted' : undefined}>
        {t(`follows.${follows}`)}
      </TableCell>
      <TableCell numeric>{format.number(contact.interactions)}</TableCell>
      <TableCell>
        <time dateTime={contact.firstSeenAt}>
          {format.dateTime(new Date(contact.firstSeenAt), { dateStyle: 'medium' })}
        </time>
      </TableCell>
      <TableCell>
        <RelativeTime
          date={contact.lastInteractionAt}
          format="short"
          className="whitespace-nowrap"
        />
      </TableCell>
    </TableRow>
  );
}
