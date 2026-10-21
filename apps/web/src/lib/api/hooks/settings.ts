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
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, type ApiGet, query } from '../client';
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

export const membersQuery = (workspaceId: string, get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.members(workspaceId),
    queryFn: ({ signal }) => get<MemberDto[]>(`/workspaces/${workspaceId}/members`, signal),
  });

/** Admins only. */
export const invitationsQuery = (workspaceId: string, get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.invitations(workspaceId),
    queryFn: ({ signal }) => get<InvitationDto[]>(`/workspaces/${workspaceId}/invitations`, signal),
  });

/** Admins only. */
export const auditLogQuery = (workspaceId: string, get: ApiGet = api.get) =>
  infiniteQueryOptions({
    queryKey: keys.audit(workspaceId),
    queryFn: ({ pageParam, signal }) =>
      get<Page<AuditEntryDto>>(
        `/workspaces/${workspaceId}/audit${query({ cursor: pageParam, limit: AUDIT_PAGE_SIZE })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export function useMembers(workspaceId: string) {
  return useQuery(membersQuery(workspaceId));
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
  return useQuery({ ...invitationsQuery(workspaceId), enabled });
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
  return useInfiniteQuery({ ...auditLogQuery(workspaceId), enabled });
}
