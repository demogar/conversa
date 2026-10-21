'use client';

import {
  AlertDialog,
  Badge,
  Button,
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
import type { InstanceUserDto } from '@conversa/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SettingsSection } from '@/features/settings/settings-section';
import { useInstanceAdmins, useSetInstanceAdmin } from '@/lib/api/hooks/admin';
import { useMe } from '@/lib/api/hooks/session';
import { useErrorMessage } from '@/lib/errors';

export function InstanceAdminsSection() {
  const t = useTranslations('admin.admins');
  const tCommon = useTranslations('common.actions');
  const toast = useToast();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const me = useMe();
  const users = useInstanceAdmins();
  const setAdmin = useSetInstanceAdmin();
  const [revoking, setRevoking] = useState<InstanceUserDto | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const myId = me.data?.user.id;
  const revokingSelf = revoking?.id === myId;

  function grant(user: InstanceUserDto) {
    setAdmin.mutate(
      { userId: user.id, isInstanceAdmin: true },
      {
        onSuccess: () => toast.success({ title: t('granted', { name: user.name }) }),
        onError: (error) =>
          toast.error({ title: t('grantFailed'), description: errorMessage(error) }),
      },
    );
  }

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await setAdmin.mutateAsync({ userId: revoking.id, isInstanceAdmin: false });
    } catch (failure) {
      setRevokeError(errorMessage(failure));
      throw failure;
    }
    toast.show({ title: t('revoked', { name: revoking.name }) });
    if (revokingSelf) router.replace('/');
  }

  return (
    <SettingsSection id="admin-admins" wide title={t('title')} description={t('description')}>
      <Table aria-label={t('label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('name')}</TableHead>
            <TableHead>{t('email')}</TableHead>
            <TableHead>{t('access')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.isPending ? (
            <TableSkeletonRows columns={4} rows={3} />
          ) : users.isError ? (
            <TableEmpty
              colSpan={4}
              kind="error"
              title={t('loadFailed')}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void users.refetch()}>
                  {tCommon('retry')}
                </Button>
              }
            >
              {errorMessage(users.error)}
            </TableEmpty>
          ) : users.data.length === 0 ? (
            <TableEmpty colSpan={4} title={t('empty')} />
          ) : (
            users.data.map((user) => {
              const self = user.id === myId;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span dir="auto">{user.name}</span>
                      {self ? <Badge variant="outline">{t('you')}</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="break-all">{user.email}</TableCell>
                  <TableCell>
                    {user.isInstanceAdmin ? (
                      <Badge tone="accent" dot>
                        {t('admin')}
                      </Badge>
                    ) : (
                      t('member')
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {user.isInstanceAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('revokeLabel', { name: user.name })}
                        onClick={() => {
                          setRevokeError(null);
                          setRevoking(user);
                        }}
                      >
                        {t('revoke')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={t('grantLabel', { name: user.name })}
                        disabled={setAdmin.isPending}
                        onClick={() => grant(user)}
                      >
                        {t('grant')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        tone="danger"
        title={
          revokingSelf
            ? t('revokeSelfDialogTitle')
            : t('revokeDialogTitle', { name: revoking?.name ?? '' })
        }
        description={
          revokingSelf
            ? t('revokeSelfDialogDescription')
            : t('revokeDialogDescription', { name: revoking?.name ?? '' })
        }
        confirmLabel={t('revoke')}
        error={revokeError}
        onConfirm={confirmRevoke}
      />
    </SettingsSection>
  );
}
