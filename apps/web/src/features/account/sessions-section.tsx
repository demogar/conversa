'use client';

import {
  Badge,
  Button,
  RelativeTime,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
  useToast,
} from '@demogar/mola-ui';
import type { SessionDto } from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { SettingsSection } from '@/features/settings/settings-section';
import { useRevokeSession, useSessions } from '@/lib/api/hooks/account';
import { useErrorMessage } from '@/lib/errors';
import { summariseUserAgent } from './user-agent';

export function SessionsSection() {
  const t = useTranslations('account.sessions');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const sessions = useSessions();
  const revoke = useRevokeSession();

  function describe(session: SessionDto): string {
    const { browser, os } = summariseUserAgent(session.userAgent);
    if (browser && os) return t('deviceSummary', { browser, os });
    return browser ?? os ?? t('unknownDevice');
  }

  function signOut(session: SessionDto) {
    const device = describe(session);
    revoke.mutate(session.id, {
      onSuccess: () => toast.show({ title: t('signedOut', { device }) }),
      onError: (error) =>
        toast.error({ title: t('signOutFailed'), description: errorMessage(error) }),
    });
  }

  return (
    <SettingsSection id="account-sessions" wide title={t('title')} description={t('description')}>
      <Table aria-label={t('label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('device')}</TableHead>
            <TableHead>{t('ip')}</TableHead>
            <TableHead>{t('lastSeen')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.isPending ? (
            <TableSkeletonRows columns={4} rows={2} />
          ) : sessions.isError ? (
            <TableEmpty
              colSpan={4}
              kind="error"
              title={t('loadFailed')}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void sessions.refetch()}>
                  {tCommon('retry')}
                </Button>
              }
            >
              {errorMessage(sessions.error)}
            </TableEmpty>
          ) : (
            sessions.data.map((session) => {
              const device = describe(session);
              return (
                <TableRow key={session.id}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span title={session.userAgent ?? undefined}>{device}</span>
                      {session.current ? (
                        <Badge dot tone="success">
                          {t('thisDevice')}
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="literal">{session.ip ?? t('unknownIp')}</span>
                  </TableCell>
                  <TableCell>
                    <RelativeTime date={session.lastSeenAt} />
                  </TableCell>
                  <TableCell className="text-end">
                    {session.current ? null : (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('signOutLabel', { device })}
                        loading={revoke.isPending && revoke.variables === session.id}
                        onClick={() => signOut(session)}
                      >
                        {t('signOut')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </SettingsSection>
  );
}
