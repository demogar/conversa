'use client';

import { NavItem } from '@demogar/mola-ui';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const PAGES = [
  { href: '/legal/privacy', key: 'privacy' },
  { href: '/legal/terms', key: 'terms' },
  { href: '/legal/data-deletion', key: 'dataDeletion' },
] as const;

export function LegalNav() {
  const t = useTranslations('legal.nav');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')}>
      <ul className="-m-2 flex list-none flex-wrap gap-px p-2">
        {PAGES.map((page) => (
          <NavItem
            key={page.key}
            active={pathname === page.href}
            className="shrink-0"
            render={<NextLink href={page.href} />}
          >
            {t(page.key)}
          </NavItem>
        ))}
      </ul>
    </nav>
  );
}
