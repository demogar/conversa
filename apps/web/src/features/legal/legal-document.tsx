import { Callout, Heading, Lead, Prose } from '@demogar/mola-ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export interface LegalSection {
  title: string;
  paragraphs: string[];
  items?: string[];
}

/** One legal page: its title, the "adapt this template" notice, then its sections as prose. */
export async function LegalDocument({
  title,
  lead,
  sections,
  children,
}: {
  title: string;
  lead: string;
  sections: LegalSection[];
  /** Shown between the notice and the sections. */
  children?: ReactNode;
}) {
  const t = await getTranslations('legal.template');
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Heading level={1}>{title}</Heading>
        <Lead>{lead}</Lead>
      </header>
      <Callout tone="info" variant="flat" headingLevel={2} title={t('title')}>
        {t('description')}
      </Callout>
      {children}
      <Prose>
        {sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </Prose>
    </article>
  );
}
