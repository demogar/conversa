'use client';

import type {
  AutomationDto,
  BufferChannelDto,
  BufferPostDto,
  ChannelDto,
  CreateAutomationInput,
  MediaDto,
  SetAutomationStatusInput,
  UpdateAutomationInput,
} from '@conversa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from '../client';
import { keys } from '../keys';

const base = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}`;
const one = (workspaceId: string, automationId: string) =>
  `${base(workspaceId)}/automations/${encodeURIComponent(automationId)}`;

export function useAutomations(workspaceId: string) {
  return useQuery({
    queryKey: keys.automations(workspaceId),
    queryFn: ({ signal }) => api.get<AutomationDto[]>(`${base(workspaceId)}/automations`, signal),
  });
}

export function useAutomation(workspaceId: string, automationId: string | null) {
  return useQuery({
    queryKey: keys.automation(workspaceId, automationId ?? ''),
    queryFn: ({ signal }) => api.get<AutomationDto>(one(workspaceId, automationId ?? ''), signal),
    enabled: Boolean(automationId),
  });
}

/** Keeps the list and the single automation in the cache in step after a write. */
function useStoreAutomation(workspaceId: string) {
  const queryClient = useQueryClient();
  return (automation: AutomationDto) => {
    queryClient.setQueryData(keys.automation(workspaceId, automation.id), automation);
    return queryClient.invalidateQueries({ queryKey: keys.automations(workspaceId), exact: true });
  };
}

export function useCreateAutomation(workspaceId: string) {
  const store = useStoreAutomation(workspaceId);
  return useMutation({
    mutationFn: (input: CreateAutomationInput) => api.post<AutomationDto>(`${base(workspaceId)}/automations`, input),
    onSuccess: store,
  });
}

export function useUpdateAutomation(workspaceId: string, automationId: string) {
  const store = useStoreAutomation(workspaceId);
  return useMutation({
    mutationFn: (input: UpdateAutomationInput) => api.put<AutomationDto>(one(workspaceId, automationId), input),
    onSuccess: store,
  });
}

export function useSetAutomationStatus(workspaceId: string) {
  const store = useStoreAutomation(workspaceId);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SetAutomationStatusInput['status'] }) =>
      api.post<AutomationDto>(`${one(workspaceId, id)}/status`, { status }),
    onSuccess: store,
  });
}

export function useDuplicateAutomation(workspaceId: string) {
  const store = useStoreAutomation(workspaceId);
  return useMutation({
    mutationFn: (id: string) => api.post<AutomationDto>(`${one(workspaceId, id)}/duplicate`),
    onSuccess: store,
  });
}

export function useDeleteAutomation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(one(workspaceId, id)),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: keys.automation(workspaceId, id) });
      return queryClient.invalidateQueries({ queryKey: keys.automations(workspaceId), exact: true });
    },
  });
}

/** The workspace's connected accounts, for the builder's account picker. */
export function useChannelsForPicker(workspaceId: string) {
  return useQuery({
    queryKey: keys.channels(workspaceId),
    queryFn: ({ signal }) => api.get<ChannelDto[]>(`${base(workspaceId)}/channels`, signal),
  });
}

/** The latest posts of one account, for picking specific posts. */
export function useChannelMediaForPicker(workspaceId: string, channelId: string | null) {
  return useQuery({
    queryKey: keys.media(workspaceId, channelId ?? ''),
    queryFn: ({ signal }) =>
      api.get<MediaDto[]>(
        `${base(workspaceId)}/channels/${encodeURIComponent(channelId ?? '')}/media${query({ limit: 30 })}`,
        signal,
      ),
    enabled: Boolean(channelId),
    staleTime: 60_000,
  });
}

/** Posts scheduled in Buffer. Fails with BUFFER_NOT_CONNECTED when Buffer is not set up. */
export function useScheduledBufferPosts(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: keys.bufferPosts(workspaceId, 'scheduled'),
    queryFn: ({ signal }) =>
      api.get<BufferPostDto[]>(`${base(workspaceId)}/integrations/buffer/posts${query({ view: 'scheduled' })}`, signal),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** Buffer's channels, to tell which scheduled posts belong to a Conversa account. */
export function useBufferChannelsForPicker(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: keys.bufferChannels(workspaceId),
    queryFn: ({ signal }) => api.get<BufferChannelDto[]>(`${base(workspaceId)}/integrations/buffer/channels`, signal),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
