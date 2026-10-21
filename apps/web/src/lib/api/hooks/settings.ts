'use client';

import type {
  AuditEntryDto,
  CreatedInvitationDto,
  CreateInvitationInput,
  InvitationDto,
  MemberDto,
  Page,
  WorkspaceDto,
  WorkspaceRole,
} from '@conversa/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from '../client';
import { keys } from '../keys';

const AUDIT_PAGE_SIZE = 25;

export function useRenameWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.patch<WorkspaceDto>(`/workspaces/${workspaceId}`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  return useMutation({ mutationFn: () => api.delete(`/workspaces/${workspaceId}`) });
}

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: keys.members(workspaceId),
    queryFn: ({ signal }) => api.get<MemberDto[]>(`/workspaces/${workspaceId}/members`, signal),
  });
}

export function useChangeRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      api.patch<void>(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.members(workspaceId) });
      // Changing your own role changes what you may see.
      await queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** Removes a member; with the caller's own id it is leaving the workspace. */
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.members(workspaceId) }),
  });
}

export function useInvitations(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: keys.invitations(workspaceId),
    queryFn: ({ signal }) =>
      api.get<InvitationDto[]>(`/workspaces/${workspaceId}/invitations`, signal),
    enabled,
  });
}

export function useCreateInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvitationInput) =>
      api.post<CreatedInvitationDto>(`/workspaces/${workspaceId}/invitations`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) }),
  });
}

export function useAuditLog(workspaceId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.audit(workspaceId),
    queryFn: ({ pageParam, signal }) =>
      api.get<Page<AuditEntryDto>>(
        `/workspaces/${workspaceId}/audit${query({ cursor: pageParam, limit: AUDIT_PAGE_SIZE })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}
