'use client';

import { Link, Text } from '@demogar/mola-ui';
import { useTranslations } from 'next-intl';
import { releaseUrl, WEB_VERSION } from '@/lib/version';

/** "Conversa v0.1.0", quiet, linking to that release's notes. */
export function VersionLink() {
  const t = useTranslations('common.version');
  return (
    <Text as="span" size="xs" variant="muted">
      <Link variant="standalone" external href={releaseUrl(WEB_VERSION)} className="text-ink-muted">
        {t('label', { version: WEB_VERSION })}
      </Link>
    </Text>
  );
}
