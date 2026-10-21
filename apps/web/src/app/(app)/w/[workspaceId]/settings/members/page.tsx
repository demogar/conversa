'use client';

import { useParams } from 'next/navigation';
import { MembersSettings } from '@/features/settings/members-settings';

export default function MembersSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <MembersSettings workspaceId={workspaceId} />;
}
