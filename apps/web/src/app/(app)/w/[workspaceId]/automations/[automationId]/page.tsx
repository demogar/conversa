import { EditAutomationScreen } from '@/features/automations/automation-builder';

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; automationId: string }>;
}) {
  const { workspaceId, automationId } = await params;
  return <EditAutomationScreen workspaceId={workspaceId} automationId={automationId} />;
}
