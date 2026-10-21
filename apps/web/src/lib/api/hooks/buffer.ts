'use client';

import type {
  BufferChannelDto,
  BufferOrganizationDto,
  BufferPostDto,
  BufferStatusDto,
  ConnectBufferInput,
} from '@conversa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { keys } from '../keys';

export type BufferPostView = 'scheduled' | 'sent';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/integrations/buffer`;

export function useBufferStatus(workspaceId: string) {
  return useQuery({
    queryKey: keys.buffer(workspaceId),
    queryFn: ({ signal }) => api.get<BufferStatusDto>(base(workspaceId), signal),
  });
}

/** Buffer reads need a connection with an organization chosen; pass `enabled` from the status. */
export function useBufferOrganizations(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.bufferOrganizations(workspaceId),
    queryFn: ({ signal }) =>
      api.get<BufferOrganizationDto[]>(`${base(workspaceId)}/organizations`, signal),
    enabled,
  });
}

export function useBufferChannels(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.bufferChannels(workspaceId),
    queryFn: ({ signal }) => api.get<BufferChannelDto[]>(`${base(workspaceId)}/channels`, signal),
    enabled,
  });
}

export function useBufferPosts(workspaceId: string, view: BufferPostView, enabled: boolean) {
  return useQuery({
    queryKey: keys.bufferPosts(workspaceId, view),
    queryFn: ({ signal }) =>
      api.get<BufferPostDto[]>(`${base(workspaceId)}/posts?view=${view}`, signal),
    enabled,
  });
}

/** Everything read from Buffer depends on the key and organization, so a change refetches all of it. */
function useResetBuffer(workspaceId: string) {
  const queryClient = useQueryClient();
  return (status?: BufferStatusDto) => {
    if (status) queryClient.setQueryData(keys.buffer(workspaceId), status);
    return queryClient.invalidateQueries({ queryKey: keys.buffer(workspaceId) });
  };
}

export function useConnectBuffer(workspaceId: string) {
  const reset = useResetBuffer(workspaceId);
  return useMutation({
    mutationFn: (body: ConnectBufferInput) => api.put<BufferStatusDto>(base(workspaceId), body),
    onSuccess: reset,
  });
}

export function useSelectBufferOrganization(workspaceId: string) {
  const reset = useResetBuffer(workspaceId);
  return useMutation({
    mutationFn: (organizationId: string) =>
      api.post<BufferStatusDto>(`${base(workspaceId)}/organization`, { organizationId }),
    onSuccess: reset,
  });
}

export function useDisconnectBuffer(workspaceId: string) {
  const reset = useResetBuffer(workspaceId);
  return useMutation({
    mutationFn: () => api.delete(base(workspaceId)),
    onSuccess: () => reset(),
  });
}
