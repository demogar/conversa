export interface TemplateContext {
  username?: string | null;
}

/**
 * Fills the placeholders a message may contain. Unknown placeholders are left
 * as typed, so a literal "{something}" in a message survives.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  return template
    .replace(/\{username\}/g, () => (context.username ? `@${context.username}` : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
