import { Suspense } from 'react';
import { ChannelsScreen } from '@/features/channels/channels-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.channels'));

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <Suspense>
      <ChannelsScreen workspaceId={workspaceId} />
    </Suspense>
  );
}
