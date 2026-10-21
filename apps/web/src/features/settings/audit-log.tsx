'use client';

import {
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from '@demogar/mola-ui';
import { hasRole } from '@conversa/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useCurrentWorkspace } from '@/lib/api/hooks/session';
import { useAuditLog } from '@/lib/api/hooks/settings';
import { useErrorMessage } from '@/lib/errors';
import { SettingsSection } from './settings-section';

/** Turns an action code ("member.invited") into a sentence; unknown codes still say something. */
export function useAuditSentence(): (action: string) => string {
  const t = useTranslations('settings.audit');
  return (action) => {
    const key = `actions.${action}` as 'actions.member.invited';
    return /^[a-z_]+\.[a-z_]+$/.test(action) && t.has(key)
      ? t(key)
      : t('unknownAction', { code: action });
  };
}

export function AuditLog({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings.audit');
  const tCommon = useTranslations('common.actions');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const sentence = useAuditSentence();
  const workspace = useCurrentWorkspace(workspaceId);
  const allowed = workspace ? hasRole(workspace.role, 'ADMIN') : false;
  const audit = useAuditLog(workspaceId, allowed);

  if (workspace && !allowed) {
    return (
      <EmptyState
        kind="no-permission"
        headingLevel={2}
        title={t('noPermission')}
        description={t('noPermissionDescription', { workspace: workspace.name })}
      />
    );
  }

  const entries = audit.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SettingsSection id="settings-audit" wide title={t('title')} description={t('description')}>
      <Table aria-label={t('label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('actor')}</TableHead>
            <TableHead>{t('action')}</TableHead>
            <TableHead>{t('time')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!workspace || audit.isPending ? (
            <TableSkeletonRows columns={3} rows={6} />
          ) : audit.isError ? (
            <TableEmpty
              colSpan={3}
              kind="error"
              title={t('loadFailed')}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void audit.refetch()}>
                  {tCommon('retry')}
                </Button>
              }
            >
              {errorMessage(audit.error)}
            </TableEmpty>
          ) : entries.length === 0 ? (
            <TableEmpty colSpan={3} title={t('empty')}>
              {t('emptyDescription')}
            </TableEmpty>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <span dir="auto">{entry.actor?.name ?? t('system')}</span>
                </TableCell>
                <TableCell>{sentence(entry.action)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <time dateTime={entry.createdAt}>
                    {format.dateTime(new Date(entry.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {audit.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            loading={audit.isFetchingNextPage}
            onClick={() => void audit.fetchNextPage()}
          >
            {tCommon('loadMore')}
          </Button>
        </div>
      ) : null}
    </SettingsSection>
  );
}
