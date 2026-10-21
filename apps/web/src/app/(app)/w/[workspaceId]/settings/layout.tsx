import type { ReactNode } from 'react';
import { SettingsFrame } from '@/features/settings/settings-frame';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <SettingsFrame workspaceId={workspaceId}>{children}</SettingsFrame>;
}
