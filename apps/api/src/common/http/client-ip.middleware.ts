import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { resolveClientIp } from './client-ip.js';
import type { AppRequest } from './request.js';

@Injectable()
export class ClientIpMiddleware implements NestMiddleware {
  constructor(private readonly config: AppConfig) {}

  use(request: AppRequest, _response: Response, next: NextFunction): void {
    request.clientIp = resolveClientIp(request, this.config.env.TRUST_PROXY);
    next();
  }
}
