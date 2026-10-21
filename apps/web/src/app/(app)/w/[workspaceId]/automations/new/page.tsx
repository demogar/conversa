import { HydrationBoundary } from '@tanstack/react-query';
import { NewAutomationScreen } from '@/features/automations/automation-builder';
import { bufferStatusQuery } from '@/lib/api/hooks/buffer';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('automations.builder.newTitle'));

type Search = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || null;

export default async function NewAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Search>;
}) {
  const { workspaceId } = await params;
  const [search, state] = await Promise.all([
    searchParams,
    prefetch(channelsQuery(workspaceId, serverGet), bufferStatusQuery(workspaceId, serverGet)),
  ]);
  // ?bufferPostId= and ?channelId= come from the content calendar, to attach the automation to a scheduled post.
  return (
    <HydrationBoundary state={state}>
      <NewAutomationScreen
        workspaceId={workspaceId}
        defaults={{ bufferPostId: first(search.bufferPostId), channelId: first(search.channelId) }}
      />
    </HydrationBoundary>
  );
}
