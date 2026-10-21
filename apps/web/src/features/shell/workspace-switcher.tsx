'use client';

import {
  Button,
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@demogar/mola-ui';
import type { WorkspaceDto } from '@conversa/shared';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { workspacePath } from '@/lib/navigation';

export function WorkspaceSwitcher({
  current,
  workspaces,
  onCreate,
}: {
  current: WorkspaceDto | undefined;
  workspaces: WorkspaceDto[];
  onCreate: () => void;
}) {
  const t = useTranslations('nav');
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('switchWorkspace', { name: current?.name ?? '' })}
          >
            <span className="max-w-40 truncate">{current?.name ?? '…'}</span>
            <ChevronsUpDown />
          </Button>
        }
      />
      <MenuContent>
        <MenuGroup>
          <MenuGroupLabel>{t('workspaces')}</MenuGroupLabel>
          {workspaces.map((workspace) => (
            <MenuItem
              key={workspace.id}
              icon={
                workspace.id === current?.id ? <Check /> : <span aria-hidden className="size-4" />
              }
              onClick={() => router.push(workspacePath(workspace.id))}
            >
              {workspace.name}
            </MenuItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuItem icon={<Plus />} onClick={onCreate}>
          {t('newWorkspace')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
