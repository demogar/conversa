import { OverviewScreen } from '@/features/dashboard/overview-screen';

export default async function DashboardPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <OverviewScreen workspaceId={workspaceId} />;
}
