'use client';

import { Callout, DescriptionList, Link } from '@demogar/mola-ui';
import { useTranslations } from 'next-intl';
import { SettingsSection } from '@/features/settings/settings-section';
import { useInstance } from '@/lib/api/hooks/session';
import { releaseUrl, WEB_COMMIT, WEB_VERSION } from '@/lib/version';

/**
 * The version of each half of the installation. They are built and deployed
 * as separate images, so a half-finished upgrade shows up here first.
 */
export function VersionSection() {
  const t = useTranslations('admin.version');
  const instance = useInstance();
  const apiVersion = instance.data?.version;

  const release = (version: string, commit?: string | null) => (
    <Link variant="standalone" external href={releaseUrl(version)}>
      {commit ? `v${version} (${commit})` : `v${version}`}
    </Link>
  );

  return (
    <SettingsSection id="admin-version" title={t('title')} description={t('description')}>
      {apiVersion && apiVersion !== WEB_VERSION ? (
        <Callout tone="warn" title={t('mismatch.title')}>
          {t('mismatch.description', { web: WEB_VERSION, api: apiVersion })}
        </Callout>
      ) : null}
      <DescriptionList
        items={[
          { term: t('web'), detail: release(WEB_VERSION, WEB_COMMIT) },
          {
            term: t('api'),
            detail: apiVersion
              ? release(apiVersion)
              : instance.isError
                ? t('unavailable')
                : t('loading'),
          },
        ]}
      />
    </SettingsSection>
  );
}
