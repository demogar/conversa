'use client';

import { Inline, SegmentedControl, Select } from '@demogar/mola-ui';
import { LOCALES, type Locale } from '@conversa/shared';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { setLocaleCookie } from '@/lib/locale';
import { type Theme, useTheme } from './theme';

/** Language and theme, for screens outside the app shell. */
export function PreferencesBar({
  onLocaleChange,
}: {
  onLocaleChange?: (locale: Locale) => Promise<void> | void;
}) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [theme, setTheme] = useTheme();

  async function changeLocale(next: Locale | null) {
    if (!next || next === locale) return;
    setLocaleCookie(next);
    await onLocaleChange?.(next);
    router.refresh();
  }

  return (
    <Inline justify="between" gap="md">
      <div className="w-40">
        <Select
          label={t('language.label')}
          size="sm"
          value={locale}
          onValueChange={(value) => void changeLocale(value as Locale | null)}
          items={LOCALES.map((value) => ({ value, label: t(`language.${value}`) }))}
        />
      </div>
      <SegmentedControl
        aria-label={t('theme.label')}
        size="sm"
        value={theme}
        onValueChange={(value) => setTheme(value as Theme)}
        options={[
          { value: 'system', label: t('theme.system') },
          { value: 'light', label: t('theme.light') },
          { value: 'dark', label: t('theme.dark') },
        ]}
      />
    </Inline>
  );
}
