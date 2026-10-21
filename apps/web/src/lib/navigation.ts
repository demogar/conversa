/** Accepts only same-site paths, so `?next=` can never send someone to another site. */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}

export const workspacePath = (workspaceId: string, path = '') => `/w/${workspaceId}${path}`;
