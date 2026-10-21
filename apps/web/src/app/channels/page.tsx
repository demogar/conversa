'use client';

import { Skeleton, SkeletonGroup } from '@demogar/mola-ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect } from 'react';
import { useMe } from '@/lib/api/hooks/session';
import { query } from '@/lib/api/client';
import { workspacePath } from '@/lib/navigation';

/**
 * Where a failed Instagram connection lands: the callback cannot know the
 * workspace, so this sends the person to their first workspace's channels
 * page, carrying the error code along.
 */
function ChannelsRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const error = params.get('error');

  useEffect(() => {
    const first = me.data?.workspaces[0];
    if (first) router.replace(`${workspacePath(first.id, '/channels')}${query({ error })}`);
    else if (me.data) router.replace('/account');
  }, [error, me.data, router]);

  return null;
}

export default function ChannelsCallbackPage() {
  const t = useTranslations('common.states');
  return (
    <main className="p-6">
      <SkeletonGroup loading label={t('loading')} fallback={<Skeleton className="h-10 w-64" />} />
      <Suspense>
        <ChannelsRedirect />
      </Suspense>
    </main>
  );
}
