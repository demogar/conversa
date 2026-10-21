'use client';

import {
  AlertDialog,
  Badge,
  Button,
  Callout,
  Select,
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
import { hasRole, type InvitationDto, type MemberDto, type WorkspaceRole } from '@conversa/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCurrentWorkspace, useMe } from '@/lib/api/hooks/session';
import {
  useChangeRole,
  useInvitations,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
} from '@/lib/api/hooks/settings';
import { keys } from '@/lib/api/keys';
import { useErrorMessage } from '@/lib/errors';
import { InviteForm } from './invite-form';
import { assignableRoles, canChangeRole } from './roles';
import { SettingsSection } from './settings-section';

export function MembersSettings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings.members');
  const workspace = useCurrentWorkspace(workspaceId);
  const isAdmin = workspace ? hasRole(workspace.role, 'ADMIN') : false;

  return (
    <>
      {workspace && !isAdmin ? (
        <Callout
          tone="info"
          variant="flat"
          headingLevel={2}
          title={t('readOnly.title')}
          className="mb-4"
        >
          {t('readOnly.description', { workspace: workspace.name })}
        </Callout>
      ) : null}
      <SettingsSection id="settings-members" wide title={t('title')} description={t('description')}>
        <MembersTable workspaceId={workspaceId} />
      </SettingsSection>
      {workspace && isAdmin ? (
        <>
          <SettingsSection
            id="settings-invite"
            title={t('invite.title')}
            description={t('invite.description', { workspace: workspace.name })}
          >
            <InviteForm workspaceId={workspaceId} />
          </SettingsSection>
          <SettingsSection
            id="settings-pending"
            wide
            title={t('pending.title')}
            description={t('pending.description')}
          >
            <PendingInvitations workspaceId={workspaceId} />
          </SettingsSection>
        </>
      ) : null}
    </>
  );
}

function MembersTable({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings.members');
  const tRoles = useTranslations('common.roles');
  const tCommon = useTranslations('common.actions');
  const tGeneral = useTranslations('settings.general.danger');
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const me = useMe();
  const workspace = useCurrentWorkspace(workspaceId);
  const members = useMembers(workspaceId);
  const changeRole = useChangeRole(workspaceId);
  const remove = useRemoveMember(workspaceId);
  const [removing, setRemoving] = useState<MemberDto | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const myId = me.data?.user.id;
  const myRole = workspace?.role;
  const roles = assignableRoles(myRole);
  const leaving = removing?.userId === myId;
  const workspaceName = workspace?.name ?? '';

  function change(member: MemberDto, role: WorkspaceRole | null) {
    if (!role || role === member.role) return;
    changeRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () =>
          toast.success({ title: t('roleChanged', { name: member.name, role: tRoles(role) }) }),
        onError: (error) =>
          toast.error({ title: t('roleFailed'), description: errorMessage(error) }),
      },
    );
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.userId);
    } catch (failure) {
      setRemoveError(t('removeFailed', { reason: errorMessage(failure) }));
      throw failure;
    }
    if (leaving) {
      toast.show({ title: tGeneral('left', { workspace: workspaceName }) });
      router.replace('/');
      await queryClient.invalidateQueries({ queryKey: keys.me });
    } else {
      toast.show({ title: t('removed', { name: removing.name }) });
    }
  }

  return (
    <>
      <Table aria-label={t('table.label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.email')}</TableHead>
            <TableHead>{t('table.role')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('table.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.isPending ? (
            <TableSkeletonRows columns={4} rows={3} />
          ) : members.isError ? (
            <TableEmpty
              colSpan={4}
              kind="error"
              title={t('table.loadFailed')}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void members.refetch()}>
                  {tCommon('retry')}
                </Button>
              }
            >
              {errorMessage(members.error)}
            </TableEmpty>
          ) : members.data.length === 0 ? (
            <TableEmpty colSpan={4} title={t('table.empty')} />
          ) : (
            members.data.map((member) => {
              const self = member.userId === myId;
              const editable = !self && canChangeRole(myRole, member.role);
              const removable = self || editable;
              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span dir="auto">{member.name}</span>
                      {self ? <Badge variant="outline">{t('table.you')}</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="break-all">{member.email}</TableCell>
                  <TableCell>
                    {editable ? (
                      <div className="w-40">
                        <Select<WorkspaceRole>
                          size="sm"
                          aria-label={t('table.roleOf', { name: member.name })}
                          value={member.role}
                          disabled={changeRole.isPending}
                          onValueChange={(role) => change(member, role)}
                          items={roles.map((value) => ({ value, label: tRoles(value) }))}
                        />
                      </div>
                    ) : (
                      tRoles(member.role)
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {removable ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={self ? undefined : t('removeLabel', { name: member.name })}
                        onClick={() => {
                          setRemoveError(null);
                          setRemoving(member);
                        }}
                      >
                        {self ? t('leave') : t('remove')}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          leaving
            ? tGeneral('leaveDialogTitle', { workspace: workspaceName })
            : t('removeDialogTitle', { name: removing?.name ?? '', workspace: workspaceName })
        }
        description={
          leaving
            ? tGeneral('leaveDialogDescription')
            : t('removeDialogDescription', { name: removing?.name ?? '' })
        }
        confirmLabel={leaving ? tGeneral('leaveButton') : t('removeConfirm')}
        error={removeError}
        onConfirm={confirmRemove}
      />
    </>
  );
}

function PendingInvitations({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings.members.pending');
  const tRoles = useTranslations('common.roles');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const invitations = useInvitations(workspaceId);
  const revoke = useRevokeInvitation(workspaceId);
  const [revoking, setRevoking] = useState<InvitationDto | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function confirmRevoke() {
    if (!revoking) return;
    try {
      await revoke.mutateAsync(revoking.id);
    } catch (failure) {
      setRevokeError(t('revokeFailed', { reason: errorMessage(failure) }));
      throw failure;
    }
    toast.show({ title: t('revoked') });
  }

  return (
    <>
      <Table aria-label={t('label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('email')}</TableHead>
            <TableHead>{t('role')}</TableHead>
            <TableHead>{t('invitedBy')}</TableHead>
            <TableHead>{t('expires')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.isPending ? (
            <TableSkeletonRows columns={5} rows={2} />
          ) : invitations.isError ? (
            <TableEmpty
              colSpan={5}
              kind="error"
              title={t('loadFailed')}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void invitations.refetch()}>
                  {tCommon('actions.retry')}
                </Button>
              }
            >
              {errorMessage(invitations.error)}
            </TableEmpty>
          ) : invitations.data.length === 0 ? (
            <TableEmpty colSpan={5} title={t('empty')}>
              {t('emptyDescription')}
            </TableEmpty>
          ) : (
            invitations.data.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell className="break-all">{invitation.email}</TableCell>
                <TableCell>{tRoles(invitation.role)}</TableCell>
                <TableCell>
                  <span dir="auto">{invitation.invitedBy ?? '—'}</span>
                </TableCell>
                <TableCell>
                  <time dateTime={invitation.expiresAt}>
                    {format.dateTime(new Date(invitation.expiresAt), { dateStyle: 'medium' })}
                  </time>
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('revokeLabel', { email: invitation.email })}
                    onClick={() => {
                      setRevokeError(null);
                      setRevoking(invitation);
                    }}
                  >
                    {t('revoke')}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t('revokeDialogTitle', { email: revoking?.email ?? '' })}
        description={t('revokeDialogDescription', { email: revoking?.email ?? '' })}
        confirmLabel={t('revokeConfirm')}
        error={revokeError}
        onConfirm={confirmRevoke}
      />
    </>
  );
}
