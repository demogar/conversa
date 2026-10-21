import type { Request } from 'express';
import type { WorkspaceRole } from '@conversa/shared';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface MembershipContext {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface AppRequest extends Request {
  rawBody?: Buffer;
  auth?: AuthContext;
  membership?: MembershipContext;
  clientIp?: string;
}
