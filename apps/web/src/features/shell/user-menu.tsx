'use client';

import { Avatar, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@demogar/mola-ui';
import type { UserDto } from '@conversa/shared';
import { LogOut, ServerCog, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSignOut } from '@/lib/api/hooks/session';

export function UserMenu({ user }: { user: UserDto | undefined }) {
  const t = useTranslations('nav');
  const tAdmin = useTranslations('admin');
  const router = useRouter();
  const signOut = useSignOut();
  const name = user?.name ?? '';
  return (
    <Menu>
      <MenuTrigger
        aria-label={t('userMenu', { name })}
        className="ms-1 cursor-pointer focus-ring"
        render={<button type="button" />}
      >
        <Avatar name={name || '?'} size="sm" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem icon={<UserRound />} onClick={() => router.push('/account')}>
          {t('account')}
        </MenuItem>
        {user?.isInstanceAdmin ? (
          <MenuItem icon={<ServerCog />} onClick={() => router.push('/admin')}>
            {tAdmin('menuItem')}
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onClick={() => signOut.mutate()}>
          {t('signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
