import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@conversa/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { IS_PUBLIC } from '../../common/http/decorators.js';
import type { AppRequest } from '../../common/http/request.js';
import { SessionService } from './session.service.js';

/** Global guard: every route needs a session unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const token = (request.cookies as Record<string, string> | undefined)?.[
      this.sessions.cookieName
    ];
    const auth = await this.sessions.resolve(token);
    if (auth) request.auth = auth;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || auth) return true;
    throw new AppException(ErrorCode.UNAUTHENTICATED);
  }
}
