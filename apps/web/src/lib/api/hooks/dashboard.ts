'use client';

import type { DashboardDto } from '@conversa/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, query } from '../client';
import { keys } from '../keys';

export type DashboardRange = 7 | 30 | 90;

/** Totals and the daily series for the last `days` days. The previous range stays on screen while the next loads. */
export function useDashboard(workspaceId: string, days: DashboardRange) {
  return useQuery({
    queryKey: keys.dashboard(workspaceId, days),
    queryFn: ({ signal }) =>
      api.get<DashboardDto>(`/workspaces/${workspaceId}/dashboard${query({ days })}`, signal),
    placeholderData: keepPreviousData,
  });
}
