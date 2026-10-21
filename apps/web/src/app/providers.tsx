'use client';

import {
  DirectionProvider,
  MessagesProvider,
  ToastProvider,
  TooltipProvider,
} from '@demogar/mola-ui';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { FORMAT_LOCALE } from '@/i18n/config';
import { molaMessages } from '@/i18n/mola';
import { ApiError } from '@/lib/api/client';
import type { Locale } from '@conversa/shared';

/** A lost session anywhere sends the person back to sign in, then here again. */
function handleError(error: unknown): void {
  if (
    error instanceof ApiError &&
    error.code === 'UNAUTHENTICATED' &&
    typeof window !== 'undefined'
  ) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // A full load, not a client navigation: nothing cached for the old session survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${next}`);
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors will not fix themselves; retry only what might.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

export function Providers({ children, locale }: { children: ReactNode; locale: string }) {
  const [queryClient] = useState(makeQueryClient);
  const typed = locale as Locale;
  return (
    <QueryClientProvider client={queryClient}>
      <MessagesProvider locale={FORMAT_LOCALE[typed] ?? locale} messages={molaMessages[typed]}>
        <DirectionProvider direction="ltr">
          <ToastProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ToastProvider>
        </DirectionProvider>
      </MessagesProvider>
    </QueryClientProvider>
  );
}
