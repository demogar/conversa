import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { AppException } from '../errors/app.exception.js';
import { SKIP_ORIGIN_CHECK } from '../http/decorators.js';
import type { AppRequest } from '../http/request.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cross-site request forgery defence. Session cookies are SameSite=Lax; on
 * top of that, every state-changing request must come from the app's own
 * origin, proved by the Origin header or, failing that, by Sec-Fetch-Site.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(request.method)) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const origin = request.headers.origin;
    if (origin) {
      if (origin === this.config.appOrigin) return true;
      throw new AppException(ErrorCode.CSRF_REJECTED);
    }
    if (request.headers['sec-fetch-site'] === 'same-origin') return true;
    throw new AppException(ErrorCode.CSRF_REJECTED);
  }
}
