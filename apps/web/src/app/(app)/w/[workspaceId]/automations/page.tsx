import { AutomationsScreen } from '@/features/automations/automations-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.automations'));

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <AutomationsScreen workspaceId={workspaceId} />;
}
