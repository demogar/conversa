import type {
  InstanceSettingsDto,
  InstanceSettingsSection,
  InstanceUserDto,
  MailTestResultDto,
  UpdateInstagramSettingsInput,
  UpdateMailSettingsInput,
  UpdateSignupSettingsInput,
  UpdateTurnstileSettingsInput,
} from '@conversa/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiGet } from '../client';
import { keys } from '../keys';

type SectionInput = {
  mail: UpdateMailSettingsInput;
  instagram: UpdateInstagramSettingsInput;
  turnstile: UpdateTurnstileSettingsInput;
  signup: UpdateSignupSettingsInput;
};

/** Installation settings, without secrets. Only instance admins may read them. */
export const instanceSettingsQuery = (get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.instanceSettings,
    queryFn: ({ signal }) => get<InstanceSettingsDto>('/instance/settings', signal),
  });

export const instanceAdminsQuery = (get: ApiGet = api.get) =>
  queryOptions({
    queryKey: keys.instanceAdmins,
    queryFn: ({ signal }) => get<InstanceUserDto[]>('/instance/admins', signal),
  });

export function useInstanceSettings(enabled = true) {
  return useQuery({ ...instanceSettingsQuery(), enabled });
}

/** Saves one section. The public instance flags (mail on, captcha key) change with it. */
export function useUpdateInstanceSettings<S extends InstanceSettingsSection>(section: S) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SectionInput[S]) =>
      api.patch<InstanceSettingsDto>(`/instance/settings/${section}`, input),
    onSuccess: async (settings) => {
      queryClient.setQueryData(keys.instanceSettings, settings);
      await queryClient.invalidateQueries({ queryKey: keys.instance, exact: true });
    },
  });
}

/** Forgets a section, which turns the feature off. */
export function useClearInstanceSettings(section: InstanceSettingsSection) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<InstanceSettingsDto>(`/instance/settings/${section}`),
    onSuccess: async (settings) => {
      queryClient.setQueryData(keys.instanceSettings, settings);
      await queryClient.invalidateQueries({ queryKey: keys.instance, exact: true });
    },
  });
}

export function useSendTestMail() {
  return useMutation({
    mutationFn: (to: string) => api.post<MailTestResultDto>('/instance/settings/mail/test', { to }),
  });
}

export function useInstanceAdmins() {
  return useQuery(instanceAdminsQuery());
}

/** Revoking your own access also changes what the user menu offers. */
export function useSetInstanceAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isInstanceAdmin }: { userId: string; isInstanceAdmin: boolean }) =>
      api.patch<InstanceUserDto>(`/instance/admins/${userId}`, { isInstanceAdmin }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.instanceAdmins });
      await queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}
