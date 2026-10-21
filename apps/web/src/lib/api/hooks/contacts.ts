'use client';

import type { ChannelDto, ContactDto, Page } from '@conversa/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, query } from '../client';
import { keys } from '../keys';

export const CONTACTS_PAGE_SIZE = 50;

export interface ContactFilters {
  channelId?: string;
  search?: string;
}

/** Contacts, most recently active first, one cursor page at a time. */
export function useContacts(workspaceId: string, filters: ContactFilters) {
  return useInfiniteQuery({
    queryKey: keys.contacts(workspaceId, filters),
    queryFn: ({ pageParam, signal }) =>
      api.get<Page<ContactDto>>(
        `/workspaces/${workspaceId}/contacts${query({ ...filters, cursor: pageParam, limit: CONTACTS_PAGE_SIZE })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** The workspace's channels, for labels and the channel filter. */
export function useChannelLabels(workspaceId: string) {
  return useQuery({
    queryKey: keys.channels(workspaceId),
    queryFn: ({ signal }) => api.get<ChannelDto[]>(`/workspaces/${workspaceId}/channels`, signal),
  });
}
