'use client';

import { Badge, Button, Code, Field, Input } from '@demogar/mola-ui';
import type { SecretStatusDto } from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

/**
 * A secret the server keeps and never sends back. Once stored it shows as
 * "Configured ••••1234" with a Replace action; an empty value on save keeps
 * the stored one, so the form never has to hold the secret again.
 */
export function SecretField({
  label,
  status,
  value,
  onChange,
  error,
  hint,
  required = false,
  reveal = false,
  extra,
}: {
  label: string;
  status: SecretStatusDto;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  /** Show what is typed, for a value the admin must copy elsewhere (the verify token). */
  reveal?: boolean;
  /** A control beside the input, such as Generate. */
  extra?: ReactNode;
}) {
  const t = useTranslations('admin.secret');
  const [replacing, setReplacing] = useState(false);

  if (status.configured && !replacing) {
    return (
      <Field label={label} hint={hint}>
        {(control) => (
          <div className="flex flex-wrap items-center gap-3">
            <span id={control.id} className="flex flex-wrap items-center gap-2">
              <Badge tone="success" dot>
                {t('configured')}
              </Badge>
              {status.hint ? (
                <Code aria-label={t('endsWith', { hint: status.hint })}>••••{status.hint}</Code>
              ) : null}
            </span>
            <Button
              size="sm"
              variant="secondary"
              aria-label={t('replaceLabel', { field: label })}
              onClick={() => setReplacing(true)}
            >
              {t('replace')}
            </Button>
          </div>
        )}
      </Field>
    );
  }

  return (
    <Field label={label} required={required && !status.configured} error={error} hint={hint}>
      {(control) => (
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 basis-60">
            <Input
              {...control}
              type={reveal ? 'text' : 'password'}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {extra}
          {status.configured ? (
            <Button
              size="md"
              variant="ghost"
              onClick={() => {
                onChange('');
                setReplacing(false);
              }}
            >
              {t('keep')}
            </Button>
          ) : null}
        </div>
      )}
    </Field>
  );
}
