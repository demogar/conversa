'use client';

import { RelativeTime as MolaRelativeTime } from '@demogar/mola-ui';
import { useNow } from 'next-intl';
import { type ComponentProps, useSyncExternalStore } from 'react';

const noSubscription = () => () => {};

/**
 * Mola's RelativeTime, safe to render on the server. Left alone it prints an
 * absolute UTC date until hydration and then swaps in "5 min ago", which
 * reflows a table. While the server's HTML hydrates this pins `now` to the
 * request's time (next-intl hands the same value to both sides), so both
 * print the same words; after that it lets go and the time stays live.
 */
export function RelativeTime(props: ComponentProps<typeof MolaRelativeTime>) {
  const requestNow = useNow();
  const hydrating = useSyncExternalStore(
    noSubscription,
    () => false,
    () => true,
  );
  return <MolaRelativeTime now={hydrating ? requestNow : undefined} {...props} />;
}
