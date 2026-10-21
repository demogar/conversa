import { HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { ChannelsScreen } from '@/features/channels/channels-screen';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.channels'));

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const state = await prefetch(channelsQuery(workspaceId, serverGet));
  return (
    <HydrationBoundary state={state}>
      <Suspense>
        <ChannelsScreen workspaceId={workspaceId} />
      </Suspense>
    </HydrationBoundary>
  );
}
