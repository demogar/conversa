'use client';

import type { Locale } from '@conversa/shared';
import { LOCALE_COOKIE } from '@/i18n/config';

/** Stores the language choice for a year and reloads so server-rendered text follows. */
export function setLocaleCookie(locale: Locale): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
