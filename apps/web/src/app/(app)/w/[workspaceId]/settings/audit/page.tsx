import { HydrationBoundary } from '@tanstack/react-query';
import { AuditLog } from '@/features/settings/audit-log';
import { auditLogQuery } from '@/lib/api/hooks/settings';
import { isWorkspaceAdmin, prefetch, serverGet } from '@/lib/api/server';

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // Members see a no-permission state instead, without asking.
  const admin = await isWorkspaceAdmin(workspaceId);
  const state = await prefetch(...(admin ? [auditLogQuery(workspaceId, serverGet)] : []));
  return (
    <HydrationBoundary state={state}>
      <AuditLog workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
