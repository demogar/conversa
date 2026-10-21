import { HydrationBoundary } from '@tanstack/react-query';
import { OverviewScreen } from '@/features/dashboard/overview-screen';
import { automationsQuery } from '@/lib/api/hooks/automations';
import { dashboardQuery, DEFAULT_DASHBOARD_RANGE } from '@/lib/api/hooks/dashboard';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.dashboard'));

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetch(
    dashboardQuery(workspaceId, DEFAULT_DASHBOARD_RANGE, serverGet),
    automationsQuery(workspaceId, serverGet),
  );
  return (
    <HydrationBoundary state={state}>
      <OverviewScreen workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
