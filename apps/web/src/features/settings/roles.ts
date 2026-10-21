import { hasRole, type WorkspaceRole } from '@conversa/shared';

/** Admins manage members and admins; only owners grant or take away ownership. Mirrors the API. */
export function canChangeRole(actor: WorkspaceRole | undefined, target: WorkspaceRole): boolean {
  if (!actor || !hasRole(actor, 'ADMIN')) return false;
  return target !== 'OWNER' || actor === 'OWNER';
}

/** The roles an actor may hand out. */
export function assignableRoles(actor: WorkspaceRole | undefined): WorkspaceRole[] {
  if (actor === 'OWNER') return ['OWNER', 'ADMIN', 'MEMBER'];
  if (actor === 'ADMIN') return ['ADMIN', 'MEMBER'];
  return [];
}
