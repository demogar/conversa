'use client';

import { NavItem, PageHeader, useScrollEdge } from '@demogar/mola-ui';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCurrentWorkspace } from '@/lib/api/hooks/session';
import { workspacePath } from '@/lib/navigation';
import { SettingsColumn } from './settings-section';

const PAGES = [
  { path: '/settings', key: 'general', exact: true },
  { path: '/settings/members', key: 'members' },
  { path: '/settings/integrations', key: 'integrations' },
  { path: '/settings/audit', key: 'audit' },
] as const;

/** The settings header and sub-navigation; each settings page renders into the column beside it. */
export function SettingsFrame({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const t = useTranslations('settings');
  const pathname = usePathname();
  const workspace = useCurrentWorkspace(workspaceId);
  const navEdge = useScrollEdge<HTMLUListElement>();

  return (
    <div className="@container/settings min-h-full">
      <PageHeader
        title={t('title')}
        description={workspace ? t('description', { workspace: workspace.name }) : undefined}
      />
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 pt-4 pb-10 sm:px-6 @4xl/settings:grid-cols-[11rem_minmax(0,1fr)] @4xl/settings:pt-6">
        <nav
          aria-label={t('navLabel')}
          className="@4xl/settings:sticky @4xl/settings:top-6 @4xl/settings:self-start"
        >
          {/* The padding is room for the focus rings the scrolling list would clip. */}
          <ul
            ref={navEdge}
            className="-m-2 flex list-none gap-px overflow-x-auto p-2 scroll-cloth scroll-edge @4xl/settings:flex-col"
          >
            {PAGES.map((page) => {
              const href = workspacePath(workspaceId, page.path);
              const active =
                'exact' in page
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <NavItem
                  key={page.key}
                  active={active}
                  className="shrink-0"
                  render={<NextLink href={href} />}
                >
                  {t(`nav.${page.key}`)}
                </NavItem>
              );
            })}
          </ul>
        </nav>
        <SettingsColumn>{children}</SettingsColumn>
      </div>
    </div>
  );
}
