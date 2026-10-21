'use client';

import { Button, Callout, Inline, LinkButton, Skeleton, Stack, Text } from '@demogar/mola-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MeDto } from '@conversa/shared';
import { AuthCard } from '@/features/auth/auth-card';
import { api } from '@/lib/api/client';
import { useInvitationPreview } from '@/lib/api/hooks/invitations';
import { keys } from '@/lib/api/keys';
import { useErrorMessage } from '@/lib/errors';
import { workspacePath } from '@/lib/navigation';

export default function InvitationPage() {
  const t = useTranslations('auth.invite');
  const tRoles = useTranslations('common.roles');
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const invitation = useInvitationPreview(token);
  // Signed in or not decides the way forward; a 401 here is expected, not an error.
  const me = useQuery({
    queryKey: [...keys.me, 'optional'],
    queryFn: ({ signal }) => api.get<MeDto>('/me', signal).catch(() => null),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.post<{ workspaceId: string }>('/invitations/accept', { token }),
    onSuccess: async ({ workspaceId }) => {
      await queryClient.invalidateQueries({ queryKey: keys.me });
      router.replace(workspacePath(workspaceId));
    },
  });

  if (invitation.isLoading || me.isLoading) {
    return (
      <AuthCard title={t('heading')}>
        <Skeleton className="h-24" />
      </AuthCard>
    );
  }

  if (!invitation.data) {
    return <AuthCard title={t('invalidTitle')} description={t('invalidDescription')} />;
  }

  const { workspaceName, email, role } = invitation.data;
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <AuthCard
      title={t('title', { workspace: workspaceName })}
      description={t('description', { workspace: workspaceName, role: tRoles(role) })}
    >
      <Stack gap="md">
        <Text variant="secondary">{t('forEmail', { email })}</Text>
        {accept.error ? <Callout tone="danger">{errorMessage(accept.error)}</Callout> : null}
        {me.data ? (
          <Button onClick={() => accept.mutate()} loading={accept.isPending}>
            {t('accept')}
          </Button>
        ) : (
          <Inline gap="sm">
            <LinkButton render={<NextLink href={`/signup?invite=${encodeURIComponent(token)}`} />}>
              {t('signupToAccept')}
            </LinkButton>
            <LinkButton variant="secondary" render={<NextLink href={`/login?next=${next}`} />}>
              {t('loginToAccept')}
            </LinkButton>
          </Inline>
        )}
      </Stack>
    </AuthCard>
  );
}
