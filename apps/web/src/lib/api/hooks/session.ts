import type { InstanceDto, MeDto, WorkspaceDto } from '@conversa/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiGet } from '../client';
import { keys } from '../keys';

export const instanceQuery = (get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.instance,
    queryFn: ({ signal }) => get<InstanceDto>('/instance', signal),
  });

export const meQuery = (get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.me,
    queryFn: ({ signal }) => get<MeDto>('/me', signal),
    staleTime: 60_000,
  });

export function useInstance() {
  return useQuery(instanceQuery());
}

export function useMe() {
  return useQuery(meQuery());
}

/** The workspace from the URL, as the signed-in person sees it (with their role). */
export function useCurrentWorkspace(workspaceId: string): WorkspaceDto | undefined {
  return useMe().data?.workspaces.find((workspace) => workspace.id === workspaceId);
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      // A full load, not a client navigation: nothing cached for the old session survives.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<WorkspaceDto>('/workspaces', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}
