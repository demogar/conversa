import type { ReactNode } from 'react';
import { SettingsFrame } from '@/features/settings/settings-frame';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('nav.settings'));

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
