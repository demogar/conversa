import { ContactsScreen } from '@/features/contacts/contacts-screen';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.contacts'));

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ContactsScreen workspaceId={workspaceId} />;
}
