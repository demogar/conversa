'use client';

import { LinkButton, PageHeader } from '@demogar/mola-ui';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { SettingsColumn } from '@/features/settings/settings-section';
import { AdminGate } from './admin-gate';
import { InstagramSection } from './instagram-settings';
import { InstanceAdminsSection } from './instance-admins';
import { MailSection } from './mail-settings';
import { SignupSection } from './signup-settings';
import { TurnstileSection } from './turnstile-settings';
import { VersionSection } from './version-section';

/** Settings for the whole installation, outside any workspace. */
export function AdminPage() {
  const t = useTranslations('admin');
  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <LinkButton variant="secondary" render={<NextLink href="/admin/setup" />}>
            {t('openSetup')}
          </LinkButton>
        }
      />
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <SettingsColumn>
          <AdminGate>
            {(settings) => (
              <>
                <MailSection settings={settings.mail} />
                <InstagramSection settings={settings.instagram} sandbox={settings.sandbox} />
                <TurnstileSection settings={settings.turnstile} />
                <SignupSection mode={settings.signup.mode} />
                <InstanceAdminsSection />
                <VersionSection />
              </>
            )}
          </AdminGate>
        </SettingsColumn>
      </div>
    </>
  );
}
