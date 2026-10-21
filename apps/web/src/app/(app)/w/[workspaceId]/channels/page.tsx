import { Suspense } from 'react';
import { ChannelsScreen } from '@/features/channels/channels-screen';

export default async function ChannelsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return (
    <Suspense>
      <ChannelsScreen workspaceId={workspaceId} />
    </Suspense>
  );
}
