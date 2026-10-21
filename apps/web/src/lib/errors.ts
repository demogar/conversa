'use client';

import { type ErrorCode, issuesToFields } from '@conversa/shared';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { z } from 'zod';
import { ApiError } from './api/client';

/** Translates an API error (or anything thrown) into one sentence for the reader. */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      const code: ErrorCode = error instanceof ApiError ? error.code : 'INTERNAL';
      const key = `codes.${code}` as const;
      return t.has(key) ? t(key) : t('codes.INTERNAL');
    },
    [t],
  );
}

export type FieldErrors = Record<string, string>;

/**
 * Field errors for a form, keyed by dotted path, from a failed client-side
 * parse or from the API's VALIDATION_FAILED answer. Only the first problem of
 * each field is shown.
 */
export function useFieldErrors(): (source: z.ZodError | unknown) => FieldErrors {
  const t = useTranslations('errors');
  return useCallback(
    (source: unknown) => {
      let fields: Record<string, string[]> = {};
      if (source instanceof ApiError) fields = source.fields;
      else if (source && typeof source === 'object' && 'issues' in source)
        fields = issuesToFields(source as z.ZodError);
      const result: FieldErrors = {};
      for (const [path, codes] of Object.entries(fields)) {
        const code = codes[0] ?? 'required';
        const key = `fields.${code}` as 'fields.required';
        result[path] = t.has(key) ? t(key) : t('fields.invalid_format');
      }
      return result;
    },
    [t],
  );
}
