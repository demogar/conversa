import { DEFAULT_LOCALE, isLocale, type Locale } from '@conversa/shared';

export const LOCALE_COOKIE = 'conversa_locale';

/** Picks the first supported language from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase().split('-')[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/** BCP 47 tag used to format dates and numbers. */
export const FORMAT_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-419' };
