'use client';

import {
  Banner,
  Button,
  Callout,
  EmptyState,
  Grid,
  Heading,
  PageHeader,
  Skeleton,
  SkeletonGroup,
  useToast,
} from '@demogar/mola-ui';
import { ROLE_RANK } from '@conversa/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useChannels, useConnectInstagram } from '@/lib/api/hooks/channels';
import { useCurrentWorkspace, useInstance } from '@/lib/api/hooks/session';
import { keys } from '@/lib/api/keys';
import { useErrorMessage } from '@/lib/errors';
import { ChannelCard } from './channel-card';

/** The `?error=` code the OAuth callback sends back, translated; unknown codes read as a generic failure. */
function useCallbackError(code: string | null): string | null {
  const t = useTranslations('errors');
  if (!code) return null;
  const key = `codes.${code}` as 'codes.INTERNAL';
  return t.has(key) ? t(key) : t('codes.INTERNAL');
}

export function ChannelsScreen({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('channels');
  const tCommon = useTranslations('common.actions');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const role = useCurrentWorkspace(workspaceId)?.role;
  const instance = useInstance().data;
  const channels = useChannels(workspaceId);
  const connect = useConnectInstagram(workspaceId);

  const canManage = role !== undefined && ROLE_RANK[role] >= ROLE_RANK.ADMIN;
  const sandbox = instance?.sandbox ?? false;
  const configured = !instance || instance.providers.instagram || instance.sandbox;
  const callbackError = useCallbackError(params.get('error'));

  // The OAuth callback lands here with ?connected=<id> once: say so, then drop the query.
  const connectedId = params.get('connected');
  const announced = useRef(false);
  useEffect(() => {
    if (!connectedId || announced.current) return;
    announced.current = true;
    toast.success({ title: t('connected.title'), description: t('connected.description') });
    void queryClient.invalidateQueries({ queryKey: keys.channels(workspaceId) });
    router.replace(pathname);
  }, [connectedId, pathname, queryClient, router, t, toast, workspaceId]);

  const connectButton =
    canManage ? (
      <Button icon={<Plus />} loading={connect.isPending} disabled={!configured} onClick={() => connect.mutate()}>
        {t('connect')}
      </Button>
    ) : undefined;

  const list = channels.data ?? [];

  return (
    <div className="flex flex-col">
      <PageHeader title={t('title')} description={t('description')} actions={connectButton} />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {sandbox ? <Banner tone="info" title={t('sandbox.title')}>{t('sandbox.body')}</Banner> : null}

        {callbackError ? (
          <Callout tone="danger" headingLevel={2} title={t('connectFailed')} onDismiss={() => router.replace(pathname)}>
            {callbackError}
          </Callout>
        ) : null}

        {connect.error ? (
          <Callout tone="danger" headingLevel={2} title={t('connectFailed')}>
            {errorMessage(connect.error)}
          </Callout>
        ) : null}

        {canManage && !configured ? (
          <Callout tone="warn" headingLevel={2} title={t('notConfigured.title')}>
            {t.rich('notConfigured.body', { doc: () => <code className="literal">docs/instagram.md</code> })}
          </Callout>
        ) : null}

        {role === 'MEMBER' ? (
          <Callout tone="info" variant="flat" headingLevel={2} title={t('memberNote.title')}>
            {t('memberNote.body')}
          </Callout>
        ) : null}

        {channels.isPending ? (
          <SkeletonGroup
            loading
            label={t('states.loading')}
            fallback={
              <Grid cols="auto" minItem="20rem">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </Grid>
            }
          />
        ) : channels.isError ? (
          <EmptyState
            kind="error"
            headingLevel={2}
            title={t('states.loadFailed')}
            description={t('states.loadFailedDescription')}
            actions={
              <Button variant="secondary" icon={<RotateCcw />} onClick={() => channels.refetch()}>
                {tCommon('retry')}
              </Button>
            }
          />
        ) : list.length === 0 ? (
          <EmptyState
            headingLevel={2}
            title={t('empty.title')}
            description={canManage ? t('empty.description') : t('empty.memberDescription')}
            actions={configured ? connectButton : undefined}
          />
        ) : (
          <Grid cols="auto" minItem="20rem">
            {list.map((channel) => (
              <ChannelCard
                key={channel.id}
                workspaceId={workspaceId}
                channel={channel}
                canManage={canManage}
                sandbox={sandbox}
              />
            ))}
          </Grid>
        )}

        {channels.isSuccess && list.length === 0 && canManage && !sandbox ? (
          <section aria-labelledby="channel-requirements" className="flex max-w-reading flex-col gap-2">
            <Heading level={2} visualLevel={4} id="channel-requirements">
              {t('empty.requirementsTitle')}
            </Heading>
            <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-sm text-ink-2">
              <li>{t('empty.requirements.professional')}</li>
              <li>{t('empty.requirements.permissions')}</li>
              <li>{t('empty.requirements.admin')}</li>
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
