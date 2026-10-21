import type { DashboardDto } from '@conversa/shared';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { api, type ApiGet, query } from '../client';
import { keys } from '../keys';

export type DashboardRange = 7 | 30 | 90;

/** The range the overview opens on, so the server prefetches the same one. */
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = 30;

export const dashboardQuery = (workspaceId: string, days: DashboardRange, get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.dashboard(workspaceId, days),
    queryFn: ({ signal }) =>
      get<DashboardDto>(`/workspaces/${workspaceId}/dashboard${query({ days })}`, signal),
    placeholderData: keepPreviousData,
  });

/** Totals and the daily series for the last `days` days. The previous range stays on screen while the next loads. */
export function useDashboard(workspaceId: string, days: DashboardRange) {
  return useQuery(dashboardQuery(workspaceId, days));
}
