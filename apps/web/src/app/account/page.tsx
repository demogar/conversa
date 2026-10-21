import { HydrationBoundary } from '@tanstack/react-query';
import { AccountPage } from '@/features/account/account-page';
import { sessionsQuery } from '@/lib/api/hooks/account';
import { meQuery } from '@/lib/api/hooks/session';
import { prefetch, serverGet } from '@/lib/api/server';
import { pageTitle } from '@/lib/metadata';

export const generateMetadata = pageTitle((t) => t('account.title'));

export default async function Page() {
  const state = await prefetch(meQuery(serverGet), sessionsQuery(serverGet));
  return (
    <HydrationBoundary state={state}>
      <AccountPage />
    </HydrationBoundary>
  );
}
