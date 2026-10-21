'use client';

import { RouteErrorScreen } from '@/features/errors/status-screens';

/** Below the workspace layout, so the navigation stays and the person can go elsewhere. */
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteErrorScreen error={error} retry={retry} />;
}
