import type { MeDto } from '@conversa/shared';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { serverGet } from '@/lib/api/server';
import { workspacePath } from '@/lib/navigation';

/** Sends the person to their first workspace, on the server, before anything is drawn. */
export default async function HomePage() {
  const me = await serverGet<MeDto>('/me').catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  });
  const first = me.workspaces[0];
  redirect(first ? workspacePath(first.id) : '/account');
}
