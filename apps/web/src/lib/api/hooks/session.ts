'use client';

import type { InstanceDto, MeDto, WorkspaceDto } from '@conversa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { keys } from '../keys';

export function useInstance() {
  return useQuery({ queryKey: keys.instance, queryFn: ({ signal }) => api.get<InstanceDto>('/instance', signal) });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: ({ signal }) => api.get<MeDto>('/me', signal), staleTime: 60_000 });
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
