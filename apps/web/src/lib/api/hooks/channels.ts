'use client';

import type { ChannelDto, MediaDto, SimulateEventInput } from '@conversa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { keys } from '../keys';

export function useChannels(workspaceId: string) {
  return useQuery({
    queryKey: keys.channels(workspaceId),
    queryFn: ({ signal }) => api.get<ChannelDto[]>(`/workspaces/${workspaceId}/channels`, signal),
  });
}

/** Starts the Instagram sign-in; the browser leaves for the platform and comes back to the channels page. */
export function useConnectInstagram(workspaceId: string) {
  return useMutation({
    mutationFn: () => api.post<{ url: string }>(`/workspaces/${workspaceId}/channels/instagram/connect`),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useDisconnectChannel(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.delete(`/workspaces/${workspaceId}/channels/${channelId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.workspace(workspaceId) }),
  });
}

export function useChannelMedia(workspaceId: string, channelId: string, enabled = true) {
  return useQuery({
    queryKey: keys.media(workspaceId, channelId),
    queryFn: ({ signal }) => api.get<MediaDto[]>(`/workspaces/${workspaceId}/channels/${channelId}/media`, signal),
    enabled,
  });
}

/** Sandbox only: pretends someone commented on a post or sent the account a message. */
export function useSimulateEvent(workspaceId: string, channelId: string) {
  return useMutation({
    mutationFn: (body: SimulateEventInput) =>
      api.post<void>(`/workspaces/${workspaceId}/channels/${channelId}/sandbox/events`, body),
  });
}
