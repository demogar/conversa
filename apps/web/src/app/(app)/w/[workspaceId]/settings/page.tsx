import { GeneralSettings } from '@/features/settings/general-settings';

/** Reads only the workspace and the person, which the workspace layout already prefetched. */
export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <GeneralSettings workspaceId={workspaceId} />;
}
