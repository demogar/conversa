'use client';

import type { ConversationDto, MessageDto } from '@conversa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { keys } from '../keys';

const base = (workspaceId: string, channelId: string) =>
  `/workspaces/${workspaceId}/channels/${channelId}/conversations`;

/** Read live from Instagram on every load; Conversa keeps no copy. */
export function useConversations(workspaceId: string, channelId: string | null) {
  return useQuery({
    queryKey: keys.conversations(workspaceId, channelId ?? ''),
    queryFn: ({ signal }) => api.get<ConversationDto[]>(base(workspaceId, channelId!), signal),
    enabled: !!channelId,
  });
}

/** Oldest first. */
export function useMessages(
  workspaceId: string,
  channelId: string | null,
  conversationId: string | null,
) {
  return useQuery({
    queryKey: keys.messages(workspaceId, channelId ?? '', conversationId ?? ''),
    queryFn: ({ signal }) =>
      api.get<MessageDto[]>(`${base(workspaceId, channelId!)}/${conversationId}/messages`, signal),
    enabled: !!channelId && !!conversationId,
  });
}

export function useSendMessage(
  workspaceId: string,
  channelId: string,
  conversationId: string,
  recipientId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api.post<void>(`${base(workspaceId, channelId)}/${conversationId}/messages/${recipientId}`, {
        text,
      }),
    // Both the thread and the list's excerpt change.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keys.conversations(workspaceId, channelId) }),
  });
}
