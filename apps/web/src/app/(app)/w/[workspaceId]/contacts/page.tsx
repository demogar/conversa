import { ContactsScreen } from '@/features/contacts/contacts-screen';

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ContactsScreen workspaceId={workspaceId} />;
}
