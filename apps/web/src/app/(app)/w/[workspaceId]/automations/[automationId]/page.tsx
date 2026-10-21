import { EditAutomationScreen } from '@/features/automations/automation-builder';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.automations'));

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; automationId: string }>;
}) {
  const { workspaceId, automationId } = await params;
  return <EditAutomationScreen workspaceId={workspaceId} automationId={automationId} />;
}
