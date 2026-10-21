import { InboxScreen } from '@/features/inbox/inbox-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.inbox'));

export default async function InboxPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <InboxScreen workspaceId={workspaceId} />;
}
