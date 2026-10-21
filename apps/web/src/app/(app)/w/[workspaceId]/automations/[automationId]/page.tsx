import { HydrationBoundary } from '@tanstack/react-query';
import { EditAutomationScreen } from '@/features/automations/automation-builder';
import { automationQuery } from '@/lib/api/hooks/automations';
import { bufferStatusQuery } from '@/lib/api/hooks/buffer';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.automations'));

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; automationId: string }>;
}) {
  const { workspaceId, automationId } = await params;
  // The account's posts come from Instagram and Buffer's from Buffer: the form loads those itself.
  const state = await prefetch(
    automationQuery(workspaceId, automationId, serverGet),
    channelsQuery(workspaceId, serverGet),
    bufferStatusQuery(workspaceId, serverGet),
  );
  return (
    <HydrationBoundary state={state}>
      <EditAutomationScreen workspaceId={workspaceId} automationId={automationId} />
    </HydrationBoundary>
  );
}
