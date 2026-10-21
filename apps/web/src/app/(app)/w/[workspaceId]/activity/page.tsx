import { ActivityScreen } from '@/features/activity/activity-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.activity'));

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ActivityScreen workspaceId={workspaceId} />;
}
