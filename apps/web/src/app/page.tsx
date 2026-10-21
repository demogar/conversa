'use client';

import { SkeletonGroup, Skeleton } from '@demogar/mola-ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useMe } from '@/lib/api/hooks/session';
import { workspacePath } from '@/lib/navigation';

/** Sends the person to their first workspace. */
export default function HomePage() {
  const router = useRouter();
  const t = useTranslations('common.states');
  const me = useMe();

  useEffect(() => {
    const first = me.data?.workspaces[0];
    if (first) router.replace(workspacePath(first.id));
    else if (me.data) router.replace('/account');
  }, [me.data, router]);

  return (
    <main className="p-6">
      <SkeletonGroup loading label={t('loading')} fallback={<Skeleton className="h-10 w-64" />} />
    </main>
  );
}
