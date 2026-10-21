import { OverviewScreen } from '@/features/dashboard/overview-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.dashboard'));

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <OverviewScreen workspaceId={workspaceId} />;
}
