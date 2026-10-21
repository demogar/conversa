'use client';

import { LIMITS, type MediaDto } from '@conversa/shared';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  EmptyState,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@demogar/mola-ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useChannelMediaForPicker } from '@/lib/api/hooks/automations';
import { useErrorMessage } from '@/lib/errors';

interface PostPickerProps {
  workspaceId: string;
  channelId: string | null;
  value: string[];
  onChange: (mediaIds: string[]) => void;
  error?: string;
}

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3';

function excerpt(caption: string | null, max = 70): string | null {
  const text = caption?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function PostOption({ media, disabled }: { media: MediaDto; disabled: boolean }) {
  const t = useTranslations('automations.builder.trigger');
  const format = useFormatter();
  const caption = excerpt(media.caption);
  return (
    <Checkbox
      value={media.id}
      disabled={disabled}
      wrapperClassName="items-start bg-cloth p-2 shadow-cut"
      label={
        <span className="flex min-w-0 flex-col gap-2">
          {media.thumbnailUrl ? (
            // Instagram's CDN serves the thumbnail; it is shown as is, not optimised.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.thumbnailUrl}
              alt=""
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          ) : (
            <span aria-hidden className="block aspect-square w-full bg-cloth-shade" />
          )}
          <Text as="span" size="sm" className="break-words">
            {caption ?? t('postUntitled')}
          </Text>
          <Text as="span" size="xs" variant="muted">
            {format.dateTime(new Date(media.publishedAt), { dateStyle: 'medium' })}
          </Text>
        </span>
      }
    />
  );
}

/** The account's latest posts as a grid of thumbnails, any number of them chosen. */
export function PostPicker({ workspaceId, channelId, value, onChange, error }: PostPickerProps) {
  const t = useTranslations('automations.builder.trigger');
  const tCommon = useTranslations('common.actions');
  const errorMessage = useErrorMessage();
  const media = useChannelMediaForPicker(workspaceId, channelId);
  const full = value.length >= LIMITS.mediaIdsPerAutomation;

  if (!channelId) {
    return (
      <Text size="sm" variant="secondary">
        {t('postsChooseChannel')}
      </Text>
    );
  }

  if (media.isError) {
    return (
      <EmptyState
        kind="error"
        size="sm"
        headingLevel={4}
        title={t('postsLoadFailed')}
        description={errorMessage(media.error)}
        actions={
          <Button type="button" variant="secondary" onClick={() => media.refetch()}>
            {tCommon('retry')}
          </Button>
        }
      />
    );
  }

  const posts = media.data ?? [];
  return (
    <SkeletonGroup
      loading={media.isPending}
      label={t('postsLoading')}
      fallback={
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full" />
          ))}
        </div>
      }
    >
      {posts.length === 0 ? (
        <EmptyState size="sm" headingLevel={4} title={t('postsEmpty')} />
      ) : (
        <CheckboxGroup
          legend={t('posts')}
          description={`${t('postsHint', { max: LIMITS.mediaIdsPerAutomation })} ${t('postsSelected', { count: value.length })}`}
          value={value}
          onValueChange={onChange}
          error={error}
        >
          <div className={GRID}>
            {posts.map((post) => (
              <PostOption key={post.id} media={post} disabled={full && !value.includes(post.id)} />
            ))}
          </div>
        </CheckboxGroup>
      )}
    </SkeletonGroup>
  );
}
