'use client';

import type { BufferPostDto } from '@conversa/shared';
import { Field, Select, type SelectOption, Text } from '@demogar/mola-ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useBufferChannelsForPicker, useScheduledBufferPosts } from '@/lib/api/hooks/automations';

interface BufferPostFieldProps {
  workspaceId: string;
  channelId: string | null;
  value: string | null;
  onChange: (bufferPostId: string | null) => void;
  error?: string;
}

function excerpt(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Posts scheduled in Buffer, narrowed to the ones for this account when
 * Buffer's channel is linked to it; every scheduled post otherwise.
 */
export function BufferPostField({ workspaceId, channelId, value, onChange, error }: BufferPostFieldProps) {
  const t = useTranslations('automations.builder.trigger');
  const format = useFormatter();
  const posts = useScheduledBufferPosts(workspaceId);
  const bufferChannels = useBufferChannelsForPicker(workspaceId, posts.isSuccess);

  const items = useMemo<SelectOption[]>(() => {
    const all = posts.data ?? [];
    const linked = new Set(
      (bufferChannels.data ?? []).filter((channel) => channel.linkedChannelId === channelId).map((channel) => channel.id),
    );
    const mine = linked.size > 0 ? all.filter((post) => linked.has(post.channelId)) : all;
    const options = mine.map((post: BufferPostDto) => ({
      value: post.id,
      label: post.text ? excerpt(post.text) : t('bufferUntitled'),
      description: post.dueAt
        ? t('bufferDue', { date: format.dateTime(new Date(post.dueAt), { dateStyle: 'medium', timeStyle: 'short' }) })
        : undefined,
    }));
    // A post that has already gone out is no longer scheduled; keep it so the choice stays visible.
    if (value && !options.some((option) => option.value === value)) {
      const known = all.find((post) => post.id === value);
      options.unshift({ value, label: known?.text ? excerpt(known.text) : t('bufferUntitled'), description: undefined });
    }
    return options;
  }, [posts.data, bufferChannels.data, channelId, value, format, t]);

  if (posts.isError) {
    return (
      <Text size="sm" tone="danger">
        {t('bufferLoadFailed')}
      </Text>
    );
  }

  return (
    <Field
      label={t('bufferPost')}
      required
      error={error}
      hint={posts.isSuccess && items.length === 0 ? t('bufferNoPosts') : undefined}
    >
      {(control) => (
        <Select
          {...control}
          items={items}
          value={value}
          onValueChange={onChange}
          placeholder={t('bufferPostPlaceholder')}
          disabled={posts.isPending || items.length === 0}
        />
      )}
    </Field>
  );
}
