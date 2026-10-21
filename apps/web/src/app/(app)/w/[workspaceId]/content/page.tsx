import { ContentScreen } from '@/features/content/content-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.content'));

export default async function ContentPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ContentScreen workspaceId={workspaceId} />;
}
