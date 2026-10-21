'use client';

import {
  Button,
  EmptyState,
  Heading,
  Link,
  PageHeader,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  Stat,
  StatGroup,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@demogar/mola-ui';
import { type DashboardDto, hasRole } from '@conversa/shared';
import { RotateCcw } from 'lucide-react';
import NextLink from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAutomationOptions } from '@/lib/api/hooks/activity';
import { type DashboardRange, useDashboard } from '@/lib/api/hooks/dashboard';
import { useCurrentWorkspace } from '@/lib/api/hooks/session';
import { workspacePath } from '@/lib/navigation';
import { GettingStarted } from './getting-started';

const RANGES: DashboardRange[] = [7, 30, 90];

export function OverviewScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const workspace = useCurrentWorkspace(workspaceId);
  const [days, setDays] = useState<DashboardRange>(30);
  const dashboard = useDashboard(workspaceId, days);
  const automations = useAutomationOptions(workspaceId);
  const data = dashboard.data;

  const showChecklist =
    data !== undefined &&
    automations.data !== undefined &&
    (data.channels === 0 || automations.data.length === 0);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={workspace ? t('description', { workspace: workspace.name, days }) : undefined}
        actions={
          <SegmentedControl
            aria-label={t('range.label')}
            size="sm"
            value={String(days)}
            onValueChange={(value) => setDays(Number(value) as DashboardRange)}
            options={RANGES.map((range) => ({ value: String(range), label: t(`range.${range}`) }))}
          />
        }
      />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {showChecklist ? (
          <GettingStarted
            workspaceId={workspaceId}
            hasChannel={data.channels > 0}
            hasAutomation={automations.data.length > 0}
            canConnect={workspace ? hasRole(workspace.role, 'ADMIN') : false}
          />
        ) : null}

        {dashboard.isError ? (
          <EmptyState
            kind="error"
            size="lg"
            headingLevel={2}
            title={t('loadFailed')}
            description={tCommon('states.loadFailedDescription')}
            actions={
              <Button variant="secondary" icon={<RotateCcw />} onClick={() => dashboard.refetch()}>
                {tCommon('actions.retry')}
              </Button>
            }
          />
        ) : (
          <SkeletonGroup
            label={t('loading')}
            loading={dashboard.isPending}
            fallback={
              <div className="flex flex-col gap-6">
                <Skeleton className="h-28" />
                <div className="grid gap-6 lg:grid-cols-2">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-64" />
                </div>
              </div>
            }
          >
            {data ? (
              <div
                className="flex flex-col gap-6"
                aria-busy={dashboard.isPlaceholderData || undefined}
              >
                <h2 className="sr-only">{t('stats.label')}</h2>
                <StatGroup columns={5}>
                  <Stat
                    label={t('stats.triggered')}
                    value={format.number(data.totals.triggered)}
                    hint={t('stats.triggeredHint', { count: data.activeAutomations })}
                  />
                  <Stat
                    label={t('stats.sent')}
                    value={format.number(data.totals.sent)}
                    trend={data.daily.map((day) => day.sent)}
                  />
                  <Stat
                    label={t('stats.clicks')}
                    value={format.number(data.totals.clicks)}
                    hint={t('stats.clicksHint')}
                    trend={data.daily.map((day) => day.clicks)}
                  />
                  <Stat
                    label={t('stats.failed')}
                    value={format.number(data.totals.failed)}
                    trend={data.daily.map((day) => day.failed)}
                  />
                  <Stat label={t('stats.contacts')} value={format.number(data.totals.contacts)} />
                </StatGroup>
                <div className="grid items-start gap-6 lg:grid-cols-2">
                  <TopAutomations workspaceId={workspaceId} rows={data.topAutomations} />
                  <DailyTable daily={data.daily} />
                </div>
              </div>
            ) : null}
          </SkeletonGroup>
        )}
      </div>
    </>
  );
}

function TopAutomations({
  workspaceId,
  rows,
}: {
  workspaceId: string;
  rows: DashboardDto['topAutomations'];
}) {
  const t = useTranslations('dashboard.top');
  const format = useFormatter();
  return (
    <section aria-labelledby="top-automations-title" className="flex flex-col gap-3">
      <Heading level={2} visualLevel={4} id="top-automations-title">
        {t('title')}
      </Heading>
      <Table aria-label={t('label')} framed>
        <TableHeader>
          <TableRow>
            <TableHead>{t('name')}</TableHead>
            <TableHead numeric>{t('sent')}</TableHead>
            <TableHead numeric>{t('clicks')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={3} title={t('empty')}>
              {t('emptyDescription')}
            </TableEmpty>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell truncate>
                  <Link
                    render={
                      <NextLink href={workspacePath(workspaceId, `/automations/${row.id}`)} />
                    }
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell numeric>{format.number(row.sent)}</TableCell>
                <TableCell numeric>{format.number(row.clicks)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

/** The daily series as rows, newest first: the figures behind the sparklines, readable by anyone. */
function DailyTable({ daily }: { daily: DashboardDto['daily'] }) {
  const t = useTranslations('dashboard.daily');
  const format = useFormatter();
  const newestFirst = [...daily].reverse();
  return (
    <section aria-labelledby="daily-title" className="flex flex-col gap-3">
      <Heading level={2} visualLevel={4} id="daily-title">
        {t('title')}
      </Heading>
      <Table aria-label={t('label')} framed stickyHeader frameClassName="max-h-96">
        <TableHeader>
          <TableRow>
            <TableHead>{t('date')}</TableHead>
            <TableHead numeric>{t('sent')}</TableHead>
            <TableHead numeric>{t('clicks')}</TableHead>
            <TableHead numeric>{t('failed')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {newestFirst.map((day) => (
            <TableRow key={day.date}>
              <TableCell>
                <time dateTime={day.date}>
                  {format.dateTime(new Date(`${day.date}T00:00:00Z`), {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </time>
              </TableCell>
              <TableCell numeric>{format.number(day.sent)}</TableCell>
              <TableCell numeric>{format.number(day.clicks)}</TableCell>
              <TableCell numeric>{format.number(day.failed)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
