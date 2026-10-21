import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasRole, type WorkspaceRole } from '@conversa/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { REQUIRED_ROLE } from '../../common/http/decorators.js';
import type { AppRequest } from '../../common/http/request.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

/**
 * Global guard for routes under `/workspaces/:workspaceId`. A workspace the
 * user is not a member of answers 404, so ids cannot be probed for existence.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const workspaceId = request.params?.workspaceId;
    const required = this.reflector.getAllAndOverride<WorkspaceRole | undefined>(REQUIRED_ROLE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (typeof workspaceId !== 'string') return true;
    if (!request.auth) throw new AppException('UNAUTHENTICATED');

    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: request.auth.userId } },
      select: { role: true },
    });
    if (!membership) throw AppException.notFound();
    if (required && !hasRole(membership.role, required)) throw AppException.forbidden();

    request.membership = { workspaceId, role: membership.role };
    return true;
  }
}
