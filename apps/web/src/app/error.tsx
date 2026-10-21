'use client';

import { RouteErrorScreen } from '@/features/errors/status-screens';

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteErrorScreen error={error} retry={retry} standalone />;
}
