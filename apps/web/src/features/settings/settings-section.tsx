import { cn, Heading } from '@demogar/mola-ui';
import type { ReactNode } from 'react';

/**
 * One block of a settings page: a heading and a sentence on the left, the
 * controls on a raised panel on the right (stacked on a narrow screen).
 */
export function SettingsSection({
  id,
  title,
  description,
  danger = false,
  wide = false,
  className,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  /** Cuts a danger seam into the panel's top edge, as a destructive dialog does. */
  danger?: boolean;
  /** Heading above the panel instead of beside it, for a table that needs the whole width. */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-4 border-b border-keyline py-8 first:pt-2 last:border-b-0',
        !wide && '@2xl/form:grid-cols-[14rem_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="min-w-0">
        <Heading level={2} visualLevel={3} id={id}>
          {title}
        </Heading>
        <p className="mt-1.5 mb-0 text-sm text-ink-2">{description}</p>
      </div>
      <div className="min-w-0 bg-cloth-pale shadow-cut">
        {danger ? <div aria-hidden className="relleno h-2 band-danger" /> : null}
        <div className="flex flex-col gap-5 p-5">{children}</div>
      </div>
    </section>
  );
}

/** The column the sections sit in; it sets the container the sections respond to. */
export function SettingsColumn({ children }: { children: ReactNode }) {
  return <div className="@container/form min-w-0 max-w-4xl">{children}</div>;
}
