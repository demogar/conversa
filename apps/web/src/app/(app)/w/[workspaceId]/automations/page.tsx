import { HydrationBoundary } from '@tanstack/react-query';
import { AutomationsScreen } from '@/features/automations/automations-screen';
import { automationsQuery } from '@/lib/api/hooks/automations';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.automations'));

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetch(
    automationsQuery(workspaceId, serverGet),
    channelsQuery(workspaceId, serverGet),
  );
  return (
    <HydrationBoundary state={state}>
      <AutomationsScreen workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
