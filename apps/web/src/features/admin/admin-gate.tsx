'use client';

import {
  Button,
  EmptyState,
  LinkButton,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
} from '@demogar/mola-ui';
import type { InstanceSettingsDto } from '@conversa/shared';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useInstanceSettings } from '@/lib/api/hooks/admin';
import { useMe } from '@/lib/api/hooks/session';
import { useErrorMessage } from '@/lib/errors';

/**
 * Loads the installation settings for an instance admin, and gives everyone
 * else the no-permission state instead of a request the API would refuse.
 */
export function AdminGate({
  children,
}: {
  children: (settings: InstanceSettingsDto) => ReactNode;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common.actions');
  const errorMessage = useErrorMessage();
  const me = useMe();
  const isAdmin = me.data?.user.isInstanceAdmin === true;
  const settings = useInstanceSettings(isAdmin);

  if (me.isError || settings.isError) {
    const retry = me.isError ? me.refetch : settings.refetch;
    return (
      <EmptyState
        kind="error"
        headingLevel={2}
        title={t('loadFailed')}
        description={errorMessage(me.error ?? settings.error)}
        actions={<Button onClick={() => void retry()}>{tCommon('retry')}</Button>}
      />
    );
  }
  if (me.data && !isAdmin) {
    return (
      <EmptyState
        kind="no-permission"
        headingLevel={2}
        title={t('noPermission.title')}
        description={t('noPermission.description')}
        actions={
          <LinkButton variant="secondary" render={<NextLink href="/" />}>
            {t('noPermission.back')}
          </LinkButton>
        }
      />
    );
  }
  return (
    <SkeletonGroup loading={!settings.data} label={t('loading')} fallback={<AdminSkeleton />}>
      {settings.data ? children(settings.data) : null}
    </SkeletonGroup>
  );
}

function AdminSkeleton() {
  return (
    <div className="flex flex-col">
      {[3, 2, 2].map((lines, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-x-8 gap-y-4 border-b border-keyline py-8 first:pt-2 @2xl/form:grid-cols-[14rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-3">
            <Skeleton shape="text" className="h-5 w-2/3" />
            <SkeletonText lines={lines} className="text-sm" />
          </div>
          <Skeleton className="h-40" />
        </div>
      ))}
    </div>
  );
}
