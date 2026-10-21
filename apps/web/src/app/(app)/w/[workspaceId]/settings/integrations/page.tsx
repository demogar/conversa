import { BufferSettings } from '@/features/integrations/buffer-settings';

export default async function IntegrationsSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <BufferSettings workspaceId={workspaceId} />;
}
