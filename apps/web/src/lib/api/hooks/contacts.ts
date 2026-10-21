import type { ContactDto, Page } from '@conversa/shared';
import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { api, type ApiGet, query } from '../client';
import { keys } from '../keys';
import { channelsQuery } from './channels';

export const CONTACTS_PAGE_SIZE = 50;

export interface ContactFilters {
  channelId?: string;
  search?: string;
}

export const contactsQuery = (
  workspaceId: string,
  filters: ContactFilters,
  get: ApiGet = api.get,
) =>
  infiniteQueryOptions({
    queryKey: keys.contacts(workspaceId, filters),
    queryFn: ({ pageParam, signal }) =>
      get<Page<ContactDto>>(
        `/workspaces/${workspaceId}/contacts${query({ ...filters, cursor: pageParam, limit: CONTACTS_PAGE_SIZE })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

/** Contacts, most recently active first, one cursor page at a time. */
export function useContacts(workspaceId: string, filters: ContactFilters) {
  return useInfiniteQuery(contactsQuery(workspaceId, filters));
}

/** The workspace's channels, for labels and the channel filter. */
export function useChannelLabels(workspaceId: string) {
  return useQuery(channelsQuery(workspaceId));
}
