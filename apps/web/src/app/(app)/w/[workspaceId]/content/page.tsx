import { HydrationBoundary } from '@tanstack/react-query';
import { ContentScreen } from '@/features/content/content-screen';
import { bufferStatusQuery } from '@/lib/api/hooks/buffer';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.content'));

export default async function ContentPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // The posts themselves come from Buffer, so the calendar loads them in its own panel.
  const state = await prefetch(bufferStatusQuery(workspaceId, serverGet));
  return (
    <HydrationBoundary state={state}>
      <ContentScreen workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
