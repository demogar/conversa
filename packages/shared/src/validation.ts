import type { z } from 'zod';

/**
 * Collects zod issues by dotted path. Messages are codes (`required`,
 * `too_big`, `keywords_required`…), never prose, so the client translates
 * them. Used by the API to answer VALIDATION_FAILED and by the web app to
 * validate before sending.
 */
export function issuesToFields(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    const code =
      issue.code === 'custom' || /^[a-z_]+$/.test(issue.message) ? issue.message : issue.code;
    (fields[path] ??= []).push(code);
  }
  return fields;
}
