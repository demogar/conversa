'use client';

import type { AutomationDto, DeliveryDto, DeliveryStatus, Page } from '@conversa/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, query } from '../client';
import { keys } from '../keys';

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilters {
  automationId?: string;
  status?: DeliveryStatus;
}

/** The delivery log, newest first, one cursor page at a time. */
export function useActivity(workspaceId: string, filters: ActivityFilters) {
  return useInfiniteQuery({
    queryKey: keys.activity(workspaceId, filters),
    queryFn: ({ pageParam, signal }) =>
      api.get<Page<DeliveryDto>>(
        `/workspaces/${workspaceId}/activity${query({ ...filters, cursor: pageParam, limit: ACTIVITY_PAGE_SIZE })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** The workspace's automations, for filters and the getting-started checklist. */
export function useAutomationOptions(workspaceId: string) {
  return useQuery({
    queryKey: keys.automations(workspaceId),
    queryFn: ({ signal }) => api.get<AutomationDto[]>(`/workspaces/${workspaceId}/automations`, signal),
  });
}
