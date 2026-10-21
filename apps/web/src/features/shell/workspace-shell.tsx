'use client';

import {
  AppShell,
  EmptyState,
  LinkButton,
  NavItem,
  NavSection,
  Sidebar,
  Topbar,
} from '@demogar/mola-ui';
import {
  Activity,
  AtSign,
  CalendarClock,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
  Zap,
} from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { BrandLogo } from '@/features/brand/brand-mark';
import { useCurrentWorkspace, useMe } from '@/lib/api/hooks/session';
import { workspacePath } from '@/lib/navigation';
import { CreateWorkspaceDialog } from './create-workspace-dialog';
import { UserMenu } from './user-menu';
import { WorkspaceSwitcher } from './workspace-switcher';

interface NavEntry {
  path: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const me = useMe();
  const workspace = useCurrentWorkspace(workspaceId);
  const [creating, setCreating] = useState(false);

  const sections: Array<{ title: string; items: NavEntry[] }> = [
    {
      title: t('sections.engage'),
      items: [
        { path: '', label: t('dashboard'), icon: <LayoutDashboard />, exact: true },
        { path: '/automations', label: t('automations'), icon: <Zap /> },
        { path: '/inbox', label: t('inbox'), icon: <Inbox /> },
        { path: '/content', label: t('content'), icon: <CalendarClock /> },
      ],
    },
    {
      title: t('sections.audience'),
      items: [
        { path: '/contacts', label: t('contacts'), icon: <Users /> },
        { path: '/activity', label: t('activity'), icon: <Activity /> },
      ],
    },
    {
      title: t('sections.workspace'),
      items: [
        { path: '/channels', label: t('channels'), icon: <AtSign /> },
        { path: '/settings', label: t('settings'), icon: <Settings /> },
      ],
    },
  ];

  const isActive = (entry: NavEntry) => {
    const href = workspacePath(workspaceId, entry.path);
    return entry.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <AppShell
        topbar={
          <Topbar
            start={
              <>
                <NextLink
                  href={workspacePath(workspaceId)}
                  className="flex min-h-[24px] items-center gap-2 px-1 text-ink no-underline"
                >
                  <BrandLogo />
                  <span className="font-display text-base font-bold tracking-display wdth-display max-sm:sr-only">
                    Conversa
                  </span>
                </NextLink>
                <WorkspaceSwitcher
                  current={workspace}
                  workspaces={me.data?.workspaces ?? []}
                  onCreate={() => setCreating(true)}
                />
              </>
            }
            end={<UserMenu user={me.data?.user} />}
          />
        }
        sidebar={
          <Sidebar label={t('sidebarLabel')}>
            {sections.map((section) => (
              <NavSection key={section.title} title={section.title}>
                {section.items.map((entry) => (
                  <NavItem
                    key={entry.path}
                    icon={entry.icon}
                    active={isActive(entry)}
                    render={<NextLink href={workspacePath(workspaceId, entry.path)} />}
                  >
                    {entry.label}
                  </NavItem>
                ))}
              </NavSection>
            ))}
          </Sidebar>
        }
      >
        {me.data && !workspace ? <WorkspaceMissing /> : children}
      </AppShell>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

/** A workspace id that is not one of the person's: deleted, left, or mistyped. */
function WorkspaceMissing() {
  const t = useTranslations('nav.workspaceMissing');
  const tCommon = useTranslations('common.notFound');
  return (
    <div className="p-4 sm:p-6">
      <h1 className="sr-only">{tCommon('heading')}</h1>
      <EmptyState
        kind="no-permission"
        size="lg"
        headingLevel={2}
        title={t('title')}
        description={t('description')}
        actions={<LinkButton render={<NextLink href="/" />}>{t('action')}</LinkButton>}
      />
    </div>
  );
}
