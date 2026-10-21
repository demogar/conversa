import { HydrationBoundary } from '@tanstack/react-query';
import { BufferSettings } from '@/features/integrations/buffer-settings';
import { bufferStatusQuery } from '@/lib/api/hooks/buffer';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { prefetch, serverGet } from '@/lib/api/server';

export default async function IntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // Organizations and channels are read from Buffer, so their panels load them after the page.
  const state = await prefetch(
    bufferStatusQuery(workspaceId, serverGet),
    channelsQuery(workspaceId, serverGet),
  );
  return (
    <HydrationBoundary state={state}>
      <BufferSettings workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
