import { isLocale, type Locale } from '@conversa/shared';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, negotiateLocale, TIME_ZONE_COOKIE, validTimeZone } from './config';

const loaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('../../messages/en'),
  es: () => import('../../messages/es'),
};

/**
 * The locale comes from the person's saved choice (a cookie set when they
 * pick a language or sign in), then from the browser's languages.
 */
export default getRequestConfig(async () => {
  const jar = await cookies();
  const saved = jar.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(saved)
    ? saved
    : negotiateLocale((await headers()).get('accept-language'));
  // Screens render with data on the server now, so dates must use the reader's zone, not the server's.
  const timeZone = validTimeZone(jar.get(TIME_ZONE_COOKIE)?.value);
  // The request's time goes to the browser too, so relative times hydrate to the same words.
  return { locale, timeZone, now: new Date(), messages: (await loaders[locale]()).default };
});
