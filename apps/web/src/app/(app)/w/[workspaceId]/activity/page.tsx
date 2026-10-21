import { ActivityScreen } from '@/features/activity/activity-screen';

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ActivityScreen workspaceId={workspaceId} />;
}
