import type { DeliveryDto, DeliveryStatus, Page } from '@conversa/shared';
import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { api, type ApiGet, query } from '../client';
import { keys } from '../keys';
import { automationsQuery } from './automations';

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilters {
  automationId?: string;
  status?: DeliveryStatus;
}

export const activityQuery = (
  workspaceId: string,
  filters: ActivityFilters,
  get: ApiGet = api.get,
) =>
  infiniteQueryOptions({
    queryKey: keys.activity(workspaceId, filters),
    queryFn: ({ pageParam, signal }) =>
      get<Page<DeliveryDto>>(
        `/workspaces/${workspaceId}/activity${query({ ...filters, cursor: pageParam, limit: ACTIVITY_PAGE_SIZE })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

/** The delivery log, newest first, one cursor page at a time. */
export function useActivity(workspaceId: string, filters: ActivityFilters) {
  return useInfiniteQuery(activityQuery(workspaceId, filters));
}

/** The workspace's automations, for filters and the getting-started checklist. */
export function useAutomationOptions(workspaceId: string) {
  return useQuery(automationsQuery(workspaceId));
}
