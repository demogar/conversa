import { HydrationBoundary } from '@tanstack/react-query';
import { ContactsScreen } from '@/features/contacts/contacts-screen';
import { channelsQuery } from '@/lib/api/hooks/channels';
import { contactsQuery } from '@/lib/api/hooks/contacts';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.contacts'));

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // The screen opens unfiltered.
  const state = await prefetch(
    contactsQuery(workspaceId, {}, serverGet),
    channelsQuery(workspaceId, serverGet),
  );
  return (
    <HydrationBoundary state={state}>
      <ContactsScreen workspaceId={workspaceId} />
    </HydrationBoundary>
  );
}
