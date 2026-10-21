import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '@conversa/shared';
import { AppException } from '../errors/app.exception.js';
import type { AppRequest, AuthContext, MembershipContext } from './request.js';

export const IS_PUBLIC = 'conversa:public';
/** The route needs no session. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

export const SKIP_ORIGIN_CHECK = 'conversa:skip-origin-check';
/** For server-to-server callbacks (webhooks) that carry their own signature. */
export const SkipOriginCheck = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ORIGIN_CHECK, true);

export const REQUIRED_ROLE = 'conversa:required-role';
/** Minimum workspace role for the route; needs a `:workspaceId` param. */
export const RequireRole = (role: WorkspaceRole): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLE, role);

export const CurrentAuth = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthContext => {
    const auth = context.switchToHttp().getRequest<AppRequest>().auth;
    if (!auth) throw new AppException('UNAUTHENTICATED');
    return auth;
  },
);

export const CurrentMembership = createParamDecorator(
  (_: unknown, context: ExecutionContext): MembershipContext => {
    const membership = context.switchToHttp().getRequest<AppRequest>().membership;
    if (!membership) throw AppException.forbidden();
    return membership;
  },
);

export const ClientIp = createParamDecorator(
  (_: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AppRequest>().clientIp ?? 'unknown',
);

export const UserAgent = createParamDecorator(
  (_: unknown, context: ExecutionContext): string | null => {
    const value = context.switchToHttp().getRequest<AppRequest>().headers['user-agent'];
    return typeof value === 'string' ? value.slice(0, 300) : null;
  },
);
