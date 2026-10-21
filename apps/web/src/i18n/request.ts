import { isLocale, type Locale } from '@conversa/shared';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, negotiateLocale } from './config';

const loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('../../messages/en'),
  es: () => import('../../messages/es'),
};

/**
 * The locale comes from the person's saved choice (a cookie set when they
 * pick a language or sign in), then from the browser's languages.
 */
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(saved) ? saved : negotiateLocale((await headers()).get('accept-language'));
  return { locale, messages: (await loaders[locale]()).default };
});
