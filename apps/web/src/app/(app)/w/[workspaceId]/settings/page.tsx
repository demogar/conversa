'use client';

import { useParams } from 'next/navigation';
import { GeneralSettings } from '@/features/settings/general-settings';

export default function GeneralSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <GeneralSettings workspaceId={workspaceId} />;
}
