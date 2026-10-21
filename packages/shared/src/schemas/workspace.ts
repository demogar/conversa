import { z } from 'zod';
import { LIMITS } from '../limits.js';
import { WorkspaceRole } from '../enums.js';
import { email } from './common.js';

export const workspaceName = z.string().trim().min(1).max(LIMITS.workspaceNameLength);

export const createWorkspaceSchema = z.object({ name: workspaceName });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({ name: workspaceName });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

/** Owners are made by transfer, never by invitation. */
const invitableRole = z.enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]);

export const createInvitationSchema = z.object({ email, role: invitableRole });
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateMemberSchema = z.object({
  role: z.enum([WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const acceptInvitationSchema = z.object({ token: z.string().min(16).max(128) });
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
