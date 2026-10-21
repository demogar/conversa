'use client';

import {
  Button,
  Code,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  RelativeTime,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
  Text,
} from '@demogar/mola-ui';
import { DeliveryStatus, type DeliveryDto } from '@conversa/shared';
import { Plus, RotateCcw } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { type ActivityFilters, useActivity, useAutomationOptions } from '@/lib/api/hooks/activity';
import { workspacePath } from '@/lib/navigation';
import { DeliveryStatusBadge, useDeliveryExplanation } from './delivery-status';

const ALL = 'all';
const STATUSES: DeliveryStatus[] = [
  DeliveryStatus.SENT,
  DeliveryStatus.AWAITING_TAP,
  DeliveryStatus.AWAITING_FOLLOW,
  DeliveryStatus.FAILED,
  DeliveryStatus.SKIPPED,
  DeliveryStatus.PENDING,
];
const COLUMNS = 8;

export function ActivityScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('activity');
  const tCommon = useTranslations('common');
  const explain = useDeliveryExplanation();
  const [automationId, setAutomationId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const filters = useMemo<ActivityFilters>(
    () => ({
      automationId: automationId === ALL ? undefined : automationId,
      status: status === ALL ? undefined : (status as DeliveryStatus),
    }),
    [automationId, status],
  );
  const filtered = automationId !== ALL || status !== ALL;
  const activity = useActivity(workspaceId, filters);
  const automations = useAutomationOptions(workspaceId);
  const rows = activity.data?.pages.flatMap((page) => page.items) ?? [];

  const automationItems = [
    { value: ALL, label: t('filters.allAutomations') },
    ...(automations.data ?? []).map((automation) => ({ value: automation.id, label: automation.name })),
  ];
  const statusItems = [
    { value: ALL, label: t('filters.allStatuses') },
    ...STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
  ];

  function clearFilters() {
    setAutomationId(ALL);
    setStatus(ALL);
  }

  const clearButton = (
    <Button size="sm" variant="secondary" icon={<RotateCcw />} onClick={clearFilters}>
      {t('filters.clear')}
    </Button>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <section aria-label={t('filters.label')} className="bg-cloth-pale shadow-cut">
          <div role="search" aria-label={t('filters.label')} className="grid items-end gap-3 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label={t('filters.automation')}>
              {(control) => (
                <Select
                  {...control}
                  size="sm"
                  items={automationItems}
                  value={automationId}
                  onValueChange={(value) => setAutomationId(value ?? ALL)}
                />
              )}
            </Field>
            <Field label={t('filters.status')}>
              {(control) => (
                <Select
                  {...control}
                  size="sm"
                  items={statusItems}
                  value={status}
                  onValueChange={(value) => setStatus(value ?? ALL)}
                />
              )}
            </Field>
            {filtered ? clearButton : null}
          </div>
        </section>

        {activity.isError ? (
          <EmptyState
            kind="error"
            size="lg"
            headingLevel={2}
            title={t('loadFailed')}
            description={tCommon('states.loadFailedDescription')}
            actions={
              <Button variant="secondary" icon={<RotateCcw />} onClick={() => activity.refetch()}>
                {tCommon('actions.retry')}
              </Button>
            }
          />
        ) : (
          <>
            <h2 className="sr-only">{t('table.label')}</h2>
            <Table aria-label={t('table.label')} aria-busy={activity.isPending || undefined} framed className="min-w-[64rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.time')}</TableHead>
                  <TableHead>{t('table.contact')}</TableHead>
                  <TableHead>{t('table.automation')}</TableHead>
                  <TableHead className="w-1/4">{t('table.trigger')}</TableHead>
                  <TableHead>{t('table.keyword')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.publicReply')}</TableHead>
                  <TableHead className="w-1/4">{t('table.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.isPending ? (
                  <TableSkeletonRows columns={COLUMNS} />
                ) : rows.length === 0 ? (
                  filtered ? (
                    <TableEmpty colSpan={COLUMNS} kind="no-results" title={t('noResults.title')} actions={clearButton}>
                      {t('noResults.description')}
                    </TableEmpty>
                  ) : (
                    <TableEmpty
                      colSpan={COLUMNS}
                      title={t('empty.title')}
                      actions={
                        <LinkButton
                          size="sm"
                          variant="secondary"
                          icon={<Plus />}
                          render={<NextLink href={workspacePath(workspaceId, '/automations/new')} />}
                        >
                          {t('empty.action')}
                        </LinkButton>
                      }
                    >
                      {t('empty.description')}
                    </TableEmpty>
                  )
                ) : (
                  rows.map((delivery) => (
                    <DeliveryRow key={delivery.id} delivery={delivery} explanation={explain(delivery)} />
                  ))
                )}
              </TableBody>
            </Table>
            {activity.hasNextPage ? (
              <div>
                <Button variant="secondary" loading={activity.isFetchingNextPage} onClick={() => activity.fetchNextPage()}>
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

function DeliveryRow({ delivery, explanation }: { delivery: DeliveryDto; explanation: string | null }) {
  const t = useTranslations('activity');
  return (
    <TableRow>
      <TableCell>
        <RelativeTime date={delivery.createdAt} format="short" className="whitespace-nowrap text-ink-muted" />
      </TableCell>
      <TableCell>
        {delivery.contact.username ? (
          <span className="font-medium">@{delivery.contact.username}</span>
        ) : (
          <span className="text-ink-muted">{t('unknownContact')}</span>
        )}
      </TableCell>
      <TableCell>{delivery.automationName}</TableCell>
      <TableCell truncate title={delivery.triggerText} className="font-text">
        {delivery.triggerText}
      </TableCell>
      <TableCell>
        {delivery.matchedKeyword ? <Code>{delivery.matchedKeyword}</Code> : <span className="text-ink-muted">{t('anyText')}</span>}
      </TableCell>
      <TableCell>
        <DeliveryStatusBadge status={delivery.status} />
      </TableCell>
      <TableCell>{delivery.publicReplySent ? t('publicReplySent') : '—'}</TableCell>
      <TableCell>
        {explanation ? (
          <Text as="div" size="sm" variant="secondary" className="whitespace-normal">
            {explanation}
            {delivery.status === 'FAILED' && delivery.errorCode ? (
              <span className="ms-1">
                <Code>{delivery.errorCode}</Code>
              </span>
            ) : null}
            {delivery.attempts > 1 ? <span className="ms-1 text-ink-muted">· {t('attempts', { count: delivery.attempts })}</span> : null}
          </Text>
        ) : (
          '—'
        )}
      </TableCell>
    </TableRow>
  );
}
