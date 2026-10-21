import { HydrationBoundary } from '@tanstack/react-query';
import { InboxScreen } from '@/features/inbox/inbox-screen';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.inbox'));

export default async function InboxPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  // Conversations are read live from Instagram, so the panes load them after the page.
  const state = await prefetch(channelsQuery(workspaceId, serverGet));
  return (
    <HydrationBoundary state={state}>
      <InboxScreen workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
