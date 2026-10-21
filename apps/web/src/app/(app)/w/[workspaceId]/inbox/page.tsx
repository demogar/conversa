import { InboxScreen } from '@/features/inbox/inbox-screen';

export default async function InboxPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <InboxScreen workspaceId={workspaceId} />;
}
