import { AutomationsScreen } from '@/features/automations/automations-screen';

export default async function AutomationsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <AutomationsScreen workspaceId={workspaceId} />;
}
