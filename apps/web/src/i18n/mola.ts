import type { defaultMessages, MessagesOverride } from '@demogar/mola-ui';
import type { Locale } from '@conversa/shared';
import { molaSpanish } from './mola-es';

/** The design system's built-in words, per locale. English is its default. */
export const molaMessages: Record<Locale, MessagesOverride<typeof defaultMessages>> = {
  en: {},
  es: molaSpanish,
};
