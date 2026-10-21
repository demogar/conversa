import { ContentScreen } from '@/features/content/content-screen';

export default async function ContentPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <ContentScreen workspaceId={workspaceId} />;
}
