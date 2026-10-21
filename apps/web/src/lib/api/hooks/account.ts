'use client';

import type {
  ChangePasswordInput,
  MfaSetupDto,
  RecoveryCodesDto,
  SessionDto,
  UpdateProfileInput,
  UserDto,
} from '@conversa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { keys } from '../keys';

/** The setup answer also carries the QR code, drawn by the server as SVG. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<UserDto>('/me', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}

/** Changing the password signs out every other session. */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post<void>('/me/password', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: keys.sessions,
    queryFn: ({ signal }) => api.get<SessionDto[]>('/me/sessions', signal),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.delete(`/me/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  });
}

export function useStartMfa() {
  return useMutation({ mutationFn: () => api.post<MfaSetupDto>('/me/mfa/setup') });
}

/** Turning two-step verification on also signs out every other session. */
export function useEnableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<RecoveryCodesDto>('/me/mfa/enable', { code }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.me });
      await queryClient.invalidateQueries({ queryKey: keys.sessions });
    },
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.post<void>('/me/mfa/disable', { password }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}
