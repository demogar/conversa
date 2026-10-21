import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@conversa/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { REQUIRE_INSTANCE_ADMIN } from '../../common/http/decorators.js';
import type { AppRequest } from '../../common/http/request.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

/**
 * Global guard for `@RequireInstanceAdmin()` routes. The flag is read from the
 * database on every request, so revoking it takes effect immediately.
 */
@Injectable()
export class InstanceAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_INSTANCE_ADMIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (!request.auth) throw new AppException(ErrorCode.UNAUTHENTICATED);
    const user = await this.prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: { isInstanceAdmin: true },
    });
    if (!user?.isInstanceAdmin) throw AppException.forbidden();
    return true;
  }
}
