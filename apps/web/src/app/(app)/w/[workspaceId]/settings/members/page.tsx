import { HydrationBoundary } from '@tanstack/react-query';
import { MembersSettings } from '@/features/settings/members-settings';
import { invitationsQuery, membersQuery } from '@/lib/api/hooks/settings';
import { isWorkspaceAdmin, prefetch, serverGet } from '@/lib/api/server';

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // Only admins see pending invitations; anyone else would get a 403 for them.
  const admin = await isWorkspaceAdmin(workspaceId);
  const state = await prefetch(
    membersQuery(workspaceId, serverGet),
    ...(admin ? [invitationsQuery(workspaceId, serverGet)] : []),
  );
  return (
    <HydrationBoundary state={state}>
      <MembersSettings workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
