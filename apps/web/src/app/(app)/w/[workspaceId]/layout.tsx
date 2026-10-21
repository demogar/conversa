import { HydrationBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/features/shell/workspace-shell';
import { prefetch, serverGet } from '@/lib/api/server';
import { instanceQuery, meQuery } from '@/lib/api/hooks/session';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  // The shell (switcher, avatar) and every screen's role checks and sandbox notes read these.
  const state = await prefetch(meQuery(serverGet), instanceQuery(serverGet));
  return (
    <HydrationBoundary state={state}>
      <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>
    </HydrationBoundary>
  );
}
