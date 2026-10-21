'use client';

import type { InvitationPreviewDto } from '@conversa/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { keys } from '../keys';

export function useInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: keys.invitation(token ?? ''),
    queryFn: ({ signal }) =>
      api.get<InvitationPreviewDto>(`/invitations/${encodeURIComponent(token ?? '')}`, signal),
    enabled: Boolean(token),
    retry: false,
  });
}
