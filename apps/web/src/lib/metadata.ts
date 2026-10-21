import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/**
 * A route's `generateMetadata` that only sets the tab title, in the reader's language.
 * The root layout's template adds "· Conversa".
 */
export function pageTitle(pick: (t: Translate) => string): () => Promise<Metadata> {
  return async () => ({ title: pick(await getTranslations()) });
}
