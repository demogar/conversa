import { Heading, Panel, Stack, Text } from '@demogar/mola-ui';
import type { ReactNode } from 'react';
import { BrandMark } from '@/features/brand/brand-mark';

/** The frame every signed-out screen shares: the mark, a title, and the form. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Stack gap="lg" className="w-full max-w-md">
      <BrandMark />
      <Panel as="section" aria-labelledby="auth-title" padding="lg">
        <Stack gap="lg">
          <Stack gap="xs">
            <Heading level={1} visualLevel={2} id="auth-title">
              {title}
            </Heading>
            {description ? <Text variant="secondary">{description}</Text> : null}
          </Stack>
          {children}
        </Stack>
      </Panel>
      {footer ? (
        <Text size="sm" variant="secondary">
          {footer}
        </Text>
      ) : null}
    </Stack>
  );
}
