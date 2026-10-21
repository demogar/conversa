import { HydrationBoundary } from '@tanstack/react-query';
import { ActivityScreen } from '@/features/activity/activity-screen';
import { activityQuery } from '@/lib/api/hooks/activity';
import { automationsQuery } from '@/lib/api/hooks/automations';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.activity'));

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // The screen opens unfiltered.
  const state = await prefetch(
    activityQuery(workspaceId, {}, serverGet),
    automationsQuery(workspaceId, serverGet),
  );
  return (
    <HydrationBoundary state={state}>
      <ActivityScreen workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
