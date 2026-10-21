const BASE = 'http://conversa.invalid';

/**
 * Accepts only same-site paths, so `?next=` can never send someone to another
 * site. The value is resolved the way the browser will resolve it: URL
 * parsing drops tabs and newlines and reads `\` as `/`, so `/\t/evil.example`
 * would otherwise become `//evil.example`.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/')) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export const workspacePath = (workspaceId: string, path = '') => `/w/${workspaceId}${path}`;
