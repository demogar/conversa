import { NewAutomationScreen } from '@/features/automations/automation-builder';

type Search = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || null;

export default async function NewAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Search>;
}) {
  const { workspaceId } = await params;
  const search = await searchParams;
  // ?bufferPostId= and ?channelId= come from the content calendar, to attach the automation to a scheduled post.
  return (
    <NewAutomationScreen
      workspaceId={workspaceId}
      defaults={{ bufferPostId: first(search.bufferPostId), channelId: first(search.channelId) }}
    />
  );
}
